'use client';

import * as React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { makeQueryClient } from '@/lib/query/client';
import { AuthBootstrapper } from '@/components/providers/AuthBootstrapper';
import { SocketBridge } from '@/components/providers/SocketBridge';
import { LocaleProvider } from '@/components/providers/LocaleProvider';
import { PlatformBrandingProvider } from '@/components/providers/PlatformBrandingProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <AuthBootstrapper />
        <ThemeProvider
          localeChildren={
            // SocketBridge lives inside LocaleProvider: incoming notifications are
            // rendered in the viewer's language.
            <LocaleProvider>
              <SocketBridge />
              <PlatformBrandingProvider>{children}</PlatformBrandingProvider>
            </LocaleProvider>
          }
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
