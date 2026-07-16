import { LeadStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  buildCreatedAtRange,
  comparisonWindow,
  resolveWindow,
  TRACKING_START_DATE,
  type DateWindow,
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
  LeadStatus.FOLLOW_UP,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.HIRES_OTHER,
  LeadStatus.QUALIFIED_LOST,
  LeadStatus.JOB_CLOSED,
  LeadStatus.WON,
  LeadStatus.LOST,
];

// Statuses that mean a proposal was actually submitted
const APPLIED_STATUSES: LeadStatus[] = [
  LeadStatus.APPLIED,
  LeadStatus.CLIENT_REPLIED,
  LeadStatus.INTRO_CALL,
  LeadStatus.FOLLOW_UP,
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
  LeadStatus.FOLLOW_UP,
  LeadStatus.ONGOING_DISCUSSION,
  LeadStatus.WON,
];

// Statuses that mean an intro call was booked (reached the call stage or beyond).
const CALL_STATUSES: LeadStatus[] = [
  LeadStatus.INTRO_CALL,
  LeadStatus.FOLLOW_UP,
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
  partial: boolean;
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
      partial: resolved.partial,
      delta: countDelta(current.totalLeads, previous?.totalLeads ?? 0),
    },
    {
      label: 'Qualification Rate',
      value: `${qualRate}%`,
      note: 'Passed scoring evaluation',
      partial: resolved.partial,
      delta: rateDelta(qualRate, prevQualRate, current.totalLeads, previous?.totalLeads ?? 0),
    },
    {
      label: 'Applications Sent',
      value: String(current.applied),
      note: 'Proposals submitted',
      partial: resolved.partial,
      delta: countDelta(current.applied, previous?.applied ?? 0),
    },
    {
      label: 'Win Rate',
      value: `${winRate}%`,
      note: `${current.won} contract${current.won !== 1 ? 's' : ''} won`,
      partial: resolved.partial,
      delta: rateDelta(winRate, prevWinRate, current.applied, previous?.applied ?? 0),
    },
  ];
}

export async function getProfilePerformanceRows(window: DateWindow = {}, accountId?: string) {
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
    const spend = connects * COST_PER_CONNECT;

    return {
      accountId: account.id,
      profile: account.personName,
      leads,
      qualified,
      qualRate: leads > 0 ? Math.round((qualified / leads) * 100) : 0,
      applied,
      applyRate: qualified > 0 ? Math.round((applied / qualified) * 100) : 0,
      replied,
      replyRate: applied > 0 ? Math.round((replied / applied) * 100) : 0,
      callBooked,
      bookRate: applied > 0 ? Math.round((callBooked / applied) * 100) : 0,
      won,
      winRate: applied > 0 ? Math.round((won / applied) * 100) : 0,
      connects,
      spend,
      connectsPerApp: applied > 0 ? connects / applied : 0,
      costPerReply: replied > 0 ? spend / replied : null,
      costPerCall: callBooked > 0 ? spend / callBooked : null,
      costPerWin: won > 0 ? spend / won : null,
    };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Pipeline latency, computed from data we already store:
 *  - response: lead.createdAt → application.appliedAt (how fast we apply after a lead lands)
 *  - applyToReply / replyToCall: from the timestamps of `lead.status_updated` events,
 *    which record every status transition with a `{ from, to }` payload.
 * Each figure is a median (P50) in milliseconds with `n` (leads with a usable pair
 * of timestamps) and `reached` (leads that reached that stage at all). n < reached
 * means the rest are missing a timestamp — e.g. an applied lead with no applied-date.
 */
export async function getLatencyMetrics(window: DateWindow = {}, accountId?: string) {
  const base = leadWhere(window, accountId);
  const leads = await prisma.lead.findMany({
    where: base,
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

  const responseMs: number[] = [];
  const applyToReplyMs: number[] = [];
  const replyToCallMs: number[] = [];
  let appliedReached = 0;
  let repliedReached = 0;
  let callReached = 0;

  for (const lead of leads) {
    const isApplied = APPLIED_STATUSES.includes(lead.status);
    const isReplied = REPLIED_STATUSES.includes(lead.status);
    const isCall = CALL_STATUSES.includes(lead.status);
    if (isApplied) appliedReached++;
    if (isReplied) repliedReached++;
    if (isCall) callReached++;

    // Earliest applied timestamp across this lead's applications.
    const appliedTimes = lead.applications
      .map((a) => a.appliedAt?.getTime())
      .filter((t): t is number => typeof t === 'number');
    const appliedAt = appliedTimes.length ? Math.min(...appliedTimes) : null;

    if (isApplied && appliedAt != null) {
      const gap = appliedAt - lead.createdAt.getTime();
      if (gap >= 0) responseMs.push(gap);
    }

    // First time the lead reached each downstream status, from transition events.
    const firstReached: Partial<Record<string, number>> = {};
    for (const ev of lead.events) {
      const to = (ev.payload as { to?: string } | null)?.to;
      if (to && firstReached[to] === undefined) firstReached[to] = ev.createdAt.getTime();
    }

    // apply → reply: prefer the recorded appliedAt, fall back to the APPLIED transition.
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

  return {
    response: { p50Ms: median(responseMs), n: responseMs.length, reached: appliedReached },
    applyToReply: { p50Ms: median(applyToReplyMs), n: applyToReplyMs.length, reached: repliedReached },
    replyToCall: { p50Ms: median(replyToCallMs), n: replyToCallMs.length, reached: callReached },
  };
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
