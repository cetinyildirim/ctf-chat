'use client';

import * as React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { useI18n } from '@/components/providers/LocaleProvider';
import type { ScoreboardEntry, SolveTimelinePoint } from '@sydt/shared';

interface Props {
  points: SolveTimelinePoint[];
  entries: ScoreboardEntry[];
}

interface SeriesPoint {
  ts: number;
  [teamId: string]: number;
}

export function TimelineChart({ points, entries }: Props) {
  const { t } = useI18n();
  const top = entries.slice(0, 5);

  const series = React.useMemo<SeriesPoint[]>(() => {
    if (points.length === 0) return [];
    const teamIds = top.map((e) => e.team.id);
    const teamSet = new Set(teamIds);
    const sorted = [...points].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const totals: Record<string, number> = Object.fromEntries(teamIds.map((id) => [id, 0]));
    const out: SeriesPoint[] = [];
    for (const p of sorted) {
      if (!teamSet.has(p.teamId)) continue;
      totals[p.teamId] = (totals[p.teamId] ?? 0) + p.points;
      out.push({ ts: new Date(p.at).getTime(), ...totals });
    }
    if (out.length === 0) {
      const now = Date.now();
      return [{ ts: now, ...totals }];
    }
    return out;
  }, [points, top]);

  if (top.length === 0) {
    return (
      <div className="grid h-72 place-items-center text-sm text-muted-fg">{t.timelineNoSolves}</div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {top.map((t) => (
              <linearGradient id={`g-${t.team.id}`} key={t.team.id} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={t.team.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={t.team.color} stopOpacity={0.4} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t) => format(new Date(t as number), 'HH:mm')}
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(12,19,34,0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              fontSize: 12,
              color: '#e5e7eb',
            }}
            labelFormatter={(t) => format(new Date(t as number), 'HH:mm:ss')}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
            formatter={(_, entry) => (
              <span style={{ color: 'rgba(255,255,255,0.75)' }}>{(entry as { value?: string }).value}</span>
            )}
          />
          {top.map((t) => (
            <Line
              key={t.team.id}
              type="monotone"
              dataKey={t.team.id}
              name={t.team.name}
              stroke={`url(#g-${t.team.id})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={400}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
