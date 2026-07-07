import type { ProfileStat } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { buildCreatedAtRange, type DateWindow } from '@/lib/date-window';

import type { ProfileStatInput, ProfileStatView, VisibilityPoint } from './types';

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
    const point = byWeek.get(key) ?? { label: label(r.weekStart), views: 0, invites: 0, impressions: 0, clicks: 0 };
    point.views += r.views;
    point.invites += r.invites;
    point.impressions += r.impressions;
    point.clicks += r.clicks;
    byWeek.set(key, point);
  }
  return [...byWeek.values()];
}
