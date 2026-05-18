import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function Section({ title, description, right, children, className }: SectionProps) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {title ? (
              <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">{title}</h2>
            ) : null}
            {description ? <p className="text-xs text-muted-fg">{description}</p> : null}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
