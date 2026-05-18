import { Router } from 'express';
import { z } from 'zod';
import { Permission, schemas } from '@sydt/shared';
import type { SurveyQuestionStat, SurveyStatsDto } from '@sydt/shared';
import { prisma } from '../../prisma.js';
import { requirePermission } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { NotFound } from '../../lib/http-error.js';
import { audit } from '../../lib/audit.js';
import { serializeSurvey } from '../surveys/survey-serializer.js';

const router: Router = Router();
router.use(requirePermission(Permission.ADMIN_DASHBOARD));

const idSchema = z.object({ id: z.string().cuid() });

const surveyInclude = {
  questions: {
    orderBy: { position: 'asc' as const },
    include: { options: { orderBy: { position: 'asc' as const } } },
  },
  _count: { select: { responses: true } },
};

router.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.survey.findMany({
      orderBy: { createdAt: 'desc' },
      include: surveyInclude,
    });
    res.json({ surveys: rows.map((s) => serializeSurvey(s, { includeQuestions: true })) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(schemas.createSurveySchema), async (req, res, next) => {
  try {
    const data = req.body as z.infer<typeof schemas.createSurveySchema>;
    const survey = await prisma.survey.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        requireBeforeContinue: data.requireBeforeContinue,
        isActive: data.isActive,
        createdById: req.user?.id,
        questions: {
          create: data.questions.map((q, qi) => ({
            text: q.text.trim(),
            type: q.type,
            position: qi,
            required: q.required,
            options:
              q.type === 'TEXT'
                ? undefined
                : {
                    create: (q.options ?? []).map((o, oi) => ({
                      text: o.text.trim(),
                      position: oi,
                    })),
                  },
          })),
        },
      },
      include: surveyInclude,
    });
    await audit({
      actorId: req.user?.id,
      action: 'survey.create',
      target: survey.id,
      meta: { title: survey.title },
    });
    res.status(201).json({ survey: serializeSurvey(survey, { includeQuestions: true }) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validate(idSchema, 'params'), validate(schemas.patchSurveySchema), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const data = req.body as z.infer<typeof schemas.patchSurveySchema>;
    const existing = await prisma.survey.findUnique({ where: { id } });
    if (!existing) throw NotFound();
    const survey = await prisma.survey.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description === null ? null : data.description.trim() || null }
          : {}),
        ...(data.requireBeforeContinue !== undefined
          ? { requireBeforeContinue: data.requireBeforeContinue }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: surveyInclude,
    });
    await audit({
      actorId: req.user?.id,
      action: 'survey.update',
      target: id,
      meta: data as Record<string, unknown>,
    });
    res.json({ survey: serializeSurvey(survey, { includeQuestions: true }) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const existing = await prisma.survey.findUnique({ where: { id } });
    if (!existing) throw NotFound();
    await prisma.survey.delete({ where: { id } });
    await audit({ actorId: req.user?.id, action: 'survey.delete', target: id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/stats', validate(idSchema, 'params'), async (req, res, next) => {
  try {
    const id = req.params.id!;
    const survey = await prisma.survey.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { position: 'asc' },
          include: { options: { orderBy: { position: 'asc' } } },
        },
        responses: {
          include: {
            answers: true,
          },
        },
      },
    });
    if (!survey) throw NotFound();

    const [totalResponses, eligibleUsers] = await Promise.all([
      prisma.surveyResponse.count({ where: { surveyId: id } }),
      prisma.user.count({ where: { isBanned: false } }),
    ]);

    const questions: SurveyQuestionStat[] = survey.questions.map((q) => {
      const answersForQ = survey.responses.flatMap((r) =>
        r.answers.filter((a) => a.questionId === q.id),
      );
      if (q.type === 'TEXT') {
        return {
          questionId: q.id,
          text: q.text,
          type: q.type as SurveyQuestionStat['type'],
          totalAnswers: answersForQ.length,
          options: [],
          textAnswers: answersForQ.map((a) => a.textValue ?? '').filter(Boolean).slice(0, 200),
        };
      }
      const optionCounts = new Map<string, number>();
      for (const a of answersForQ) {
        if (a.optionId) optionCounts.set(a.optionId, (optionCounts.get(a.optionId) ?? 0) + 1);
      }
      return {
        questionId: q.id,
        text: q.text,
        type: q.type as SurveyQuestionStat['type'],
        totalAnswers: answersForQ.length,
        options: q.options.map((o) => ({
          optionId: o.id,
          text: o.text,
          count: optionCounts.get(o.id) ?? 0,
        })),
        textAnswers: [],
      };
    });

    const stats: SurveyStatsDto = {
      surveyId: survey.id,
      title: survey.title,
      totalResponses,
      eligibleUsers,
      responseRate: eligibleUsers > 0 ? Math.round((totalResponses / eligibleUsers) * 1000) / 10 : 0,
      questions,
    };
    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

export default router;
