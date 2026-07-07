import { LeadStatus, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildCreatedAtRange, type DateWindow } from '@/lib/date-window';

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

export type PipelineDay = { date: string; received: number; qualified: number; applied: number };

/**
 * Daily pipeline activity, cohort by lead.createdAt: for leads that arrived on each
 * day, how many were qualified and applied to. Returned at day grain (UTC); the
 * client rolls it up to weekly/monthly. Only days with activity are included.
 */
export async function getPipelineActivitySeries(
  window: DateWindow = {},
  accountId?: string,
): Promise<PipelineDay[]> {
  const leads = await prisma.lead.findMany({
    where: leadWhere(window, accountId),
    select: { createdAt: true, status: true },
  });
  const byDay = new Map<string, PipelineDay>();
  for (const l of leads) {
    const key = l.createdAt.toISOString().slice(0, 10);
    const d = byDay.get(key) ?? { date: key, received: 0, qualified: 0, applied: 0 };
    d.received += 1;
    if (QUALIFIED_STATUSES.includes(l.status)) d.qualified += 1;
    if (APPLIED_STATUSES.includes(l.status)) d.applied += 1;
    byDay.set(key, d);
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
