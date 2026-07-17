import type { ProfileStat } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  buildCreatedAtRange,
  comparisonWindow,
  formatDateFilterLabel,
  resolveWindow,
  type DateWindow,
  type ResolvedWindow,
} from '@/lib/date-window';

import type {
  ProfileStatInput,
  ProfileStatView,
  ProfileVisibilityCell,
  ProfileVisibilityMetricDelta,
  ProfileVisibilityTable,
  ProfileVisibilityTableRow,
  VisibilityPoint,
} from './types';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parse a yyyy-MM-dd string into a UTC-midnight Date for a DATE column.
function parseWeekStart(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid week date.');
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function label(d: Date): string {
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function mapStat(s: ProfileStat): ProfileStatView {
  return {
    id: s.id,
    accountId: s.accountId,
    weekStart: isoDate(s.weekStart),
    views: s.views,
    invites: s.invites,
    impressions: s.impressions,
    clicks: s.clicks,
  };
}

/** All stat rows grouped by account, newest week first. Used to hydrate the profile Sheet. */
export async function listProfileStatsGrouped(): Promise<Record<string, ProfileStatView[]>> {
  const rows = await prisma.profileStat.findMany({ orderBy: { weekStart: 'desc' } });
  const grouped: Record<string, ProfileStatView[]> = {};
  for (const r of rows) (grouped[r.accountId] ??= []).push(mapStat(r));
  return grouped;
}

/** Create or update the row for a profile's week (unique on accountId + weekStart). */
export async function upsertProfileStat(input: ProfileStatInput): Promise<ProfileStatView> {
  const account = await prisma.account.findUnique({ where: { id: input.accountId }, select: { id: true } });
  if (!account) throw new Error('Profile not found.');
  const weekStart = parseWeekStart(input.weekStart);
  const data = {
    views: input.views,
    invites: input.invites,
    impressions: input.impressions,
    clicks: input.clicks,
  };
  const stat = await prisma.profileStat.upsert({
    where: { accountId_weekStart: { accountId: input.accountId, weekStart } },
    create: { accountId: input.accountId, weekStart, ...data },
    update: data,
  });
  return mapStat(stat);
}

export async function deleteProfileStat(id: string): Promise<void> {
  await prisma.profileStat.delete({ where: { id } });
}

/**
 * Combined visibility time-series over the date window, summed across the filtered
 * profiles, one point per week. Filtered on weekStart (the week the stats describe).
 */
export async function getVisibilitySeries(
  window: DateWindow = {},
  accountId?: string,
): Promise<VisibilityPoint[]> {
  const range = buildCreatedAtRange(window);
  const accountIds = (accountId ?? '').split(',').filter(Boolean);
  const rows = await prisma.profileStat.findMany({
    where: {
      ...(range ? { weekStart: range } : {}),
      ...(accountIds.length ? { accountId: { in: accountIds } } : {}),
    },
    orderBy: { weekStart: 'asc' },
  });

  const byWeek = new Map<string, VisibilityPoint>();
  for (const r of rows) {
    const key = isoDate(r.weekStart);
    const point = byWeek.get(key) ?? { week: key, label: label(r.weekStart), views: 0, invites: 0, impressions: 0, clicks: 0 };
    point.views += r.views;
    point.invites += r.invites;
    point.impressions += r.impressions;
    point.clicks += r.clicks;
    byWeek.set(key, point);
  }
  return [...byWeek.values()];
}

type PeriodTotals = {
  views: number;
  invites: number;
  impressions: number;
  clicks: number;
  hasEntry: boolean;
};

const EMPTY_TOTALS: PeriodTotals = { views: 0, invites: 0, impressions: 0, clicks: 0, hasEntry: false };

function addDaysUTC(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

/** Whether a Monday-start week belongs in a resolved window (monthly = fully inside the month). */
function weekInResolvedWindow(weekStart: Date, resolved: ResolvedWindow): boolean {
  if (!resolved.start || !resolved.end) return false;
  if (resolved.kind === 'calendar-month') {
    const weekEnd = addDaysUTC(weekStart, 6);
    return weekStart.getTime() >= resolved.start.getTime() && weekEnd.getTime() <= resolved.end.getTime();
  }
  return weekStart.getTime() >= resolved.start.getTime() && weekStart.getTime() <= resolved.end.getTime();
}

function sumPeriod(stats: ProfileStat[], accountId: string | null, resolved: ResolvedWindow): PeriodTotals {
  const rows = stats.filter(
    (s) => (accountId === null || s.accountId === accountId) && weekInResolvedWindow(s.weekStart, resolved),
  );
  if (rows.length === 0) return EMPTY_TOTALS;
  return {
    hasEntry: true,
    views: rows.reduce((sum, r) => sum + r.views, 0),
    invites: rows.reduce((sum, r) => sum + r.invites, 0),
    impressions: rows.reduce((sum, r) => sum + r.impressions, 0),
    clicks: rows.reduce((sum, r) => sum + r.clicks, 0),
  };
}

function profileVisibilityDelta(
  currentValue: number,
  previousValue: number,
  currentHasEntry: boolean,
  previousHasEntry: boolean,
  showComparison: boolean,
): ProfileVisibilityMetricDelta {
  if (!showComparison) return { kind: 'hidden' };
  if (!previousHasEntry) return { kind: 'no-data' };
  if (currentHasEntry && previousHasEntry && currentValue === 0 && previousValue === 0) return { kind: 'na' };

  const absDelta = currentValue - previousValue;
  if (absDelta === 0) {
    return {
      kind: 'count',
      previous: previousValue,
      currentValue,
      absDelta: 0,
      pctDelta: null,
      direction: 'flat',
    };
  }

  const pctDelta = previousValue === 0 ? null : Math.round((absDelta / previousValue) * 100);
  return {
    kind: 'count',
    previous: previousValue,
    currentValue,
    absDelta,
    pctDelta,
    direction: absDelta > 0 ? 'up' : 'down',
  };
}

function buildVisibilityCells(
  current: PeriodTotals,
  previous: PeriodTotals,
  showComparison: boolean,
): Pick<ProfileVisibilityTableRow, 'views' | 'invites' | 'impressions' | 'clicks'> {
  const mk = (metric: 'views' | 'invites' | 'impressions' | 'clicks'): ProfileVisibilityCell => ({
    value: current[metric],
    delta: profileVisibilityDelta(
      current[metric],
      previous[metric],
      current.hasEntry,
      previous.hasEntry,
      showComparison,
    ),
  });
  return {
    views: mk('views'),
    invites: mk('invites'),
    impressions: mk('impressions'),
    clicks: mk('clicks'),
  };
}

/**
 * Per-profile visibility totals with comparison deltas for the Profiles tab table.
 * Weeks are Monday-start; monthly presets sum only weeks fully inside the month.
 */
export async function getProfileVisibilityTable(
  window: DateWindow = {},
  accountId?: string,
): Promise<ProfileVisibilityTable> {
  const resolved = resolveWindow(window);
  const cmp = comparisonWindow(resolved);
  const showComparison = resolved.kind !== 'none' && cmp !== null;
  const previousResolved: ResolvedWindow =
    cmp && resolved.start && resolved.end
      ? { start: cmp.start, end: cmp.end, kind: resolved.kind, partial: false }
      : { kind: 'none', partial: false };

  const accountIds = (accountId ?? '').split(',').filter(Boolean);
  const accounts = await prisma.account.findMany({
    where: { isActive: true, ...(accountIds.length ? { id: { in: accountIds } } : {}) },
    orderBy: { name: 'asc' },
    select: { id: true, personName: true },
  });

  const fetchStart = [resolved.start, previousResolved.start].filter((d): d is Date => d != null);
  const fetchEnd = [resolved.end, previousResolved.end].filter((d): d is Date => d != null);
  const minWeek = fetchStart.length ? new Date(Math.min(...fetchStart.map((d) => d.getTime()))) : undefined;
  const maxWeek = fetchEnd.length ? new Date(Math.max(...fetchEnd.map((d) => d.getTime()))) : undefined;

  const stats = await prisma.profileStat.findMany({
    where: {
      ...(accountIds.length ? { accountId: { in: accountIds } } : {}),
      ...(minWeek || maxWeek
        ? {
            weekStart: {
              ...(minWeek ? { gte: minWeek } : {}),
              ...(maxWeek ? { lte: maxWeek } : {}),
            },
          }
        : {}),
    },
  });

  const rows: ProfileVisibilityTableRow[] = accounts.map((account) => {
    const current = sumPeriod(stats, account.id, resolved);
    const previous = sumPeriod(stats, account.id, previousResolved);
    return {
      profile: account.personName,
      accountId: account.id,
      ...buildVisibilityCells(current, previous, showComparison),
    };
  });

  const currentTotal = sumPeriod(stats, null, resolved);
  const previousTotal = sumPeriod(stats, null, previousResolved);
  const total: ProfileVisibilityTableRow = {
    profile: 'Total',
    ...buildVisibilityCells(currentTotal, previousTotal, showComparison),
  };

  return {
    comparisonLabel: formatDateFilterLabel(window, 'this_week'),
    rows,
    total,
  };
}
