'use client';
import * as React from 'react';
import { motion } from 'framer-motion';
import { LifeBuoy, Megaphone, MessagesSquare, ShieldCheck, Trophy, Users, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { GlassPanel } from '@/components/common/GlassPanel';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { InstitutionBar } from '@/components/brand/InstitutionBar';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { Dict } from '@/i18n/dict';
import { cn } from '@/lib/utils';
import { rulesHref } from '@/lib/legal';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

type Feature = { icon: LucideIcon; tone: string; title: keyof Dict; body: keyof Dict };

const FEATURES: Feature[] = [
  { icon: MessagesSquare, tone: 'text-accent-cyan bg-accent-cyan/10 ring-accent-cyan/25', title: 'authFeatureChatTitle', body: 'authFeatureChatBody' },
  { icon: LifeBuoy, tone: 'text-accent-rose bg-accent-rose/10 ring-accent-rose/25', title: 'authFeatureTicketsTitle', body: 'authFeatureTicketsBody' },
  { icon: Megaphone, tone: 'text-accent-amber bg-accent-amber/10 ring-accent-amber/25', title: 'authFeatureAnnounceTitle', body: 'authFeatureAnnounceBody' },
  { icon: Trophy, tone: 'text-accent-emerald bg-accent-emerald/10 ring-accent-emerald/25', title: 'authFeatureScoreTitle', body: 'authFeatureScoreBody' },
  { icon: Users, tone: 'text-accent-violet bg-accent-violet/10 ring-accent-violet/25', title: 'authFeatureTeamsTitle', body: 'authFeatureTeamsBody' },
  { icon: ShieldCheck, tone: 'text-accent-cyan bg-accent-cyan/10 ring-accent-cyan/25', title: 'authFeatureSecureTitle', body: 'authFeatureSecureBody' },
];

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { t, locale } = useI18n();

  return (
    <div className="relative grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 hidden h-72 w-72 rounded-full bg-accent-violet/20 blur-3xl lg:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-accent-cyan/15 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="relative hidden flex-col gap-8 lg:flex"
      >
        <InstitutionBar className="max-w-xl" />

        <Link href="/" className="self-start" aria-label="SYDT CHAT">
          <BrandLogo className="gap-4 [&>span:last-child]:text-2xl" markClassName="h-16 w-20" />
        </Link>

        <div className="space-y-6">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-cyan">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-cyan opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-cyan" />
              </span>
              {t.authShellEyebrow}
            </span>
            <h1 className="text-4xl font-semibold leading-tight text-fg xl:text-[2.6rem]">
              <span className="text-gradient-cyan">{t.authShellHeadlineAccent}</span>
              {t.authShellHeadlineTrail}
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-fg-subtle">{t.authShellSubtitle}</p>
          </div>

          <ul className="grid max-w-xl grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.15 + i * 0.06 }}
                className="group flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 transition-colors hover:border-accent-cyan/30"
              >
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1', f.tone)}>
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-fg">{t[f.title]}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-fg-subtle">{t[f.body]}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-fg">
          <span>{t.authShellFooter}</span>
          <span aria-hidden>·</span>
          <Link href={rulesHref(locale)} className="text-fg-subtle underline-offset-2 hover:text-accent-cyan hover:underline">
            {t.rulesLinkLabel}
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto w-full max-w-md lg:max-w-none"
      >
        <div className="mb-6 space-y-4 lg:hidden">
          <InstitutionBar compact />
          <Link href="/" className="flex justify-center" aria-label="SYDT CHAT">
            <BrandLogo />
          </Link>
        </div>
        <GlassPanel strong tone="cyan" glow className="p-8">
          <div className="mb-6 space-y-1">
            <h2 className="text-2xl font-semibold text-fg">{title}</h2>
            <p className="text-sm text-fg-subtle">{subtitle}</p>
          </div>
          {children}
          {footer ? <div className="mt-6 border-t border-white/8 pt-4 text-sm text-fg-subtle">{footer}</div> : null}
        </GlassPanel>
        <p className="mt-4 text-center font-mono text-[11px] text-muted-fg lg:hidden">
          {t.authShellFooter} ·{' '}
          <Link href={rulesHref(locale)} className="text-fg-subtle hover:text-accent-cyan hover:underline">
            {t.rulesLinkLabel}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
