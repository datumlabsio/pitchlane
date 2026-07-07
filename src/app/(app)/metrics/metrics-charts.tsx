'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, Legend, XAxis, YAxis } from 'recharts';
import { LeadStatus } from '@/domain/enums';

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { leadStatusLabelMap } from '@/domain/leads/types';
import type { VisibilityPoint } from '@/domain/profile-stats/types';

// ─── Time-grain rollup helpers ──────────────────────────────────────────────────

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Grain = 'daily' | 'weekly' | 'monthly';

// Monday (UTC) of the week containing the yyyy-MM-dd date, as yyyy-MM-dd.
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  const diff = (d.getUTCDay() + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function grainKey(iso: string, grain: Grain): string {
  if (grain === 'daily') return iso;
  if (grain === 'monthly') return iso.slice(0, 7); // yyyy-MM
  return mondayOf(iso);
}

function grainLabel(key: string, grain: Grain): string {
  if (grain === 'monthly') {
    const [y, m] = key.split('-');
    return `${MON[Number(m) - 1]} '${y.slice(2)}`;
  }
  const d = new Date(`${key}T00:00:00.000Z`);
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

const GRAIN_OPTIONS: { value: Grain; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function GrainToggle({
  value,
  onChange,
  options = GRAIN_OPTIONS,
}: {
  value: Grain;
  onChange: (g: Grain) => void;
  options?: { value: Grain; label: string }[];
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-stone-200">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs font-medium transition ${
            value === o.value ? 'bg-amber-500 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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

type FunnelData = {
  total: number;
  qualified: number;
  applied: number;
  replied: number;
  callBooked: number;
  won: number;
};

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
  const replyRate = data.applied === 0 ? 0 : Math.round((data.replied / data.applied) * 100);
  const bookRate = data.applied === 0 ? 0 : Math.round((data.callBooked / data.applied) * 100);
  const winRate = data.applied === 0 ? 0 : Math.round((data.won / data.applied) * 100);

  return (
    <div className="space-y-3">
      <FunnelRow label="Leads received" count={data.total} total={data.total} color="bg-stone-400" subLabel="100%" />
      <FunnelRow label="Qualified" count={data.qualified} total={data.total} color="bg-amber-400" subLabel={`${qualRate}%`} />
      <FunnelRow label="Applied" count={data.applied} total={data.total} color="bg-amber-600" subLabel={`${applyRate}% of qual.`} />
      <FunnelRow label="Client replied" count={data.replied} total={data.total} color="bg-sky-500" subLabel={`${replyRate}% of applied`} />
      <FunnelRow label="Call booked" count={data.callBooked} total={data.total} color="bg-sky-600" subLabel={`${bookRate}% of applied`} />
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
  accountId: string;
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
  const router = useRouter();
  const chartData = data.map((r) => ({
    accountId: r.accountId,
    profile: r.profile.split(' ')[0], // first name for label
    leads: r.leads,
    qualified: r.qualified,
    applied: r.applied,
  }));

  function handleBarClick(state: { activeIndex?: number | string | null }) {
    const idx = typeof state?.activeIndex === 'number' ? state.activeIndex : Number(state?.activeIndex);
    if (Number.isInteger(idx) && idx >= 0 && chartData[idx]) {
      router.push(`/leads?accountId=${chartData[idx].accountId}`);
    }
  }

  return (
    <ChartContainer config={chartConfig} className="h-52 w-full">
      <BarChart
        data={chartData}
        barGap={2}
        barCategoryGap="28%"
        onClick={handleBarClick}
        className="cursor-pointer"
      >
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

// ─── Pipeline activity over time ────────────────────────────────────────────────

type PipelineDay = { date: string; received: number; qualified: number; applied: number };

const pipelineConfig = {
  received: { label: 'Leads received', color: 'oklch(0.83 0.02 250)' },
  applied: { label: 'Applied', color: 'oklch(0.6 0.15 50)' },
  applyRate: { label: 'Apply rate %', color: 'oklch(0.55 0.13 230)' },
};

function rollupPipeline(data: PipelineDay[], grain: Grain) {
  const map = new Map<string, { key: string; received: number; qualified: number; applied: number }>();
  for (const d of data) {
    const key = grainKey(d.date, grain);
    const cur = map.get(key) ?? { key, received: 0, qualified: 0, applied: 0 };
    cur.received += d.received;
    cur.qualified += d.qualified;
    cur.applied += d.applied;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((x) => ({
      label: grainLabel(x.key, grain),
      received: x.received,
      applied: x.applied,
      qualified: x.qualified,
      applyRate: x.qualified > 0 ? Math.round((x.applied / x.qualified) * 100) : 0,
    }));
}

export function PipelineActivityChart({ data }: { data: PipelineDay[] }) {
  const [grain, setGrain] = useState<Grain>('weekly');
  const rows = rollupPipeline(data, grain);
  const interval = rows.length > 16 ? Math.ceil(rows.length / 12) : 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <GrainToggle value={grain} onChange={setGrain} />
      </div>
      <ChartContainer config={pipelineConfig} className="h-72 w-full">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="oklch(0.93 0 0)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={interval} tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }} />
          <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }} width={28} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }} width={36} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="left" dataKey="received" fill="var(--color-received)" radius={[3, 3, 0, 0]} />
          <Bar yAxisId="left" dataKey="applied" fill="var(--color-applied)" radius={[3, 3, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="applyRate" stroke="var(--color-applyRate)" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}

// ─── Profile visibility over time ───────────────────────────────────────────────

const visibilityConfig = {
  views: { label: 'Views', color: 'oklch(0.6 0.13 230)' },
  invites: { label: 'Invites', color: 'oklch(0.7 0.15 50)' },
  impressions: { label: 'Impressions', color: 'oklch(0.72 0.13 160)' },
  clicks: { label: 'Clicks', color: 'oklch(0.62 0.2 300)' },
};

// Visibility stats are stored weekly, so only weekly (native) and monthly make sense.
const VISIBILITY_GRAINS: { value: Grain; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function rollupVisibility(data: VisibilityPoint[], grain: Grain) {
  if (grain === 'weekly') {
    return data.map((d) => ({
      label: d.label,
      views: d.views,
      invites: d.invites,
      impressions: d.impressions,
      clicks: d.clicks,
    }));
  }
  const map = new Map<string, { key: string; views: number; invites: number; impressions: number; clicks: number }>();
  for (const d of data) {
    const key = grainKey(d.week, 'monthly');
    const cur = map.get(key) ?? { key, views: 0, invites: 0, impressions: 0, clicks: 0 };
    cur.views += d.views;
    cur.invites += d.invites;
    cur.impressions += d.impressions;
    cur.clicks += d.clicks;
    map.set(key, cur);
  }
  return [...map.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((x) => ({ label: grainLabel(x.key, 'monthly'), views: x.views, invites: x.invites, impressions: x.impressions, clicks: x.clicks }));
}

export function VisibilityChart({ data }: { data: VisibilityPoint[] }) {
  const [grain, setGrain] = useState<Grain>('weekly');
  const rows = rollupVisibility(data, grain);
  const interval = rows.length > 16 ? Math.ceil(rows.length / 12) : 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <GrainToggle value={grain} onChange={setGrain} options={VISIBILITY_GRAINS} />
      </div>
      <ChartContainer config={visibilityConfig} className="h-64 w-full">
        <LineChart data={rows} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="oklch(0.93 0 0)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={interval} tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'oklch(0.55 0 0)' }} width={28} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="views" stroke="var(--color-views)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="invites" stroke="var(--color-invites)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="impressions" stroke="var(--color-impressions)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="clicks" stroke="var(--color-clicks)" strokeWidth={2} dot={false} />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
