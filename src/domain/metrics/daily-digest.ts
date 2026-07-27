import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

// The team works in Pakistan time; the digest covers a PKT calendar day.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

const SIGNAL_RANK = { red: 0, green: 1 } as const;

export type DigestWindow = { start: Date; end: Date; label: string };

export type DigestSignal = 'red' | 'green';

/** Yesterday as a PKT calendar day, expressed in UTC instants. */
export function pktYesterdayWindow(now = new Date()): DigestWindow {
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS);
  const pktMidnightUtcMs =
    Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), pktNow.getUTCDate()) - PKT_OFFSET_MS;
  const start = new Date(pktMidnightUtcMs - 24 * 60 * 60 * 1000);
  const label = new Date(start.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
  return { start, end: new Date(pktMidnightUtcMs), label };
}

/**
 * Send when yesterday (PKT) was Mon–Fri. Skips Sun 4am (Sat data) and Mon 4am (Sun data).
 * Cron fires Tue–Sat 4:00 PKT (`0 23 * * 1-5` UTC).
 */
export function shouldSendDailyDigest(now = new Date()): boolean {
  const { start } = pktYesterdayWindow(now);
  const pktYesterday = new Date(start.getTime() + PKT_OFFSET_MS);
  const day = pktYesterday.getUTCDay(); // 0=Sun … 6=Sat
  return day >= 1 && day <= 5;
}

export type ProfileRow = {
  profile: string;
  leadsIn: number;
  qualified: number;
  applied: number;
  // Of that day's applied, how many have proposalViewed / buReviewed ticked so far.
  proposalViewed: number;
  buReviewed: number;
  replies: number;
  calls: number;
  won: number;
  connectsSpent: number;
};

export type DailyDigest = {
  windowLabel: string;
  rows: ProfileRow[];
  totals: Omit<ProfileRow, 'profile'>;
};

export type DigestBuildOptions = {
  connectRateUsd?: number;
};

/**
 * Yesterday's per-profile performance. Stage movements are counted from the
 * status_updated event log; applications from their real appliedAt so backdated
 * applies land on the right day.
 */
export async function computeDailyDigest(window = pktYesterdayWindow()): Promise<DailyDigest> {
  const [accounts, leadsIn, statusEvents, appliedApps] = await Promise.all([
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
      select: {
        accountId: true,
        connectsSpent: true,
        proposalViewed: true,
        buReviewed: true,
      },
    }),
  ]);

  const emptyRow = (profile: string): ProfileRow => ({
    profile,
    leadsIn: 0,
    qualified: 0,
    applied: 0,
    proposalViewed: 0,
    buReviewed: 0,
    replies: 0,
    calls: 0,
    won: 0,
    connectsSpent: 0,
  });

  const byAccount = new Map<string, ProfileRow>(
    accounts.map((a) => [a.id, emptyRow(a.personName)]),
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
    if (app.proposalViewed) row.proposalViewed += 1;
    if (app.buReviewed) row.buReviewed += 1;
    row.connectsSpent += app.connectsSpent ?? 0;
  }

  const rows = [...byAccount.values()].sort(compareProfileRows);
  const totals = rows.reduce(
    (t, r) => ({
      leadsIn: t.leadsIn + r.leadsIn,
      qualified: t.qualified + r.qualified,
      applied: t.applied + r.applied,
      proposalViewed: t.proposalViewed + r.proposalViewed,
      buReviewed: t.buReviewed + r.buReviewed,
      replies: t.replies + r.replies,
      calls: t.calls + r.calls,
      won: t.won + r.won,
      connectsSpent: t.connectsSpent + r.connectsSpent,
    }),
    {
      leadsIn: 0,
      qualified: 0,
      applied: 0,
      proposalViewed: 0,
      buReviewed: 0,
      replies: 0,
      calls: 0,
      won: 0,
      connectsSpent: 0,
    },
  );

  return { windowLabel: window.label, rows, totals };
}

/** Red if applied < 3, green otherwise. No other conditions. */
export function rowSignal(row: Pick<ProfileRow, 'applied'>): DigestSignal {
  return row.applied < 3 ? 'red' : 'green';
}

const SIGNAL_EMOJI: Record<DigestSignal, string> = {
  red: '🔴',
  green: '🟢',
};

export function formatFraction(numer: number, denom: number): string {
  return denom === 0 ? '–' : `${numer}/${denom}`;
}

export function formatConPerApp(connects: number, applied: number): string {
  return applied === 0 ? '–' : String(Math.round(connects / applied));
}

export function formatPct(numer: number, denom: number): string {
  if (denom === 0) return '0%';
  return `${Math.round((numer / denom) * 100)}%`;
}

