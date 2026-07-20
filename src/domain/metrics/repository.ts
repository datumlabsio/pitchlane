import { LeadStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  buildCreatedAtRange,
  comparisonWindow,
  formatDateFilterLabel,
  resolveWindow,
  TRACKING_START_DATE,
  type DateWindow,
  type ResolvedWindow,
} from '@/lib/date-window';

// Shared lead filter: date window + the comma-separated `accountId` profile filter
// (same multi-select convention the leads list uses).
function leadWhere(window: DateWindow, accountId?: string): Prisma.LeadWhereInput {
  const createdAt = buildCreatedAtRange(window);
  const accountIds = (accountId ?? '').split(',').filter(Boolean);
  return {
    ...(createdAt ? { createdAt } : {}),
    ...(accountIds.length ? { accountId: { in: accountIds } } : {}),
  };
}

// Statuses that mean the lead was ever qualified (i.e. it moved past the initial screening)
const QUALIFIED_STATUSES: LeadStatus[] = [
  LeadStatus.QUALIFIED,
  LeadStatus.APPLIED,
  LeadStatus.CLIENT_REPLIED,
  LeadStatus.INTRO_CALL,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.HIRES_OTHER,
  LeadStatus.JOB_CLOSED,
  LeadStatus.WON,
  LeadStatus.LOST,
];

// Statuses that mean a proposal was actually submitted
const APPLIED_STATUSES: LeadStatus[] = [
  LeadStatus.APPLIED,
  LeadStatus.CLIENT_REPLIED,
  LeadStatus.INTRO_CALL,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.HIRES_OTHER,
  LeadStatus.JOB_CLOSED,
  LeadStatus.WON,
  LeadStatus.LOST,
];

// Statuses that mean the client actually responded to our proposal. These are the
// positive-signal stages after applying. HIRES_OTHER / JOB_CLOSED / LOST are counted
// as "applied" but NOT "replied" — they are applied-then-dead-end outcomes with no
// confirmed client reply. Adjust these arrays if your pipeline semantics differ.
const REPLIED_STATUSES: LeadStatus[] = [
  LeadStatus.CLIENT_REPLIED,
  LeadStatus.INTRO_CALL,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.WON,
];

// Statuses that mean an intro call was booked (reached the call stage or beyond).
const CALL_STATUSES: LeadStatus[] = [
  LeadStatus.INTRO_CALL,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.WON,
];

// Blended connect cost. $0.15 is the per-connect rate on the 300-for-$45 plan.
// Kept as a constant for now; move to a Settings value if the rate needs to vary.
export const COST_PER_CONNECT = 0.15;

