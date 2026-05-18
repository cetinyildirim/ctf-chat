'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/components/providers/LocaleProvider';
import { applyDomTheme, useAppTheme, type ThemeChoice } from '@/components/providers/ThemeProvider';
import { useAuthStore } from '@/store/auth';
import { usersApi } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { t } = useI18n();
  const theme = useAppTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const pick = async (next: ThemeChoice) => {
    applyDomTheme(next);
    window.localStorage.setItem('sydt-theme', next);
    if (user) {
      try {
        const updated = await usersApi.patchMe({ theme: next });
        setUser(updated);
      } catch {
        /* DOM already updated */
      }
    }
  };

  const Icon = theme === 'light' ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t.themeMenuTitle}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-fg-subtle transition-colors',
            'hover:border-accent-cyan/35 hover:bg-accent-cyan/10 hover:text-accent-cyan',
            'data-[state=open]:border-accent-cyan/40 data-[state=open]:bg-accent-cyan/12 data-[state=open]:text-accent-cyan',
            className,
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t.themeMenuTitle}</DropdownMenuLabel>
        <DropdownMenuItem
          className={cn(theme === 'dark' && 'text-accent-cyan')}
          onClick={() => void pick('dark')}
        >
          <Moon className="h-4 w-4" />
          {t.themeDark}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(theme === 'light' && 'text-accent-cyan')}
          onClick={() => void pick('light')}
        >
          <Sun className="h-4 w-4" />
          {t.themeLight}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
