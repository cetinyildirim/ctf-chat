import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)}>
      {Icon ? (
        <div className="rounded-full bg-white/5 p-3 ring-1 ring-white/10">
          <Icon className="h-6 w-6 text-fg-subtle" />
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        {description ? <p className="max-w-sm text-sm text-fg-subtle">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
