import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';

// The team works in Pakistan time; the digest covers a PKT calendar day.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

const SIGNAL_RANK = { red: 0, yellow: 1, green: 2 } as const;

export type DigestWindow = { start: Date; end: Date; label: string };

export type DigestSignal = 'red' | 'yellow' | 'green';

/** Yesterday as a PKT calendar day, expressed in UTC instants. */
export function pktYesterdayWindow(now = new Date()): DigestWindow {
  const pktNow = new Date(now.getTime() + PKT_OFFSET_MS);
  const pktMidnightUtcMs =
    Date.UTC(pktNow.getUTCFullYear(), pktNow.getUTCMonth(), pktNow.getUTCDate()) - PKT_OFFSET_MS;
  const start = new Date(pktMidnightUtcMs - 24 * 60 * 60 * 1000);
  const label = new Date(start.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
  return { start, end: new Date(pktMidnightUtcMs), label };
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

/** Severity for a profile row (exported for tests). */
export function rowSignal(row: Pick<ProfileRow, 'qualified' | 'applied'>): DigestSignal {
  if ((row.qualified > 0 && row.applied === 0) || (row.applied > 0 && row.qualified === 0)) {
    return 'red';
  }
  if (row.qualified > 0 && row.applied / row.qualified < 0.5) {
    return 'yellow';
  }
  return 'green';
}

const SIGNAL_EMOJI: Record<DigestSignal, string> = {
  red: '🔴',
  yellow: '🟡',
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

type TableCell = { type: 'raw_text'; text: string };

function rawCell(text: string): TableCell {
  return { type: 'raw_text', text };
}

function profileCells(row: ProfileRow, signal: DigestSignal | null): TableCell[] {
  return [
    rawCell(signal ? SIGNAL_EMOJI[signal] : ''),
    rawCell(row.profile),
    rawCell(String(row.leadsIn)),
    rawCell(String(row.qualified)),
    rawCell(String(row.applied)),
    rawCell(formatFraction(row.proposalViewed, row.applied)),
    rawCell(formatFraction(row.buReviewed, row.applied)),
    rawCell(formatConPerApp(row.connectsSpent, row.applied)),
  ];
}

/** Active rows sorted red→yellow→green, then leadsIn desc, plus a totals row. */
export function buildDigestTableRows(digest: DailyDigest): ProfileRow[] {
  const active = digest.rows.filter(isActiveRow).sort(compareProfileRows);
  return [
    ...active,
    {
      profile: 'Total',
      leadsIn: digest.totals.leadsIn,
      qualified: digest.totals.qualified,
      applied: digest.totals.applied,
      proposalViewed: digest.totals.proposalViewed,
      buReviewed: digest.totals.buReviewed,
      replies: digest.totals.replies,
      calls: digest.totals.calls,
      won: digest.totals.won,
      connectsSpent: digest.totals.connectsSpent,
    },
  ];
}

function resolveConnectRate(options?: DigestBuildOptions): number {
  if (options?.connectRateUsd != null) return options.connectRateUsd;
  return env.CONNECT_RATE_USD;
}

function buildHeadlineLines(digest: DailyDigest, connectRateUsd: number): string[] {
  const t = digest.totals;
  const spend = (t.connectsSpent * connectRateUsd).toFixed(2);
  const conApp = formatConPerApp(t.connectsSpent, t.applied);
  const lines = [
    `📊 Daily digest — ${digest.windowLabel}`,
    `${t.leadsIn} in → ${t.qualified} qualified (${formatPct(t.qualified, t.leadsIn)}) → ${t.applied} applied (${formatPct(t.applied, t.qualified)})`,
    `${t.connectsSpent} connects · $${spend} spent · ${conApp} con/app`,
  ];
  if (t.replies || t.calls || t.won) {
    lines.push(`Replies ${t.replies} · Calls ${t.calls} · Won ${t.won}`);
  }
  return lines;
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

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${' '.repeat(width - value.length)}`;
}

/** Monospace matrix for when Slack rejects the native table block. */
export function buildDailyDigestFallbackBody(
  digest: DailyDigest,
  options?: DigestBuildOptions,
): { text: string; blocks: Array<Record<string, unknown>> } {
  const connectRateUsd = resolveConnectRate(options);
  const lines = buildHeadlineLines(digest, connectRateUsd);
  const tableRows = buildDigestTableRows(digest);
  const headers = ['', 'Profile', 'In', 'Qual', 'App', 'PV', 'BU', 'Con/App'];
  const matrix = tableRows.map((row) => {
    const isTotal = row.profile === 'Total';
    const signal = isTotal ? '' : SIGNAL_EMOJI[rowSignal(row)];
    return [
      signal,
      row.profile,
      String(row.leadsIn),
      String(row.qualified),
      String(row.applied),
      formatFraction(row.proposalViewed, row.applied),
      formatFraction(row.buReviewed, row.applied),
      formatConPerApp(row.connectsSpent, row.applied),
    ];
  });
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...matrix.map((r) => r[i]?.length ?? 0)),
  );
  const formatLine = (cols: string[]) => cols.map((c, i) => pad(c, widths[i]!)).join('  ');
  const code = [formatLine(headers), ...matrix.map(formatLine)].join('\n');

  const blocks: Array<Record<string, unknown>> = [
    { type: 'header', text: { type: 'plain_text', text: `📊 Daily digest — ${digest.windowLabel}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: lines.slice(1).join('\n') } },
    { type: 'section', text: { type: 'mrkdwn', text: `\`\`\`\n${code}\n\`\`\`` } },
  ];
  const actions = actionsBlock();
  if (actions) blocks.push(actions);

  return { text: lines.join(' · '), blocks };
}

/** Block Kit body with native table (pure — exported for tests). */
export function buildDailyDigestBody(
  digest: DailyDigest,
  options?: DigestBuildOptions,
): { text: string; blocks: Array<Record<string, unknown>> } {
  const connectRateUsd = resolveConnectRate(options);
  const lines = buildHeadlineLines(digest, connectRateUsd);
  const tableRows = buildDigestTableRows(digest);

  const headerRow = ['', 'Profile', 'In', 'Qual', 'App', 'PV', 'BU', 'Con/App'].map(rawCell);
  const dataRows = tableRows.map((row) => {
    const isTotal = row.profile === 'Total';
    return profileCells(row, isTotal ? null : rowSignal(row));
  });

  const blocks: Array<Record<string, unknown>> = [
    { type: 'header', text: { type: 'plain_text', text: `📊 Daily digest — ${digest.windowLabel}`, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: lines.slice(1).join('\n') } },
    { type: 'table', rows: [headerRow, ...dataRows] },
  ];

  const actions = actionsBlock();
  if (actions) blocks.push(actions);

  return { text: lines.join(' · '), blocks };
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

/** Compute + post to the team webhook. Best-effort like all Slack sends. */
export async function sendDailyDigest(): Promise<DailyDigest> {
  const digest = await computeDailyDigest();
  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const primary = await postWebhook(webhookUrl, buildDailyDigestBody(digest));
      // Incoming webhooks often reject native `table` blocks (invalid_blocks);
      // any non-2xx gets one monospace retry.
      if (!primary.ok) {
        await postWebhook(webhookUrl, buildDailyDigestFallbackBody(digest));
      }
    } catch {
      // best-effort
    }
  }
  return digest;
}
