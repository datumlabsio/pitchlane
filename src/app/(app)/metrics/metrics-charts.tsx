'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { LeadStatus } from '@prisma/client';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { leadStatusLabelMap } from '@/domain/leads/types';

// ─── Status colour map ────────────────────────────────────────────────────────

const statusColors: Partial<Record<LeadStatus, string>> = {
  NEW: 'bg-stone-200 text-stone-600',
  QUALIFIED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-600',
  APPLIED: 'bg-amber-100 text-amber-700',
  CLIENT_REPLIED: 'bg-amber-200 text-amber-800',
  INTRO_CALL: 'bg-amber-300 text-amber-900',
  FOLLOW_UP: 'bg-amber-100 text-amber-700',
  ONGOING_DISCUSSION: 'bg-sky-100 text-sky-700',
  HIRES_OTHER: 'bg-slate-100 text-slate-600',
  QUALIFIED_LOST: 'bg-slate-100 text-slate-600',
  JOB_CLOSED: 'bg-slate-100 text-slate-600',
  WON: 'bg-emerald-200 text-emerald-800',
  LOST: 'bg-rose-100 text-rose-600',
  CLOSED: 'bg-stone-100 text-stone-500',
};

// ─── Funnel ───────────────────────────────────────────────────────────────────

type FunnelData = { total: number; qualified: number; applied: number; won: number };

function FunnelRow({
  label, count, total, color, subLabel,
}: {
  label: string; count: number; total: number; color: string; subLabel?: string;
}) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <div className="flex items-center gap-4">
      <p className="w-32 shrink-0 text-sm text-stone-600">{label}</p>
      <div className="flex-1 h-6 overflow-hidden rounded-full bg-stone-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex w-24 shrink-0 items-center justify-end gap-2 text-right">
        <span className="text-sm font-semibold tabular-nums text-stone-900">{count}</span>
        {subLabel ? (
          <span className="text-xs tabular-nums text-stone-400">{subLabel}</span>
        ) : (
          <span className="text-xs tabular-nums text-stone-400">{pct}%</span>
        )}
      </div>
    </div>
  );
}

export function PipelineFunnel({ data }: { data: FunnelData }) {
  const qualRate = data.total === 0 ? 0 : Math.round((data.qualified / data.total) * 100);
  const applyRate = data.qualified === 0 ? 0 : Math.round((data.applied / data.qualified) * 100);
  const winRate = data.applied === 0 ? 0 : Math.round((data.won / data.applied) * 100);

  return (
    <div className="space-y-3">
      <FunnelRow label="Leads received" count={data.total} total={data.total} color="bg-stone-400" subLabel="100%" />
      <FunnelRow label="Qualified" count={data.qualified} total={data.total} color="bg-amber-400" subLabel={`${qualRate}%`} />
      <FunnelRow label="Applied" count={data.applied} total={data.total} color="bg-amber-600" subLabel={`${applyRate}% of qual.`} />
      <FunnelRow label="Won" count={data.won} total={data.total} color="bg-emerald-500" subLabel={`${winRate}% of applied`} />
    </div>
  );
}

// ─── Status breakdown ─────────────────────────────────────────────────────────

type StatusCount = { status: LeadStatus; count: number };

export function StatusBreakdown({ data }: { data: StatusCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return <p className="text-sm text-stone-400">No leads yet.</p>;

  return (
    <div className="space-y-2">
      {data.map(({ status, count }) => (
        <div key={status} className="flex items-center justify-between gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[status] ?? 'bg-stone-100 text-stone-500'}`}>
            {leadStatusLabelMap[status] ?? status}
          </span>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-stone-400 opacity-60"
                style={{ width: `${Math.round((count / total) * 100)}%` }}
              />
            </div>
            <span className="w-6 text-right text-xs tabular-nums text-stone-500">{count}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Profile bar chart ────────────────────────────────────────────────────────

type ProfileRow = {
  profile: string;
  leads: number;
  qualified: number;
  applied: number;
  won: number;
  connects: number;
  qualRate: number;
  applyRate: number;
  winRate: number;
};

const chartConfig = {
  leads: { label: 'Leads', color: 'oklch(0.87 0 0)' },
  qualified: { label: 'Qualified', color: 'oklch(0.75 0.12 85)' },
  applied: { label: 'Applied', color: 'oklch(0.6 0.15 50)' },
};

export function ProfileBarChart({ data }: { data: ProfileRow[] }) {
  const chartData = data.map((r) => ({
    profile: r.profile.split(' ')[0], // first name for label
    leads: r.leads,
    qualified: r.qualified,
    applied: r.applied,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-52 w-full">
      <BarChart data={chartData} barGap={2} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="oklch(0.93 0 0)" />
        <XAxis
          dataKey="profile"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'oklch(0.55 0 0)' }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }}
          width={24}
        />
        <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'oklch(0.97 0 0)' }} />
        <Bar dataKey="leads" fill="var(--color-leads)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="qualified" fill="var(--color-qualified)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="applied" fill="var(--color-applied)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
