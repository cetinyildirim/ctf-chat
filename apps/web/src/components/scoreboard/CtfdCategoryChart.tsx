'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { CtfdCategoryStatDto } from '@sydt/shared';

const CATEGORY_COLORS: Record<string, string> = {
  WEB: '#22d3ee',
  PWN: '#fb7185',
  REV: '#a78bfa',
  CRYPTO: '#34d399',
  FORENSICS: '#fbbf24',
  OSINT: '#f472b6',
  MISC: '#94a3b8',
};

function colorForCategory(name: string): string {
  const key = name.trim().toUpperCase();
  return CATEGORY_COLORS[key] ?? '#94a3b8';
}

interface Props {
  categories: CtfdCategoryStatDto[];
}

export function CtfdCategoryChart({ categories }: Props) {
  const data = categories.map((c) => ({
    category: c.name,
    solves: c.solves,
    fill: colorForCategory(c.name),
  }));

  if (!data.length) {
    return <p className="py-8 text-center text-sm text-fg-subtle">—</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="category" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} />
        <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} />
        <Tooltip
          contentStyle={{
            background: 'rgba(15,17,23,0.95)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="solves" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
