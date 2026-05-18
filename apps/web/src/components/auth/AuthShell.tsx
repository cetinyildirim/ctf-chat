'use client';
import * as React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Activity, Terminal } from 'lucide-react';
import Link from 'next/link';
import { GlassPanel } from '@/components/common/GlassPanel';
import { useI18n } from '@/components/providers/LocaleProvider';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { t } = useI18n();

  return (
    <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_1fr]">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden flex-col justify-between lg:flex"
      >
        <Link href="/" className="inline-flex items-center gap-2 self-start">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-accent-cyan to-accent-violet text-bg-deep font-bold shadow-glow-cyan">
            SY
          </div>
          <div className="font-mono text-lg font-semibold tracking-wide text-fg">
            SYDT<span className="text-accent-cyan">.</span>
          </div>
        </Link>

        <div className="space-y-6">
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent-cyan">
              {t.authShellEyebrow}
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-fg">
              <span className="text-gradient-cyan">{t.authShellHeadlineAccent}</span>
              {t.authShellHeadlineTrail}
            </h1>
            <p className="max-w-md text-sm text-fg-subtle">{t.authShellSubtitle}</p>
          </div>

          <ul className="grid gap-2 text-sm text-fg-subtle">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-cyan" />
              {t.authShellBulletRbac}
            </li>
            <li className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent-violet" />
              {t.authShellBulletRealtime}
            </li>
            <li className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-accent-emerald" />
              {t.authShellBulletHighlight}
            </li>
          </ul>
        </div>

        <div className="font-mono text-[11px] text-muted-fg">{t.authShellFooter}</div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GlassPanel strong tone="cyan" glow className="p-8">
          <div className="mb-6 space-y-1">
            <h2 className="text-2xl font-semibold text-fg">{title}</h2>
            <p className="text-sm text-fg-subtle">{subtitle}</p>
          </div>
          {children}
          {footer ? <div className="mt-6 border-t border-white/8 pt-4 text-sm text-fg-subtle">{footer}</div> : null}
        </GlassPanel>
      </motion.div>
    </div>
  );
}
