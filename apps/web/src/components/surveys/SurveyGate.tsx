'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SurveyDto, SurveyQuestionDto } from '@sydt/shared';
import * as Dialog from '@radix-ui/react-dialog';
import { ClipboardList } from 'lucide-react';
import { surveysApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function SurveyGate() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.surveysPending,
    queryFn: surveysApi.pending,
    refetchInterval: 60_000,
  });

  const [current, setCurrent] = React.useState<SurveyDto | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, { optionIds: string[]; text: string }>>({});
  const [dismissedOptional, setDismissedOptional] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    if (!pending.length) {
      setCurrent(null);
      return;
    }
    const next =
      pending.find((s) => s.requireBeforeContinue) ??
      pending.find((s) => !dismissedOptional.has(s.id)) ??
      null;
    setCurrent(next);
    setAnswers({});
  }, [pending, dismissedOptional]);

  const submitMut = useMutation({
    mutationFn: () => {
      if (!current?.questions) throw new Error('No survey');
      const payload = current.questions.map((q) => buildAnswer(q, answers[q.id]));
      return surveysApi.respond(current.id, { answers: payload });
    },
    onSuccess: async () => {
      toast.success(t.surveyThanks);
      await qc.invalidateQueries({ queryKey: queryKeys.surveysPending });
      setCurrent(null);
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  if (!current?.questions?.length) return null;

  const blocking = current.requireBeforeContinue;

  const onOpenChange = (open: boolean) => {
    if (blocking && !open) return;
    if (!open && !blocking) setDismissedOptional((s) => new Set(s).add(current.id));
  };

  return (
    <Dialog.Root open onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm',
            blocking && 'cursor-not-allowed',
          )}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[81] flex max-h-[min(90vh,42rem)] w-[min(96vw,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border/80 bg-bg-elev shadow-2xl"
          onPointerDownOutside={(e) => blocking && e.preventDefault()}
          onEscapeKeyDown={(e) => blocking && e.preventDefault()}
        >
          <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-cyan/15 text-accent-cyan">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <Dialog.Title className="text-lg font-semibold text-fg">{current.title}</Dialog.Title>
              {current.description ? (
                <Dialog.Description className="mt-0.5 text-sm text-fg-subtle">{current.description}</Dialog.Description>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-4 text-sm text-fg-subtle">
              {blocking ? t.surveyRequiredHint : t.surveyOptionalHint}
            </p>
            <div className="space-y-5">
              {current.questions.map((q) => (
                <QuestionBlock
                  key={q.id}
                  question={q}
                  value={answers[q.id] ?? { optionIds: [], text: '' }}
                  onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-4">
            {!blocking ? (
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t.teamCancelEdit}
              </Button>
            ) : null}
            <Button type="button" disabled={submitMut.isPending} onClick={() => submitMut.mutate()}>
              {submitMut.isPending ? '…' : t.surveySubmit}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QuestionBlock({
  question,
  value,
  onChange,
}: {
  question: SurveyQuestionDto;
  value: { optionIds: string[]; text: string };
  onChange: (v: { optionIds: string[]; text: string }) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[15px] leading-snug text-fg">
        {question.text}
        {question.required ? <span className="text-accent-rose"> *</span> : null}
      </Label>
      {question.type === 'TEXT' ? (
        <textarea
          className="min-h-[5rem] w-full rounded-md border border-border/80 bg-bg-deep px-3 py-2 text-[15px] text-fg"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
        />
      ) : (
        <div className="space-y-2">
          {question.options.map((opt) => {
            const checked = value.optionIds.includes(opt.id);
            return (
              <label
                key={opt.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-white/[0.02] px-3 py-2 text-[15px] hover:bg-accent-cyan/[0.06]"
              >
                <input
                  type={question.type === 'MULTI' ? 'checkbox' : 'radio'}
                  name={question.id}
                  checked={checked}
                  onChange={() => {
                    if (question.type === 'MULTI') {
                      const next = checked
                        ? value.optionIds.filter((id) => id !== opt.id)
                        : [...value.optionIds, opt.id];
                      onChange({ ...value, optionIds: next });
                    } else {
                      onChange({ ...value, optionIds: [opt.id] });
                    }
                  }}
                  className="accent-accent-cyan"
                />
                <span className="text-fg">{opt.text}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function buildAnswer(
  q: SurveyQuestionDto,
  raw: { optionIds: string[]; text: string } | undefined,
): { questionId: string; optionIds?: string[]; textValue?: string } {
  if (q.type === 'TEXT') {
    return { questionId: q.id, textValue: raw?.text ?? '' };
  }
  return { questionId: q.id, optionIds: raw?.optionIds ?? [] };
}
