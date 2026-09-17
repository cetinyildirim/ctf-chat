'use client';
import type { TicketStatus } from '@sydt/shared';
import { useI18n } from '@/components/providers/LocaleProvider';
import { ticketStatusLabel } from '@/i18n/ticket-labels';
import { cn } from '@/lib/utils';

const styles: Record<TicketStatus, string> = {
  OPEN: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
  IN_PROGRESS: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
  WAITING_FOR_COMPETITOR: 'bg-accent-violet/10 text-accent-violet border-accent-violet/30',
  RESOLVED: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
  CLOSED: 'bg-white/5 text-muted-fg border-white/10',
  REOPENED: 'bg-accent-rose/10 text-accent-rose border-accent-rose/30',
};

interface Props {
  status: TicketStatus;
  className?: string;
}

export function StatusPill({ status, className }: Props) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        styles[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ticketStatusLabel(t, status)}
    </span>
  );
}