export async function getPipelineFunnel(window: DateWindow = {}, accountId?: string) {
  const base = leadWhere(window, accountId);
  const [total, qualified, applied, replied, callBooked, won] = await Promise.all([
    prisma.lead.count({ where: base }),
    prisma.lead.count({ where: { ...base, status: { in: QUALIFIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: { in: APPLIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: { in: REPLIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: { in: CALL_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: LeadStatus.WON } }),
  ]);
  return { total, qualified, applied, replied, callBooked, won };
}

export async function getStatusBreakdown(window: DateWindow = {}, accountId?: string) {
  const groups = await prisma.lead.groupBy({
    by: ['status'],
    where: leadWhere(window, accountId),
    _count: { _all: true },
    orderBy: { _count: { status: 'desc' } },
  });
  return groups.map((g) => ({ status: g.status as LeadStatus, count: g._count._all }));
}

export async function getRecentQualifiedLeads(window: DateWindow = {}) {
  const createdAt = buildCreatedAtRange(window);
  const leads = await prisma.lead.findMany({
    where: { status: { in: [LeadStatus.QUALIFIED, LeadStatus.NEW] }, ...(createdAt ? { createdAt } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: {
      account: true,
      evaluations: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return leads.map((lead) => ({
    id: lead.id,
    title: lead.title,
    profileName: lead.account.personName,
    status: lead.status,
    score: lead.evaluations[0]?.score ?? 0,
    budget: lead.extractedBudget || 'Unknown',
    createdAt: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(lead.createdAt),
  }));
}

export async function getDashboardMetrics(window: DateWindow = {}, accountId?: string) {
  const base = leadWhere(window, accountId);
  const [totalLeads, won, applied, qualified] = await Promise.all([
    prisma.lead.count({ where: base }),
    prisma.lead.count({ where: { ...base, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { ...base, status: { in: APPLIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: { in: QUALIFIED_STATUSES } } }),
  ]);

  const qualRate = totalLeads === 0 ? 0 : Math.round((qualified / totalLeads) * 100);
  const winRate = applied === 0 ? 0 : Math.round((won / applied) * 100);

  return [
    { label: 'Leads Received', value: String(totalLeads), note: 'Across all active profiles' },
    { label: 'Qualification Rate', value: `${qualRate}%`, note: 'Passed scoring evaluation' },
    { label: 'Applications Sent', value: String(applied), note: 'Proposals submitted' },
    { label: 'Win Rate', value: `${winRate}%`, note: `${won} contract${won !== 1 ? 's' : ''} won` },
  ];
}

// Denominator floor below which a rate's delta is unreliable (e.g. win rate on a
// handful of applications). Configurable here; PRD default is 10.
export const MIN_RATE_DENOMINATOR = 10;

type CoreCounts = { totalLeads: number; won: number; applied: number; qualified: number };

async function coreCounts(range: { start?: Date; end?: Date } | undefined, accountId?: string): Promise<CoreCounts> {
  const accountIds = (accountId ?? '').split(',').filter(Boolean);
  const createdAt = range && (range.start || range.end)
    ? { ...(range.start ? { gte: range.start } : {}), ...(range.end ? { lte: range.end } : {}) }
    : undefined;
  const base: Prisma.LeadWhereInput = {
    ...(createdAt ? { createdAt } : {}),
    ...(accountIds.length ? { accountId: { in: accountIds } } : {}),
  };
  const [totalLeads, won, applied, qualified] = await Promise.all([
    prisma.lead.count({ where: base }),
    prisma.lead.count({ where: { ...base, status: LeadStatus.WON } }),
    prisma.lead.count({ where: { ...base, status: { in: APPLIED_STATUSES } } }),
    prisma.lead.count({ where: { ...base, status: { in: QUALIFIED_STATUSES } } }),
  ]);
  return { totalLeads, won, applied, qualified };
}

export type HeroMetricDelta =
  | { kind: 'hidden' }
  | { kind: 'no-prior-data' }
  | { kind: 'n-too-small' }
  | { kind: 'count'; previous: number; absDelta: number; pctDelta: number | null; direction: 'up' | 'down' | 'flat' }
  | { kind: 'pp'; previous: number; ppDelta: number; direction: 'up' | 'down' | 'flat' };

export type HeroMetric = {
  label: string;
  value: string;
  note: string;
  delta: HeroMetricDelta;
};

function directionOf(delta: number): 'up' | 'down' | 'flat' {
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
}

/**
 * Hero cards for Metrics → Pipeline, with a week-over-week (or equivalent)
 * comparison sub-line per §3.3/§3.4 of the date-presets/WoW-deltas PRD. Every
 * metric here "improves upward", so `direction: 'up'` is always the green case.
 */
export async function getPipelineHeroMetrics(window: DateWindow = {}, accountId?: string): Promise<HeroMetric[]> {
  const resolved = resolveWindow(window);
  const current = await coreCounts({ start: resolved.start, end: resolved.end }, accountId);

  const qualRate = current.totalLeads === 0 ? 0 : Math.round((current.qualified / current.totalLeads) * 100);
  const winRate = current.applied === 0 ? 0 : Math.round((current.won / current.applied) * 100);

  let previous: CoreCounts | null = null;
  if (resolved.kind !== 'none') {
    const cmp = comparisonWindow(resolved);
    // A comparison window that starts before tracking began would be a truncated
    // (wrong) baseline, whether it's entirely or only partially before that date.
    if (cmp && cmp.start.getTime() >= TRACKING_START_DATE.getTime()) {
      previous = await coreCounts(cmp, accountId);
    }
  }

  const noPriorData = resolved.kind !== 'none' && previous === null;

  function countDelta(currentValue: number, previousValue: number): HeroMetricDelta {
    if (resolved.kind === 'none') return { kind: 'hidden' };
    if (previous === null) return noPriorData ? { kind: 'no-prior-data' } : { kind: 'hidden' };
    const absDelta = currentValue - previousValue;
    const pctDelta = previousValue === 0 ? null : Math.round((absDelta / previousValue) * 100);
    return { kind: 'count', previous: previousValue, absDelta, pctDelta, direction: directionOf(absDelta) };
  }

  function rateDelta(currentRate: number, previousRate: number, currentDen: number, previousDen: number): HeroMetricDelta {
    if (resolved.kind === 'none') return { kind: 'hidden' };
    if (previous === null) return noPriorData ? { kind: 'no-prior-data' } : { kind: 'hidden' };
    if (currentDen < MIN_RATE_DENOMINATOR || previousDen < MIN_RATE_DENOMINATOR) return { kind: 'n-too-small' };
    const ppDelta = Math.round((currentRate - previousRate) * 10) / 10;
    return { kind: 'pp', previous: previousRate, ppDelta, direction: directionOf(ppDelta) };
  }

  const prevQualRate = previous && previous.totalLeads > 0 ? Math.round((previous.qualified / previous.totalLeads) * 100) : 0;
  const prevWinRate = previous && previous.applied > 0 ? Math.round((previous.won / previous.applied) * 100) : 0;

  return [
    {
      label: 'Leads Received',
      value: String(current.totalLeads),
      note: 'Across all active profiles',
      delta: countDelta(current.totalLeads, previous?.totalLeads ?? 0),
    },
    {
      label: 'Qualification Rate',
      value: `${qualRate}%`,
      note: 'Passed scoring evaluation',
      delta: rateDelta(qualRate, prevQualRate, current.totalLeads, previous?.totalLeads ?? 0),
    },
    {
      label: 'Applications Sent',
      value: String(current.applied),
      note: 'Proposals submitted',
      delta: countDelta(current.applied, previous?.applied ?? 0),
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      note: `${current.won} contract${current.won !== 1 ? 's' : ''} won`,
      delta: rateDelta(winRate, prevWinRate, current.applied, previous?.applied ?? 0),
    },
  ];
}

type ProfileVolumeCounts = {
  accountId: string;
  profile: string;
  leads: number;
  qualified: number;
  applied: number;
  replied: number;
  callBooked: number;
  won: number;
  connects: number;
  spend: number;
};

/** Cohort counts by lead/application createdAt — same mapping the pipeline hero cards use. */
async function profileVolumeCounts(window: DateWindow, accountId?: string): Promise<ProfileVolumeCounts[]> {
  const createdAt = buildCreatedAtRange(window);
  const accountIds = (accountId ?? '').split(',').filter(Boolean);
  const accounts = await prisma.account.findMany({
    where: { isActive: true, ...(accountIds.length ? { id: { in: accountIds } } : {}) },
    include: {
      leads: { where: createdAt ? { createdAt } : undefined, select: { status: true } },
      applications: { where: createdAt ? { createdAt } : undefined, select: { connectsSpent: true } },
    },
    orderBy: { name: 'asc' },
  });

  return accounts.map((account) => {
    const leads = account.leads.length;
    const qualified = account.leads.filter((l) => QUALIFIED_STATUSES.includes(l.status as LeadStatus)).length;
    const applied = account.leads.filter((l) => APPLIED_STATUSES.includes(l.status as LeadStatus)).length;
    const replied = account.leads.filter((l) => REPLIED_STATUSES.includes(l.status as LeadStatus)).length;
    const callBooked = account.leads.filter((l) => CALL_STATUSES.includes(l.status as LeadStatus)).length;
    const won = account.leads.filter((l) => l.status === LeadStatus.WON).length;
    const connects = account.applications.reduce((sum, a) => sum + (a.connectsSpent ?? 0), 0);
    return {
      accountId: account.id,
      profile: account.personName,
      leads,
      qualified,
      applied,
      replied,
      callBooked,
      won,
      connects,
      spend: connects * COST_PER_CONNECT,
    };
  });
}

export async function getProfilePerformanceRows(window: DateWindow = {}, accountId?: string) {
  const rows = await profileVolumeCounts(window, accountId);
  return rows.map((row) => ({
    ...row,
    qualRate: row.leads > 0 ? Math.round((row.qualified / row.leads) * 100) : 0,
    applyRate: row.qualified > 0 ? Math.round((row.applied / row.qualified) * 100) : 0,
    replyRate: row.applied > 0 ? Math.round((row.replied / row.applied) * 100) : 0,
    bookRate: row.applied > 0 ? Math.round((row.callBooked / row.applied) * 100) : 0,
    winRate: row.applied > 0 ? Math.round((row.won / row.applied) * 100) : 0,
    connectsPerApp: row.applied > 0 ? row.connects / row.applied : 0,
    costPerReply: row.replied > 0 ? row.spend / row.replied : null,
    costPerCall: row.callBooked > 0 ? row.spend / row.callBooked : null,
    costPerWin: row.won > 0 ? row.spend / row.won : null,
  }));
}

export type ProfileConversionMetricDelta =
  | { kind: 'hidden' }
  | { kind: 'no-prior-data' }
  | { kind: 'na' }
  | {
      kind: 'count' | 'money';
      previous: number;
      currentValue: number;
      absDelta: number;
      pctDelta: number | null;
      direction: 'up' | 'down' | 'flat';
    };

export type ProfileConversionCell = {
  value: number;
  delta: ProfileConversionMetricDelta;
};

export type ProfileConversionTableRow = {
  profile: string;
  accountId?: string;
  leads: ProfileConversionCell;
  qualified: ProfileConversionCell;
  applied: ProfileConversionCell;
  replied: ProfileConversionCell;
  calls: ProfileConversionCell;
  won: ProfileConversionCell;
  connects: ProfileConversionCell;
  spend: ProfileConversionCell;
};

export type ProfileConversionTable = {
  comparisonLabel: string;
  rows: ProfileConversionTableRow[];
  total: ProfileConversionTableRow;
};

function conversionDelta(
  currentValue: number,
  previousValue: number,
  showComparison: boolean,
  noPriorData: boolean,
  kind: 'count' | 'money' = 'count',
): ProfileConversionMetricDelta {
  if (!showComparison) return { kind: 'hidden' };
  if (noPriorData) return { kind: 'no-prior-data' };
  if (currentValue === 0 && previousValue === 0) return { kind: 'na' };

  const absDelta = currentValue - previousValue;
  if (absDelta === 0) {
    return { kind, previous: previousValue, currentValue, absDelta: 0, pctDelta: null, direction: 'flat' };
  }

  const pctDelta = previousValue === 0 ? null : Math.round((absDelta / previousValue) * 100);
  return {
    kind,
    previous: previousValue,
    currentValue,
    absDelta,
    pctDelta,
    direction: absDelta > 0 ? 'up' : 'down',
  };
}

function emptyVolume(accountId: string, profile: string): ProfileVolumeCounts {
  return {
    accountId,
    profile,
    leads: 0,
    qualified: 0,
    applied: 0,
    replied: 0,
    callBooked: 0,
    won: 0,
    connects: 0,
    spend: 0,
  };
}

function sumVolumes(rows: ProfileVolumeCounts[]): Omit<ProfileVolumeCounts, 'accountId' | 'profile'> {
  return rows.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads,
      qualified: acc.qualified + r.qualified,
      applied: acc.applied + r.applied,
      replied: acc.replied + r.replied,
      callBooked: acc.callBooked + r.callBooked,
      won: acc.won + r.won,
      connects: acc.connects + r.connects,
      spend: acc.spend + r.spend,
    }),
    { leads: 0, qualified: 0, applied: 0, replied: 0, callBooked: 0, won: 0, connects: 0, spend: 0 },
  );
}

function buildConversionCells(
  current: Omit<ProfileVolumeCounts, 'accountId' | 'profile'>,
  previous: Omit<ProfileVolumeCounts, 'accountId' | 'profile'>,
  showComparison: boolean,
  noPriorData: boolean,
): Omit<ProfileConversionTableRow, 'profile' | 'accountId'> {
  const mk = (
    key: keyof Omit<ProfileVolumeCounts, 'accountId' | 'profile'>,
    kind: 'count' | 'money' = 'count',
  ): ProfileConversionCell => ({
    value: current[key],
    delta: conversionDelta(current[key], previous[key], showComparison, noPriorData, kind),
  });
  return {
    leads: mk('leads'),
    qualified: mk('qualified'),
    applied: mk('applied'),
    replied: mk('replied'),
    calls: mk('callBooked'),
    won: mk('won'),
    connects: mk('connects'),
    spend: mk('spend', 'money'),
  };
}

function windowFromResolved(resolved: ResolvedWindow): DateWindow {
  if (!resolved.start && !resolved.end) return { since: 'any' };
  const from = resolved.start?.toISOString().slice(0, 10);
  const to = resolved.end?.toISOString().slice(0, 10);
  return { from, to };
}

/**
 * Per-profile conversion volume with comparison deltas (Profiles tab table).
 * Pure counts + spend — rates live in the Pipeline funnel.
 */
export async function getProfileConversionTable(
  window: DateWindow = {},
  accountId?: string,
): Promise<ProfileConversionTable> {
  const resolved = resolveWindow(window);
  const cmp = comparisonWindow(resolved);
  const noPriorData = Boolean(cmp && cmp.start.getTime() < TRACKING_START_DATE.getTime());
  const showComparison = resolved.kind !== 'none' && cmp !== null;
  const previousWindow: DateWindow =
    cmp && !noPriorData ? windowFromResolved({ start: cmp.start, end: cmp.end, kind: resolved.kind, partial: false }) : { since: 'any' };

  const [currentRows, previousRows] = await Promise.all([
    profileVolumeCounts(window, accountId),
    showComparison && !noPriorData ? profileVolumeCounts(previousWindow, accountId) : Promise.resolve([] as ProfileVolumeCounts[]),
  ]);

  const previousById = new Map(previousRows.map((r) => [r.accountId, r]));

  const rows: ProfileConversionTableRow[] = currentRows.map((current) => {
    const previous = previousById.get(current.accountId) ?? emptyVolume(current.accountId, current.profile);
    return {
      profile: current.profile,
      accountId: current.accountId,
      ...buildConversionCells(current, previous, showComparison, noPriorData),
    };
  });

  const currentTotal = sumVolumes(currentRows);
  const previousTotal = sumVolumes(previousRows);

  return {
    comparisonLabel: formatDateFilterLabel(window, 'this_week'),
    rows,
    total: {
      profile: 'Total',
      ...buildConversionCells(currentTotal, previousTotal, showComparison, noPriorData),
    },
  };
}

function median(values: number[]): number | null {
  return percentile(values, 50);
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/** Provisional SLA targets — surfaced in UI with a tooltip. */
export const SLA_TARGET_HOURS = 3;
export const SLA_TREND_TARGET = 70;
const SLA_TARGET_MS = SLA_TARGET_HOURS * 60 * 60 * 1000;
const MAX_LATENCY_MS = 72 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const LATENCY_BUCKET_DEFS = [
  { label: '<1h', minMs: 0, maxMs: HOUR_MS },
  { label: '1–3h', minMs: HOUR_MS, maxMs: 3 * HOUR_MS },
  { label: '3–6h', minMs: 3 * HOUR_MS, maxMs: 6 * HOUR_MS },
  { label: '6–12h', minMs: 6 * HOUR_MS, maxMs: 12 * HOUR_MS },
  { label: '12–24h', minMs: 12 * HOUR_MS, maxMs: 24 * HOUR_MS },
  { label: '>24h', minMs: 24 * HOUR_MS, maxMs: MAX_LATENCY_MS + 1 },
] as const;

export type LatencyBucket = { label: string; count: number };

export type LeadAppliedLatencyStat = {
  p50Ms: number | null;
  p75Ms: number | null;
  p90Ms: number | null;
  n: number;
  reached: number;
  missingAppliedDate: number;
  excludedCount: number;
  withinSlaCount: number;
  buckets: LatencyBucket[];
};

export type WithinSlaScorecard = {
  pct: number;
  n: number;
  delta: HeroMetricDelta;
};

export type WeeklySlaPoint = {
  weekStart: string;
  label: string;
  pct: number;
  n: number;
  partial: boolean;
  lowSample: boolean;
};

/** Retained for downstream latency stats (not shown in v1 UI). */
export type LatencyStat = {
  p50Ms: number | null;
  p75Ms: number | null;
  n: number;
  reached: number;
};

type LeadLatencyRow = {
  status: LeadStatus;
  createdAt: Date;
  applications: { appliedAt: Date | null }[];
};

type LeadAppliedLatencyResult = {
  responseMs: number[];
  reached: number;
  missingAppliedDate: number;
  excludedCount: number;
};

function mondayStartUTC(d: Date): Date {
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() + diffToMonday);
  return start;
}

function addUtcDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function weekLabel(weekStart: Date): string {
  return `${MONTH_SHORT[weekStart.getUTCMonth()]} ${weekStart.getUTCDate()}`;
}

function earliestAppliedAt(applications: { appliedAt: Date | null }[]): number | null {
  const times = applications
    .map((a) => a.appliedAt?.getTime())
    .filter((t): t is number => typeof t === 'number');
  return times.length ? Math.min(...times) : null;
}

/** latency = min(application.appliedAt) - lead.createdAt; 0–72h valid range. */
function computeLeadAppliedLatencies(leads: LeadLatencyRow[]): LeadAppliedLatencyResult {
  const responseMs: number[] = [];
  let reached = 0;
  let missingAppliedDate = 0;
  let excludedCount = 0;

  for (const lead of leads) {
    if (!APPLIED_STATUSES.includes(lead.status)) continue;
    reached++;

    const appliedAt = earliestAppliedAt(lead.applications);
    if (appliedAt == null) {
      missingAppliedDate++;
      continue;
    }

    const gap = appliedAt - lead.createdAt.getTime();
    if (gap < 0 || gap > MAX_LATENCY_MS) {
      excludedCount++;
      continue;
    }
    responseMs.push(gap);
  }

  if (excludedCount > 0 && process.env.NODE_ENV === 'development') {
    console.warn(`[latency] excluded ${excludedCount} leads with gap < 0 or > 72h`);
  }

  return { responseMs, reached, missingAppliedDate, excludedCount };
}

function buildLatencyBuckets(responseMs: number[]): LatencyBucket[] {
  return LATENCY_BUCKET_DEFS.map(({ label, minMs, maxMs }) => ({
    label,
    count: responseMs.filter((ms) => ms >= minMs && ms < maxMs).length,
  }));
}

function buildLeadAppliedStat(result: LeadAppliedLatencyResult): LeadAppliedLatencyStat {
  const { responseMs, reached, missingAppliedDate, excludedCount } = result;
  const withinSlaCount = responseMs.filter((ms) => ms <= SLA_TARGET_MS).length;
  return {
    p50Ms: median(responseMs),
    p75Ms: percentile(responseMs, 75),
    p90Ms: percentile(responseMs, 90),
    n: responseMs.length,
    reached,
    missingAppliedDate,
    excludedCount,
    withinSlaCount,
    buckets: buildLatencyBuckets(responseMs),
  };
}

function withinSlaPct(responseMs: number[]): number {
  if (responseMs.length === 0) return 0;
  const within = responseMs.filter((ms) => ms <= SLA_TARGET_MS).length;
  return Math.round((within / responseMs.length) * 100);
}

function buildWithinSlaDelta(
  currentPct: number,
  previousPct: number,
  resolved: ResolvedWindow,
  noPriorData: boolean,
): HeroMetricDelta {
  if (resolved.kind === 'none') return { kind: 'hidden' };
  if (noPriorData) return { kind: 'no-prior-data' };
  const ppDelta = Math.round((currentPct - previousPct) * 10) / 10;
  return { kind: 'pp', previous: previousPct, ppDelta, direction: directionOf(ppDelta) };
}

async function fetchLeadsForLatency(window: DateWindow, accountId?: string) {
  return prisma.lead.findMany({
    where: leadWhere(window, accountId),
    select: {
      status: true,
      createdAt: true,
      applications: { select: { appliedAt: true } },
      events: {
        where: { type: 'lead.status_updated' },
        select: { createdAt: true, payload: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

/**
 * Lead → applied latency analytics (PRD v1):
 *  - response: lead.createdAt → min(application.appliedAt), 0–72h valid
 *  - withinSla: % of valid leads applied within SLA_TARGET_HOURS, vs prior window
 *  - applyToReply / replyToCall retained for future UI (reply volume too low for v1)
 */
export async function getLatencyMetrics(window: DateWindow = {}, accountId?: string) {
  const resolved = resolveWindow(window);
  const leads = await fetchLeadsForLatency(window, accountId);
  const current = computeLeadAppliedLatencies(leads);
  const currentPct = withinSlaPct(current.responseMs);

  const cmp = comparisonWindow(resolved);
  const noPriorData = Boolean(cmp && cmp.start.getTime() < TRACKING_START_DATE.getTime());
  let previousPct = 0;
  if (cmp && !noPriorData) {
    const prevWindow = windowFromResolved({ start: cmp.start, end: cmp.end, kind: resolved.kind, partial: false });
    const prevLeads = await fetchLeadsForLatency(prevWindow, accountId);
    previousPct = withinSlaPct(computeLeadAppliedLatencies(prevLeads).responseMs);
  }

  const applyToReplyMs: number[] = [];
  const replyToCallMs: number[] = [];
  let repliedReached = 0;
  let callReached = 0;

  for (const lead of leads) {
    const isReplied = REPLIED_STATUSES.includes(lead.status);
    const isCall = CALL_STATUSES.includes(lead.status);
    if (isReplied) repliedReached++;
    if (isCall) callReached++;

    const appliedAt = earliestAppliedAt(lead.applications);
    const firstReached: Partial<Record<string, number>> = {};
    for (const ev of lead.events) {
      const to = (ev.payload as { to?: string } | null)?.to;
      if (to && firstReached[to] === undefined) firstReached[to] = ev.createdAt.getTime();
    }

    const applyBaseline = appliedAt ?? firstReached[LeadStatus.APPLIED] ?? null;
    const repliedAt = firstReached[LeadStatus.CLIENT_REPLIED] ?? null;
    const callAt = firstReached[LeadStatus.INTRO_CALL] ?? null;

    if (isReplied && applyBaseline != null && repliedAt != null && repliedAt >= applyBaseline) {
      applyToReplyMs.push(repliedAt - applyBaseline);
    }
    if (isCall && repliedAt != null && callAt != null && callAt >= repliedAt) {
      replyToCallMs.push(callAt - repliedAt);
    }
  }

  const downstreamStat = (values: number[], reached: number): LatencyStat => ({
    p50Ms: median(values),
    p75Ms: percentile(values, 75),
    n: values.length,
    reached,
  });

  return {
    response: buildLeadAppliedStat(current),
    withinSla: {
      pct: currentPct,
      n: current.responseMs.length,
      delta: buildWithinSlaDelta(currentPct, previousPct, resolved, noPriorData),
    },
    applyToReply: downstreamStat(applyToReplyMs, repliedReached),
    replyToCall: downstreamStat(replyToCallMs, callReached),
  };
}

/**
 * Weekly SLA trend: Monday-start weeks, % of valid leads applied within SLA_TARGET_HOURS.
 * Stays weekly regardless of other chart grain toggles.
 */
export async function getWeeklySlaSeries(window: DateWindow = {}, accountId?: string): Promise<WeeklySlaPoint[]> {
  const resolved = resolveWindow(window);
  const rangeStart = resolved.start ?? TRACKING_START_DATE;
  const rangeEnd = resolved.end ?? new Date();
  const now = new Date();

  const leads = await fetchLeadsForLatency(window, accountId);
  const byWeek = new Map<string, number[]>();

  for (const lead of leads) {
    if (!APPLIED_STATUSES.includes(lead.status)) continue;
    const appliedAt = earliestAppliedAt(lead.applications);
    if (appliedAt == null) continue;
    const gap = appliedAt - lead.createdAt.getTime();
    if (gap < 0 || gap > MAX_LATENCY_MS) continue;

    const weekStart = mondayStartUTC(lead.createdAt);
    const key = weekStart.toISOString().slice(0, 10);
    const arr = byWeek.get(key) ?? [];
    arr.push(gap);
    byWeek.set(key, arr);
  }

  const weeks: WeeklySlaPoint[] = [];
  let cursor = mondayStartUTC(rangeStart);
  const endMonday = mondayStartUTC(rangeEnd);

  while (cursor.getTime() <= endMonday.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    const latencies = byWeek.get(key) ?? [];
    const n = latencies.length;
    const within = latencies.filter((ms) => ms <= SLA_TARGET_MS).length;
    const weekEnd = addUtcDays(cursor, 7);
    weeks.push({
      weekStart: key,
      label: weekLabel(cursor),
      pct: n > 0 ? Math.round((within / n) * 100) : 0,
      n,
      partial: weekEnd.getTime() > now.getTime(),
      lowSample: n < 5,
    });
    cursor = addUtcDays(cursor, 7);
  }

  return weeks;
}

export type PipelineDay = { date: string; received: number; applied: number };

/**
 * Daily pipeline ACTIVITY (not cohort — the funnel already covers conversion):
 *  - received: leads counted by the day they arrived (lead.createdAt)
 *  - applied: applications counted by the day they were sent (application.appliedAt,
 *    falling back to createdAt when appliedAt was never recorded, so nothing is dropped)
 * Returned at day grain (UTC); the client rolls it up to weekly/monthly. Only days
 * with activity are included.
 */
export async function getPipelineActivitySeries(
  window: DateWindow = {},
  accountId?: string,
): Promise<PipelineDay[]> {
  const range = buildCreatedAtRange(window);
  const accountIds = (accountId ?? '').split(',').filter(Boolean);
  const inRange = (d: Date) =>
    (!range?.gte || d >= range.gte) && (!range?.lte || d <= range.lte);

  const [leads, apps] = await Promise.all([
    prisma.lead.findMany({ where: leadWhere(window, accountId), select: { createdAt: true } }),
    prisma.application.findMany({
      where: accountIds.length ? { accountId: { in: accountIds } } : {},
      select: { appliedAt: true, createdAt: true },
    }),
  ]);

  const byDay = new Map<string, PipelineDay>();
  const bump = (when: Date, key: 'received' | 'applied') => {
    const day = when.toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { date: day, received: 0, applied: 0 };
    d[key] += 1;
    byDay.set(day, d);
  };

  for (const l of leads) bump(l.createdAt, 'received'); // already window-filtered by leadWhere
  for (const a of apps) {
    const activityDate = a.appliedAt ?? a.createdAt;
    if (inRange(activityDate)) bump(activityDate, 'applied');
  }

  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type KeywordRow = {
  keyword: string;
  matched: number;
  qualified: number;
  applied: number;
  qualRate: number;
  applyRate: number;
};
export type KeywordQualification = {
  rows: KeywordRow[];
  totalLeads: number;
  leadsWithKeywords: number;
};

/**
 * Qualification rate per matched keyword — which alert/target words bring good jobs
 * vs noise. Uses each lead's latest evaluation's matchedKeywords (normalized to
 * lowercase). A lead matches several keywords, so it counts under each (mentions >
 * leads). `leadsWithKeywords` vs `totalLeads` shows coverage — leads with no matched
 * keyword aren't represented.
 */
export async function getKeywordQualification(
  window: DateWindow = {},
  accountId?: string,
): Promise<KeywordQualification> {
  const leads = await prisma.lead.findMany({
    where: leadWhere(window, accountId),
    select: {
      status: true,
      // Not every evaluation records keywords (the LLM judge doesn't; the rule scorer
      // does). Pull them newest-first and take the most recent one that actually has any.
      evaluations: { orderBy: { createdAt: 'desc' }, select: { matchedKeywords: true } },
    },
  });

  const map = new Map<string, { keyword: string; matched: number; qualified: number; applied: number }>();
  let leadsWithKeywords = 0;

  for (const lead of leads) {
    const source = lead.evaluations.find((e) => e.matchedKeywords.length > 0)?.matchedKeywords ?? [];
    const kws = [...new Set(source.map((k) => k.trim().toLowerCase()).filter(Boolean))];
    if (kws.length) leadsWithKeywords += 1;
    const isQualified = QUALIFIED_STATUSES.includes(lead.status);
    const isApplied = APPLIED_STATUSES.includes(lead.status);
    for (const k of kws) {
      const row = map.get(k) ?? { keyword: k, matched: 0, qualified: 0, applied: 0 };
      row.matched += 1;
      if (isQualified) row.qualified += 1;
      if (isApplied) row.applied += 1;
      map.set(k, row);
    }
  }

  const rows = [...map.values()]
    .map((r) => ({
      ...r,
      qualRate: r.matched > 0 ? Math.round((r.qualified / r.matched) * 100) : 0,
      applyRate: r.matched > 0 ? Math.round((r.applied / r.matched) * 100) : 0,
    }))
    .sort((a, b) => b.matched - a.matched);

  return { rows, totalLeads: leads.length, leadsWithKeywords };
}
