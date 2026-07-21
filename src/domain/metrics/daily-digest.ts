import { LeadStatus } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

// The team works in Pakistan time; the digest covers a PKT calendar day.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export type DigestWindow = { start: Date; end: Date; label: string };

/** Yesterday as a PKT calendar day, expressed in UTC instants. */
export function pktYesterdayWindow(now = new Date()): DigestWindow {
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS);
  const pktMidnightUtcMs =
    Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), pktNow.getUTCDate()) - PKT_OFFSET_MS;
  const start = new Date(pktMidnightUtcMs - 24 * 60 * 60 * 1000);
  const label = new Date(start.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
  return { start, end: new Date(pktMidnightUtcMs), label };
}

type ProfileRow = {
  profile: string;
  leadsIn: number;
  qualified: number;
  applied: number;
  // Of that day's applied, how many sent proposals a manager has viewed (so far).
  appliedViewed: number;
  replies: number;
  calls: number;
  won: number;
  connectsSpent: number;
};

export type DailyDigest = {
  windowLabel: string;
  rows: ProfileRow[];
  totals: Omit<ProfileRow, 'profile'>;
  unactionedQualified: number;
  oldestUnactionedDays: number | null;
  // Applications sent in the last 7 days whose proposal no manager has viewed yet —
  // the BU-review backlog.
  unviewedRecentApplied: number;
};

/**
 * Yesterday's per-profile performance. Stage movements are counted from the
 * status_updated event log (the source of truth for transitions since day one);
 * applications from their real appliedAt (so backdated applies land on the right
 * day); "unactioned" is the live count of QUALIFIED leads older than 24h with no
 * application — the pile someone should be working through.
 */
