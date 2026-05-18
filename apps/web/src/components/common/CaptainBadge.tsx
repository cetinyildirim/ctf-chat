'use client';

import { Star } from 'lucide-react';
import { useI18n } from '@/components/providers/LocaleProvider';
import { cn } from '@/lib/utils';

export function CaptainBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-md border border-accent-emerald/45 bg-accent-emerald/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-emerald',
        className,
      )}
      title={t.roleTeamCaptain}
    >
      <Star className="h-3 w-3" aria-hidden />
      {t.captainBadgeShort}
    </span>
  );
}
