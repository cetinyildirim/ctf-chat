'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#22d3ee',
  '#06b6d4',
  '#34d399',
  '#10b981',
  '#a78bfa',
  '#8b5cf6',
  '#f472b6',
  '#fb7185',
  '#fbbf24',
  '#f97316',
  '#94a3b8',
  '#e2e8f0',
  '#0ea5e9',
  '#6366f1',
  '#ec4899',
  '#ef4444',
];

export function ColorPalettePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}) {
  const [custom, setCustom] = React.useState(value);

  React.useEffect(() => {
    setCustom(value);
  }, [value]);

  return (
    <div className="space-y-2">
      {label ? <div className="text-xs font-medium text-fg-subtle">{label}</div> : null}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            className={cn(
              'h-8 w-8 rounded-lg border-2 transition-transform hover:scale-110',
              value.toLowerCase() === c.toLowerCase() ? 'border-fg ring-2 ring-accent-cyan/50' : 'border-white/20',
            )}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(custom) ? custom : '#22d3ee'}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
          className="h-9 w-12 cursor-pointer rounded border border-border/80 bg-transparent"
        />
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={() => {
            if (/^#[0-9a-fA-F]{6}$/.test(custom.trim())) onChange(custom.trim());
          }}
          className="h-9 flex-1 rounded-md border border-border/80 bg-bg-deep px-2 font-mono text-sm text-fg"
          placeholder="#22d3ee"
        />
      </div>
    </div>
  );
}
