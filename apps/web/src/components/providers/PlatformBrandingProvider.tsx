'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PlatformBranding } from '@sydt/shared';
import { configApi } from '@/lib/api/endpoints';
import { useI18n } from '@/components/providers/LocaleProvider';

const BrandingContext = React.createContext<PlatformBranding | null>(null);

/** Server-side default tagline; while untouched it follows the viewer's language. */
const DEFAULT_TAGLINE = 'CTF Operations Console';

export function PlatformBrandingProvider({ children }: { children: React.ReactNode }) {
  const { data } = useQuery({
    queryKey: ['platform-branding'] as const,
    queryFn: configApi.branding,
    staleTime: 60_000,
  });
  return <BrandingContext.Provider value={data ?? null}>{children}</BrandingContext.Provider>;
}

export function usePlatformBranding(): PlatformBranding & { adminPanelTitle: string } {
  const row = React.useContext(BrandingContext);
  const { t } = useI18n();
  return {
    platformTitle: row?.platformTitle ?? 'SYDT',
    platformTagline:
      !row?.platformTagline || row.platformTagline === DEFAULT_TAGLINE
        ? t.platformTaglineFallback
        : row.platformTagline,
    workspaceLabel: row?.workspaceLabel ?? t.workspaceLabel,
    workspaceTitle: row?.workspaceTitle ?? t.workspaceTitle,
    uploadMaxMb: row?.uploadMaxMb ?? 100,
    adminPanelTitle: row?.platformTitle ? `${row.platformTitle} · ${t.adminPanelSuffix}` : t.adminPanelTitle,
  };
}
