import type { Survey, SurveyOption, SurveyQuestion } from '@prisma/client';
import type { SurveyDto, SurveyOptionDto, SurveyQuestionDto } from '@sydt/shared';

type QuestionWithOptions = SurveyQuestion & { options: SurveyOption[] };
type SurveyWithQuestions = Survey & { questions?: QuestionWithOptions[]; _count?: { responses: number } };

export function serializeSurveyOption(o: SurveyOption): SurveyOptionDto {
  return { id: o.id, text: o.text, position: o.position };
}

export function serializeSurveyQuestion(q: QuestionWithOptions): SurveyQuestionDto {
  return {
    id: q.id,
    text: q.text,
    type: q.type as SurveyQuestionDto['type'],
    position: q.position,
    required: q.required,
    options: q.options.map(serializeSurveyOption).sort((a, b) => a.position - b.position),
  };
}

export function serializeSurvey(s: SurveyWithQuestions, opts?: { includeQuestions?: boolean }): SurveyDto {
  const questions =
    opts?.includeQuestions && s.questions
      ? [...s.questions].sort((a, b) => a.position - b.position).map(serializeSurveyQuestion)
      : undefined;
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    requireBeforeContinue: s.requireBeforeContinue,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    ...(s._count ? { responseCount: s._count.responses } : {}),
    ...(questions ? { questions } : {}),
  };
}