export async function computeDailyDigest(window = pktYesterdayWindow()): Promise<DailyDigest> {
  const [accounts, leadsIn, statusEvents, appliedApps, unactioned, unviewedRecentApplied] =
    await Promise.all([
      prisma.account.findMany({ where: { isActive: true }, select: { id: true, personName: true } }),
      prisma.lead.groupBy({
        by: ['accountId'],
        where: { createdAt: { gte: window.start, lt: window.end } },
        _count: { _all: true },
      }),
      prisma.leadEvent.findMany({
        where: { type: 'lead.status_updated', createdAt: { gte: window.start, lt: window.end } },
        select: { payload: true, lead: { select: { accountId: true } } },
      }),
      prisma.application.findMany({
        where: { appliedAt: { gte: window.start, lt: window.end } },
        select: { accountId: true, connectsSpent: true, proposalViewed: true },
      }),
      prisma.lead.findMany({
        where: {
          status: LeadStatus.QUALIFIED,
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          applications: { none: { appliedAt: { not: null } } },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.application.count({
        where: {
          appliedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          proposalViewed: false,
        },
      }),
    ]);

  const byAccount = new Map<string, ProfileRow>(
    accounts.map((a) => [
      a.id,
      { profile: a.personName, leadsIn: 0, qualified: 0, applied: 0, appliedViewed: 0, replies: 0, calls: 0, won: 0, connectsSpent: 0 },
    ]),
  );

  for (const g of leadsIn) {
    const row = byAccount.get(g.accountId);
    if (row) row.leadsIn = g._count._all;
  }
  for (const ev of statusEvents) {
    const row = byAccount.get(ev.lead.accountId);
    if (!row) continue;
    const to = (ev.payload as { to?: string } | null)?.to;
    if (to === 'QUALIFIED') row.qualified += 1;
    else if (to === 'CLIENT_REPLIED') row.replies += 1;
    else if (to === 'INTRO_CALL') row.calls += 1;
    else if (to === 'WON') row.won += 1;
  }
  for (const app of appliedApps) {
    const row = byAccount.get(app.accountId);
    if (!row) continue;
    row.applied += 1;
    if (app.proposalViewed) row.appliedViewed += 1;
    row.connectsSpent += app.connectsSpent ?? 0;
  }

  const rows = [...byAccount.values()].sort((a, b) => b.leadsIn - a.leadsIn);
  const totals = rows.reduce(
    (t, r) => ({
      leadsIn: t.leadsIn + r.leadsIn,
      qualified: t.qualified + r.qualified,
      applied: t.applied + r.applied,
      appliedViewed: t.appliedViewed + r.appliedViewed,
      replies: t.replies + r.replies,
      calls: t.calls + r.calls,
      won: t.won + r.won,
      connectsSpent: t.connectsSpent + r.connectsSpent,
    }),
    { leadsIn: 0, qualified: 0, applied: 0, appliedViewed: 0, replies: 0, calls: 0, won: 0, connectsSpent: 0 },
  );

  const oldest = unactioned[0]?.createdAt;
  return {
    windowLabel: window.label,
    rows,
    totals,
    unactionedQualified: unactioned.length,
    oldestUnactionedDays: oldest
      ? Math.floor((Date.now() - oldest.getTime()) / (24 * 60 * 60 * 1000))
      : null,
    unviewedRecentApplied,
  };
}

/** Block Kit body (pure — exported for tests). */
export function buildDailyDigestBody(digest: DailyDigest): {
  text: string;
  blocks: Array<Record<string, unknown>>;
} {
  const t = digest.totals;
  const headline = `📊 Daily digest — ${digest.windowLabel}: ${t.leadsIn} leads in · ${t.qualified} qualified · ${t.applied} applied · ${t.replies} replies`;

  const active = digest.rows.filter(
    (r) => r.leadsIn || r.qualified || r.applied || r.replies || r.calls || r.won,
  );
  const profileLines = active.length
    ? active
        .map((r) => {
          const extras = [
            r.applied ? `👀 ${r.appliedViewed}/${r.applied} BU-viewed` : null,
            r.replies ? `${r.replies} replies` : null,
            r.calls ? `${r.calls} calls` : null,
            r.won ? `🏆 ${r.won} won` : null,
            r.connectsSpent ? `${r.connectsSpent} connects` : null,
          ].filter(Boolean);
          return `• *${r.profile}* — ${r.leadsIn} in / ${r.qualified} qualified / ${r.applied} applied${extras.length ? ` (${extras.join(', ')})` : ''}`;
        })
        .join('\n')
    : '_No activity yesterday._';

  const blocks: Array<Record<string, unknown>> = [
    { type: 'header', text: { type: 'plain_text', text: `📊 Daily digest — ${digest.windowLabel}`, emoji: true } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Leads in:* ${t.leadsIn}` },
        { type: 'mrkdwn', text: `*Qualified:* ${t.qualified}` },
        { type: 'mrkdwn', text: `*Applied:* ${t.applied} (${t.appliedViewed} BU-viewed · ${t.connectsSpent} connects)` },
        { type: 'mrkdwn', text: `*Replies / Calls / Won:* ${t.replies} / ${t.calls} / ${t.won}` },
      ],
    },
    { type: 'section', text: { type: 'mrkdwn', text: profileLines } },
  ];

  if (digest.unviewedRecentApplied > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `👀 *${digest.unviewedRecentApplied} sent proposal${digest.unviewedRecentApplied === 1 ? '' : 's'} from the last 7 days await BU review* — managers, tick “Proposal viewed” after reading.`,
      },
    });
  }

  if (digest.unactionedQualified > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⏳ *${digest.unactionedQualified} qualified lead${digest.unactionedQualified === 1 ? '' : 's'} sitting unapplied for 24h+*${digest.oldestUnactionedDays != null ? ` (oldest: ${digest.oldestUnactionedDays}d)` : ''} — worth a pass today.`,
      },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'Open dashboard' }, url: appUrl },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Qualified leads' },
          url: `${appUrl.replace(/\/$/, '')}/leads?status=QUALIFIED`,
        },
      ],
    });
  }

  return { text: headline, blocks };
}

/** Compute + post to the team webhook. Best-effort like all Slack sends. */
export async function sendDailyDigest(): Promise<DailyDigest> {
  const digest = await computeDailyDigest();
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildDailyDigestBody(digest)),
      });
    } catch {
      // best-effort
    }
  }
  return digest;
}
