export type SurveyQuestionType = 'SINGLE' | 'MULTI' | 'TEXT';

export interface SurveyOptionDto {
  id: string;
  text: string;
  position: number;
}

export interface SurveyQuestionDto {
  id: string;
  text: string;
  type: SurveyQuestionType;
  position: number;
  required: boolean;
  options: SurveyOptionDto[];
}

export interface SurveyDto {
  id: string;
  title: string;
  description: string | null;
  requireBeforeContinue: boolean;
  isActive: boolean;
  createdAt: string;
  responseCount?: number;
  questions?: SurveyQuestionDto[];
}

export interface SurveyOptionStat {
  optionId: string;
  text: string;
  count: number;
}

export interface SurveyQuestionStat {
  questionId: string;
  text: string;
  type: SurveyQuestionType;
  totalAnswers: number;
  options: SurveyOptionStat[];
  textAnswers: string[];
}

export interface SurveyStatsDto {
  surveyId: string;
  title: string;
  totalResponses: number;
  eligibleUsers: number;
  responseRate: number;
  questions: SurveyQuestionStat[];
}
