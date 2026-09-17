'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon } from 'lucide-react';
import { incidentsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/query/client';
import { TopBar } from '@/components/layout/TopBar';
import { GlassPanel } from '@/components/common/GlassPanel';
import { SeverityPill } from '@/components/common/SeverityPill';
import { Avatar } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/common/Skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Section } from '@/components/common/Section';
import { MessageMarkdown } from '@/components/chat/MessageMarkdown';
import { relative } from '@/lib/format/time';
import { cn } from '@/lib/utils';
import { Permission } from '@sydt/shared';
import { useAuthStore } from '@/store/auth';
import { useServerStore } from '@/store/server';
import { useI18n } from '@/components/providers/LocaleProvider';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'border-accent-rose/40 bg-accent-rose/10 text-accent-rose',
  INVESTIGATING: 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber',
  MITIGATED: 'border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan',
  RESOLVED: 'border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald',
  POSTMORTEM: 'border-accent-violet/40 bg-accent-violet/10 text-accent-violet',
};

export default function IncidentsPage() {
  const me = useAuthStore((s) => s.user);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const allowed = !!me?.permissions.includes(Permission.INCIDENT_VIEW);
  const { t } = useI18n();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.incidents(activeServerId ?? undefined),
    queryFn: () => incidentsApi.list(activeServerId ?? undefined),
    enabled: allowed,
  });

  if (!allowed) {
    return (
      <div className="flex h-full flex-col">
        <TopBar title={t.incidentsPageTitle} />
        <EmptyState icon={AlertOctagon} title={t.incidentsStaffOnlyTitle} description={t.incidentsStaffOnlyDesc} />
      </div>
    );
  }

  const countSuffix = `${data?.length ?? 0} ${t.incidentsRecordSuffix}`;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar
        title={
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-accent-rose" />
            <span>{t.incidentsPageTitle}</span>
          </div>
        }
        subtitle={data !== undefined ? countSuffix : '—'}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)
            : null}

          {!isLoading && (data ?? []).length === 0 ? (
            <EmptyState icon={AlertOctagon} title={t.incidentsEmptyTitle} description={t.incidentsEmptyDesc} />
          ) : null}

          {(data ?? []).map((inc) => (
            <Link key={inc.id} href={`/incidents/${inc.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/40 rounded-xl">
              <GlassPanel
                className="p-4 transition-colors hover:bg-white/[0.02]"
                tone={inc.severity === 'CRITICAL' || inc.severity === 'HIGH' ? 'rose' : 'amber'}
              >
                <Section
                  title={
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{inc.title}</span>
                      <SeverityPill severity={inc.severity} dot />
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          STATUS_COLOR[inc.status] ?? 'border-white/10 bg-white/5 text-fg-subtle',
                        )}
                      >
                        {inc.status}
                      </span>
                    </div>
                  }
                  description={
                    <span className="flex items-center gap-2 text-[11px]">
                      <Avatar name={inc.openedBy.displayName} src={inc.openedBy.avatarUrl} size="xs" />
                      <span>
                        {t.incidentOpenedBy} {inc.openedBy.displayName}
                      </span>
                      <span>· {relative(inc.createdAt)}</span>
                      {inc.resolvedAt ? <span>· {relative(inc.resolvedAt)}</span> : null}
                    </span>
                  }
                />
                <div className="mt-2">
                  <MessageMarkdown content={inc.description} />
                </div>
              </GlassPanel>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
