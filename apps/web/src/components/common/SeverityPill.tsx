'use client';
import { useI18n } from '@/components/providers/LocaleProvider';
import { ticketPriorityLabel } from '@/i18n/ticket-labels';
import { cn } from '@/lib/utils';

type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const colors: Record<Severity, string> = {
  INFO: 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30',
  LOW: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
  MEDIUM: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
  HIGH: 'bg-accent-rose/10 text-accent-rose border-accent-rose/30',
  CRITICAL: 'bg-accent-rose/20 text-accent-rose border-accent-rose/50 shadow-glow-rose',
};

interface SeverityPillProps {
  severity: string;
  className?: string;
  dot?: boolean;
}

export function SeverityPill({ severity, className, dot }: SeverityPillProps) {
  const { t } = useI18n();
  const key = (severity.toUpperCase() as Severity) in colors ? (severity.toUpperCase() as Severity) : 'INFO';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        colors[key],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {ticketPriorityLabel(t, key)}
    </span>
  );
}
