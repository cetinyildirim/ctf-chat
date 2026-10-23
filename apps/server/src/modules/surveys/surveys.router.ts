import { Router } from 'express';
import { z } from 'zod';
import { schemas } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { BadRequest, NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeSurvey } from './survey-serializer.js';

const router: Router = Router();
router.use(requireAuth);

const idSchema = z.object({ id: z.string().cuid() });

const surveyInclude = {
  questions: {
    orderBy: { position: 'asc' as const },
    include: { options: { orderBy: { position: 'asc' as const } } },
  },
};

router.get('/pending', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const account = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { createdAt: true } });
    // Surveys that predate the account are not pushed to newcomers.
    const active = await prisma.survey.findMany({
      where: { isActive: true, createdAt: { gte: account.createdAt } },
      include: surveyInclude,
      orderBy: { createdAt: 'asc' },
    });
    if (!active.length) {
      res.json({ surveys: [] });
      return;
    }
    const responded = await prisma.surveyResponse.findMany({
      where: { userId, surveyId: { in: active.map((s) => s.id) } },
      select: { surveyId: true },
    });
    const done = new Set(responded.map((r) => r.surveyId));
    const pending = active.filter((s) => !done.has(s.id));
    res.json({ surveys: pending.map((s) => serializeSurvey(s, { includeQuestions: true })) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/respond',
  validate(idSchema, 'params'),
  validate(schemas.submitSurveyResponseSchema),
  async (req, res, next) => {
    try {
      const surveyId = req.params.id!;
      const userId = req.user!.id;
      const body = req.body as z.infer<typeof schemas.submitSurveyResponseSchema>;

      const survey = await prisma.survey.findUnique({
        where: { id: surveyId },
        include: surveyInclude,
      });
      if (!survey?.isActive) throw NotFound();

      const existing = await prisma.surveyResponse.findUnique({
        where: { surveyId_userId: { surveyId, userId } },
      });
      if (existing) {
        res.status(409).json({ error: { code: 'CONFLICT', message: 'Survey already submitted' } });
        return;
      }

      const questionMap = new Map(survey.questions.map((q) => [q.id, q]));
      for (const q of survey.questions) {
        if (!q.required) continue;
        const ans = body.answers.find((a) => a.questionId === q.id);
        if (!ans) throw BadRequest(`Missing answer for required question`);
        if (q.type === 'TEXT') {
          if (!ans.textValue?.trim()) throw BadRequest('Text answer required');
        } else if (!ans.optionIds?.length) {
          throw BadRequest('Option selection required');
        }
      }

      for (const ans of body.answers) {
        const q = questionMap.get(ans.questionId);
        if (!q) throw BadRequest('Invalid question');
        if (q.type === 'TEXT') {
          if (ans.optionIds?.length) throw BadRequest('Text questions cannot have options');
          continue;
        }
        const optSet = new Set(q.options.map((o) => o.id));
        for (const oid of ans.optionIds ?? []) {
          if (!optSet.has(oid)) throw BadRequest('Invalid option');
        }
        if (q.type === 'SINGLE' && (ans.optionIds?.length ?? 0) > 1) {
          throw BadRequest('Single choice allows one option');
        }
      }

      const answerRows: { questionId: string; optionId?: string; textValue?: string }[] = [];
      for (const ans of body.answers) {
        const q = questionMap.get(ans.questionId)!;
        if (q.type === 'TEXT') {
          answerRows.push({
            questionId: ans.questionId,
            textValue: ans.textValue?.trim() ?? '',
          });
        } else {
          for (const optionId of ans.optionIds ?? []) {
            answerRows.push({ questionId: ans.questionId, optionId });
          }
        }
      }

      const response = await prisma.surveyResponse.create({
        data: {
          surveyId,
          userId,
          answers: { create: answerRows },
        },
      });

      await audit({
        actorId: userId,
        action: 'survey.respond',
        target: surveyId,
        meta: { title: survey.title, responseId: response.id },
      });

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
