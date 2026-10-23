'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, ClipboardList, FileText, Plus, Trash2 } from 'lucide-react';
import { SurveyReportDialog } from '@/components/admin/SurveyReportDialog';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { GlassPanel } from '@/components/common/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { adminSurveysApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { unwrapApiError } from '@/lib/api/axios';
import { useI18n } from '@/components/providers/LocaleProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const PIE_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#94a3b8'];

type DraftOption = { text: string };
type DraftQuestion = {
  text: string;
  type: 'SINGLE' | 'MULTI' | 'TEXT';
  required: boolean;
  options: DraftOption[];
};

export function AdminSurveysSection() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [requireBefore, setRequireBefore] = React.useState(false);
  const [questions, setQuestions] = React.useState<DraftQuestion[]>([
    { text: '', type: 'SINGLE', required: true, options: [{ text: '' }, { text: '' }] },
  ]);
  const [statsId, setStatsId] = React.useState<string | null>(null);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: queryKeys.adminSurveys,
    queryFn: adminSurveysApi.list,
  });

  const { data: stats, isFetching: statsLoading } = useQuery({
    queryKey: queryKeys.adminSurveyStats(statsId ?? ''),
    queryFn: () => adminSurveysApi.stats(statsId!),
    enabled: !!statsId,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: queryKeys.adminSurveys });

  const createMut = useMutation({
    mutationFn: () =>
      adminSurveysApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        requireBeforeContinue: requireBefore,
        isActive: true,
        questions: questions.map((q) => ({
          text: q.text.trim(),
          type: q.type,
          required: q.required,
          options: q.type === 'TEXT' ? undefined : q.options.filter((o) => o.text.trim()).map((o) => ({ text: o.text.trim() })),
        })),
      }),
    onSuccess: () => {
      toast.success(t.surveyCreatedOk);
      setTitle('');
      setDescription('');
      setRequireBefore(false);
      setQuestions([{ text: '', type: 'SINGLE', required: true, options: [{ text: '' }, { text: '' }] }]);
      invalidate();
      void qc.invalidateQueries({ queryKey: queryKeys.surveysPending });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminSurveysApi.remove(id),
    onSuccess: () => {
      toast.success(t.surveyDeletedOk);
      if (statsId) setStatsId(null);
      invalidate();
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const patchMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminSurveysApi.update(id, { isActive }),
    onSuccess: () => {
      invalidate();
      void qc.invalidateQueries({ queryKey: queryKeys.surveysPending });
    },
    onError: (err) => toast.error(unwrapApiError(err).message),
  });

  const addQuestion = () =>
    setQuestions((q) => [...q, { text: '', type: 'SINGLE', required: true, options: [{ text: '' }, { text: '' }] }]);

  const canPublish =
    title.trim().length >= 2 &&
    questions.every((q) => q.text.trim() && (q.type === 'TEXT' || q.options.some((o) => o.text.trim())));

  return (
    <div className="admin-page w-full space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <ClipboardList className="h-5 w-5 text-accent-cyan" />
          {t.surveyTitle}
        </h1>
        <p className="mt-1 text-[15px] text-fg-subtle">{t.surveyLead}</p>
      </div>

      <GlassPanel className="space-y-4 p-6">
        <h2 className="text-sm font-semibold text-fg">{t.surveyCreate}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t.surveyFieldTitle}</Label>
            <Input className="text-[15px]" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.surveyFieldDescription}</Label>
            <Input className="text-[15px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[15px] text-fg">
          <input
            type="checkbox"
            checked={requireBefore}
            onChange={(e) => setRequireBefore(e.target.checked)}
            className="accent-accent-cyan"
          />
          {t.surveyRequireBefore}
        </label>

        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-lg border border-border/60 bg-white/[0.02] p-4">
              <div className="mb-3 flex flex-wrap gap-3">
                <div className="min-w-[12rem] flex-1 space-y-1.5">
                  <Label>{t.surveyQuestionText}</Label>
                  <Input
                    className="text-[15px]"
                    value={q.text}
                    onChange={(e) =>
                      setQuestions((prev) => prev.map((x, i) => (i === qi ? { ...x, text: e.target.value } : x)))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.surveyQuestionType}</Label>
                  <select
                    className="flex h-10 rounded-md border border-border/80 bg-bg-deep px-2 text-[15px] text-fg"
                    value={q.type}
                    onChange={(e) => {
                      const type = e.target.value as DraftQuestion['type'];
                      setQuestions((prev) =>
                        prev.map((x, i) =>
                          i === qi
                            ? {
                                ...x,
                                type,
                                options:
                                  type === 'TEXT'
                                    ? []
                                    : x.options.length
                                      ? x.options
                                      : [{ text: '' }, { text: '' }],
                              }
                            : x,
                        ),
                      );
                    }}
                  >
                    <option value="SINGLE">{t.surveyTypeSingle}</option>
                    <option value="MULTI">{t.surveyTypeMulti}</option>
                    <option value="TEXT">{t.surveyTypeText}</option>
                  </select>
                </div>
                {questions.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-end text-accent-rose"
                    onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
              {q.type !== 'TEXT' ? (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex gap-2">
                      <Input
                        className="text-[15px]"
                        placeholder={`${t.surveyAddOption} ${oi + 1}`}
                        value={opt.text}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((x, i) =>
                              i === qi
                                ? {
                                    ...x,
                                    options: x.options.map((o, j) => (j === oi ? { text: e.target.value } : o)),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setQuestions((prev) =>
                        prev.map((x, i) => (i === qi ? { ...x, options: [...x.options, { text: '' }] } : x)),
                      )
                    }
                  >
                    {t.surveyAddOption}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addQuestion}>
            <Plus className="mr-1 h-4 w-4" />
            {t.surveyAddQuestion}
          </Button>
          <Button type="button" disabled={!canPublish || createMut.isPending} onClick={() => createMut.mutate()}>
            {createMut.isPending ? '…' : t.surveyPublish}
          </Button>
        </div>
      </GlassPanel>

      <GlassPanel className="divide-y divide-border/40 p-0">
        {isLoading ? <div className="p-6 text-fg-subtle">{t.loading}</div> : null}
        {!isLoading && !surveys.length ? (
          <div className="p-6 text-[15px] text-fg-subtle">{t.surveyNoData}</div>
        ) : null}
        {surveys.map((s) => (
          <div key={s.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-fg">{s.title}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-fg">
                  <span>
                    {s.responseCount ?? 0} {t.surveyResponses}
                  </span>
                  {s.requireBeforeContinue ? (
                    <span className="rounded bg-accent-amber/15 px-1.5 py-0.5 text-accent-amber">
                      {t.surveyRequireBefore}
                    </span>
                  ) : null}
                  <span className={cn(!s.isActive && 'text-accent-rose')}>
                    {s.isActive ? t.surveyActive : '—'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={statsId === s.id ? 'default' : 'outline'}
                  className="gap-1.5"
                  onClick={() => setStatsId((id) => (id === s.id ? null : s.id))}
                >
                  <BarChart3 className="h-4 w-4" />
                  {t.surveyStats}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => patchMut.mutate({ id: s.id, isActive: !s.isActive })}
                >
                  {s.isActive ? 'Pause' : t.surveyActive}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    if (window.confirm(t.surveyDelete + '?')) deleteMut.mutate(s.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {statsId === s.id ? (
              <SurveyStatsPanel stats={stats} loading={statsLoading} t={t} />
            ) : null}
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}

function SurveyStatsPanel({
  stats,
  loading,
  t,
}: {
  stats: Awaited<ReturnType<typeof adminSurveysApi.stats>> | undefined;
  loading: boolean;
  t: import('@/i18n/dict').Dict;
}) {
  const [reportOpen, setReportOpen] = React.useState(false);
  if (loading) return <div className="mt-4 text-sm text-muted-fg">{t.loading}</div>;
  if (!stats) return null;

  return (
    <div className="mt-4 space-y-4 border-t border-border/40 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-fg-subtle">
          {stats.totalResponses} / {stats.eligibleUsers} · %{stats.responseRate}
        </p>
        <Button type="button" size="sm" className="gap-1.5" onClick={() => setReportOpen(true)}>
          <FileText className="h-4 w-4" />
          {t.surveyReportCreate}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t.surveyResponses} value={String(stats.totalResponses)} />
        <StatCard label={t.surveyResponseRate} value={`${stats.responseRate}%`} />
        <StatCard label={t.adminStatUsers} value={String(stats.eligibleUsers)} />
      </div>
      {stats.questions.map((q) => {
        if (q.type === 'TEXT') {
          return (
            <div key={q.questionId} className="rounded-lg border border-border/50 p-4">
              <p className="mb-2 text-sm font-medium text-fg">{q.text}</p>
              {q.textAnswers.length === 0 ? (
                <p className="text-sm text-muted-fg">{t.surveyNoData}</p>
              ) : (
                <>
                <p className="mb-2 text-xs text-muted-fg">
                  {q.textAnswers.length} {t.surveyResponses.toLowerCase()}
                </p>
                <ul className="max-h-80 space-y-1 overflow-y-auto text-[15px] text-fg-subtle">
                  {q.textAnswers.map((a, i) => (
                    <li key={i} className="rounded bg-white/[0.03] px-2 py-1.5">
                      {a}
                    </li>
                  ))}
                </ul>
                </>
              )}
            </div>
          );
        }
        const selectionTotal = q.options.reduce((sum, o) => sum + o.count, 0);
        const ranked = [...q.options].sort((a, b) => b.count - a.count);
        const top = ranked[0];
        const barData = q.options.map((o) => ({ name: o.text, count: o.count }));
        const pieData = q.options.filter((o) => o.count > 0).map((o) => ({ name: o.text, value: o.count }));
        return (
          <div key={q.questionId} className="rounded-lg border border-border/50 p-4">
            <p className="mb-3 text-sm font-medium text-fg">{q.text}</p>
            {top && top.count > 0 ? (
              <p className="mb-3 text-sm text-fg-subtle">
                {t.surveyTopChoice}: <span className="font-medium text-fg">{top.text}</span>
                {' · '}
                {top.count} {t.surveySelections} (%{selectionTotal ? Math.round((top.count / selectionTotal) * 1000) / 10 : 0})
              </p>
            ) : null}
            {barData.every((d) => d.count === 0) ? (
              <p className="text-sm text-muted-fg">{t.surveyNoData}</p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} width={28} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(220 30% 10%)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {pieData.length > 0 ? (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} label>
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : null}
              </div>
            )}
            {selectionTotal > 0 ? (
              <ul className="mt-3 space-y-2">
                {ranked.map((o) => {
                  const pct = Math.round((o.count / selectionTotal) * 1000) / 10;
                  return (
                    <li key={o.optionId}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="text-fg">{o.text}</span>
                        <span className="shrink-0 font-mono text-muted-fg">
                          {o.count} · %{pct}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-accent-cyan" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
      <SurveyReportDialog stats={reportOpen ? stats : null} onClose={() => setReportOpen(false)} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-accent-cyan/[0.06] px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-fg">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-fg">{value}</div>
    </div>
  );
}
