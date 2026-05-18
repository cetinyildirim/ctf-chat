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
import type { SolveTimelinePoint } from '@sydt/shared';
import * as React from 'react';

interface Props {
  points: SolveTimelinePoint[];
  categories: Map<string, string>;
}

const CATEGORY_COLORS: Record<string, string> = {
  WEB: '#22d3ee',
  PWN: '#fb7185',
  REV: '#a78bfa',
  CRYPTO: '#34d399',
  FORENSICS: '#fbbf24',
  OSINT: '#f472b6',
  MISC: '#94a3b8',
};

export function CategoryChart({ points, categories }: Props) {
  const data = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of points) {
      const cat = categories.get(p.challengeId);
      if (!cat) continue;
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([category, solves]) => ({ category, solves, fill: CATEGORY_COLORS[category] ?? '#94a3b8' }))
      .sort((a, b) => b.solves - a.solves);
  }, [points, categories]);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="category" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.08)' }} width={28} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: 'rgba(12,19,34,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              fontSize: 12,
              color: '#e5e7eb',
            }}
          />
          <Bar dataKey="solves" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