function isActiveRow(r: ProfileRow): boolean {
  return Boolean(r.leadsIn || r.qualified || r.applied || r.replies || r.calls || r.won);
}

function compareProfileRows(a: ProfileRow, b: ProfileRow): number {
  const signalDiff = SIGNAL_RANK[rowSignal(a)] - SIGNAL_RANK[rowSignal(b)];
  if (signalDiff !== 0) return signalDiff;
  return b.leadsIn - a.leadsIn;
}

/** Active rows sorted red → green, then leadsIn desc. */
export function buildDigestTableRows(digest: DailyDigest): ProfileRow[] {
  return digest.rows.filter(isActiveRow).sort(compareProfileRows);
}

function resolveConnectRate(options?: DigestBuildOptions): number {
  if (options?.connectRateUsd != null) return options.connectRateUsd;
  return env.CONNECT_RATE_USD;
}

function profileRowLine(row: ProfileRow): string {
  const signal = SIGNAL_EMOJI[rowSignal(row)];
  const pv = formatFraction(row.proposalViewed, row.applied);
  const bu = formatFraction(row.buReviewed, row.applied);
  return `${signal} *${row.profile}*   ${row.leadsIn} in • ${row.qualified} qual • ${row.applied} app • ${pv} Proposal view • ${bu} BU review`;
}

function actionsBlock(): Record<string, unknown> | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  return {
    type: 'actions',
    elements: [
      { type: 'button', text: { type: 'plain_text', text: 'Open dashboard' }, url: appUrl },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Qualified leads' },
        url: `${appUrl.replace(/\/$/, '')}/leads?status=QUALIFIED`,
      },
    ],
  };
}

/** Compact Block Kit body for daily-upwork-metrics (pure — exported for tests). */
export function buildDailyDigestBody(
  digest: DailyDigest,
  options?: DigestBuildOptions,
): { text: string; blocks: Array<Record<string, unknown>> } {
  const connectRateUsd = resolveConnectRate(options);
  const t = digest.totals;
  const spend = (t.connectsSpent * connectRateUsd).toFixed(2);
  const conApp = formatConPerApp(t.connectsSpent, t.applied);
  const header = `📊 Daily Upwork metrics — ${digest.windowLabel}`;
  const funnel = `${t.leadsIn} in → ${t.qualified} qualified (${formatPct(t.qualified, t.leadsIn)}) → ${t.applied} applied (${formatPct(t.applied, t.qualified)})`;
  const spendLine = `💰 ${t.connectsSpent} connects • $${spend} • ${conApp} con/app`;
  const profiles = buildDigestTableRows(digest);
  const profileText = profiles.map(profileRowLine).join('\n');
  const totalPv = formatFraction(t.proposalViewed, t.applied);
  const totalBu = formatFraction(t.buReviewed, t.applied);
  const totalLine = `Total: ${t.applied} applied • ${totalPv} Proposal view • ${totalBu} BU review`;

  const blocks: Array<Record<string, unknown>> = [
    { type: 'header', text: { type: 'plain_text', text: header, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `${funnel}\n${spendLine}` } },
    { type: 'divider' },
    { type: 'section', text: { type: 'mrkdwn', text: profileText || '_No active profiles_' } },
    { type: 'divider' },
    { type: 'context', elements: [{ type: 'mrkdwn', text: totalLine }] },
  ];

  const actions = actionsBlock();
  if (actions) blocks.push(actions);

  return {
    text: `${header} • ${funnel} • ${spendLine}`,
    blocks,
  };
}

/** Alias — same payload (no separate table fallback). */
export function buildDailyDigestFallbackBody(
  digest: DailyDigest,
  options?: DigestBuildOptions,
): { text: string; blocks: Array<Record<string, unknown>> } {
  return buildDailyDigestBody(digest, options);
}

async function postWebhook(
  webhookUrl: string,
  body: { text: string; blocks: Array<Record<string, unknown>> },
): Promise<{ ok: boolean; text: string }> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => '');
  return { ok: res.ok, text };
}

export type SendDailyDigestResult = {
  digest: DailyDigest;
  skipped: boolean;
  reason?: 'weekend_yesterday';
};

/** Compute + post to the team webhook. Best-effort like all Slack sends. */
export async function sendDailyDigest(options?: {
  force?: boolean;
}): Promise<SendDailyDigestResult> {
  const digest = await computeDailyDigest();
  if (!options?.force && !shouldSendDailyDigest()) {
    return { digest, skipped: true, reason: 'weekend_yesterday' };
  }

  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await postWebhook(webhookUrl, buildDailyDigestBody(digest));
    } catch {
      // best-effort
    }
  }
  return { digest, skipped: false };
}
