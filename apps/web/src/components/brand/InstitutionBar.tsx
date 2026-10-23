'use client';

import { cn } from '@/lib/utils';
import { useI18n } from '@/components/providers/LocaleProvider';
import { TAF_CYBER_DEFENCE_IMAGE } from './BrandLogo';
import { TurkishFlag } from './TurkishFlag';

/** TAF Cyber Defence Command emblem and name, with the Turkish flag. */
export function InstitutionBar({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={TAF_CYBER_DEFENCE_IMAGE}
        alt={t.institutionName}
        className={cn('shrink-0 rounded-full drop-shadow-[0_0_10px_rgba(59,130,246,0.45)]', compact ? 'h-10 w-10' : 'h-14 w-14')}
        draggable={false}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <div className={cn('font-semibold tracking-wide text-fg', compact ? 'text-xs' : 'text-sm')}>
          {t.institutionName}
        </div>
        <div className={cn('mt-0.5 font-mono uppercase tracking-[0.16em] text-fg-subtle', compact ? 'text-[9px]' : 'text-[10px]')}>
          {t.institutionNameAlt}
        </div>
      </div>
      <TurkishFlag
        title={t.turkishFlag}
        className={cn('shrink-0 rounded-[3px] shadow-[0_2px_10px_-2px_rgba(227,10,23,0.6)] ring-1 ring-white/15', compact ? 'h-5 w-[1.875rem]' : 'h-7 w-[2.625rem]')}
      />
    </div>
  );
}
