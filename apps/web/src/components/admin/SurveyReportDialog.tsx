'use client';

import * as React from 'react';
import type { SurveyStatsDto } from '@sydt/shared';
import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/components/providers/LocaleProvider';
import { downloadTextPdf } from '@/lib/reports/canvas-pdf';
import {
  draftSurveyReport,
  reportFilename,
  reportToPdfBlocks,
  type ReportSection,
  type SurveyReportDraft,
} from '@/lib/reports/survey-draft';

export function SurveyReportDialog({
  stats,
  onClose,
}: {
  stats: SurveyStatsDto | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [draft, setDraft] = React.useState<SurveyReportDraft | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!stats) {
      setDraft(null);
      return;
    }
    setDraft(draftSurveyReport(stats, locale));
  }, [stats, locale]);

  const patch = (id: string, next: Partial<ReportSection>) => {
    setDraft((current) =>
      current
        ? { ...current, sections: current.sections.map((section) => (section.id === id ? { ...section, ...next } : section)) }
        : current,
    );
  };

  const download = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      await downloadTextPdf(reportFilename(draft.title), reportToPdfBlocks(draft));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.surveyReportFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!stats} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.surveyReportDialogTitle}</DialogTitle>
          <DialogDescription>{t.surveyReportLead}</DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="space-y-4 pr-1">
            <div className="space-y-1.5">
              <Label>{t.surveyReportFieldTitle}</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <p className="text-xs text-muted-fg">{draft.meta}</p>
            </div>
            {draft.sections.map((section) => (
              <section
                key={section.id}
                className="space-y-3 rounded-xl border border-border/70 bg-white/[0.02] p-4"
              >
                <div className="space-y-1.5">
                  <Label>{section.kicker ? t.surveyReportQuestion : t.surveyReportSection}</Label>
                  <Input value={section.heading} onChange={(e) => patch(section.id, { heading: e.target.value })} />
                </div>
                {section.kicker !== undefined ? (
                  <Textarea
                    className="min-h-[4.5rem] text-[15px] font-medium"
                    value={section.kicker}
                    onChange={(e) => patch(section.id, { kicker: e.target.value })}
                  />
                ) : null}
                {section.chart?.length ? <ChartPreview items={section.chart} /> : null}
                <div className="space-y-1.5">
                  {section.interpret ? <Label>{t.surveyReportAnalysis}</Label> : null}
                  <Textarea
                    className="min-h-[7rem] text-[14px] leading-relaxed"
                    value={section.body}
                    onChange={(e) => patch(section.id, { body: e.target.value })}
                  />
                </div>
                {section.answers !== undefined ? (
                  <div className="space-y-1.5 rounded-lg border border-border/60 bg-bg-deep/40 p-3">
                    <Label>{section.answersLabel ?? t.surveyReportAnswers}</Label>
                    <Textarea
                      className="min-h-[6rem] bg-transparent text-[13px] leading-relaxed"
                      value={section.answers}
                      onChange={(e) => patch(section.id, { answers: e.target.value })}
                    />
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t.teamCancelEdit}
          </Button>
          <Button type="button" className="gap-1.5" disabled={!draft || busy} onClick={() => void download()}>
            <FileDown className="h-4 w-4" />
            {busy ? t.surveyReportPreparing : t.surveyReportDownload}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PREVIEW_COLORS = ['#0891b2', '#7c3aed', '#059669', '#d97706', '#e11d48', '#475569'];

function ChartPreview({ items }: { items: ReportSection['chart'] }) {
  const rows = items ?? [];
  const max = Math.max(...rows.map((item) => item.value), 1);
  return (
    <ul className="space-y-1.5 rounded-lg border border-border/60 bg-bg-deep/30 p-3">
      {rows.map((item, index) => (
        <li key={`${item.label}-${index}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-[12px]">
          <span className="truncate text-fg">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(item.value > 0 ? 4 : 0, (item.value / max) * 100)}%`,
                background: PREVIEW_COLORS[index % PREVIEW_COLORS.length],
              }}
            />
          </span>
          <span className="font-mono text-muted-fg">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
