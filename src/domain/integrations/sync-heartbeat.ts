import { IntegrationProvider, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { notifySlackSyncDown } from '@/lib/slack';

const STALE_MINUTES = 15; // no successful sync in this long ⇒ ingestion looks down
const REALERT_MS = 60 * 60 * 1000; // re-ping at most hourly while it stays down

export type HeartbeatResult = {
  ok: boolean; // true = healthy (recent successful sync)
  minutesSince: number | null; // since the last success; null if none on record
  alerted: boolean; // whether this check fired a Slack ping
};

/**
 * Dead-man's-switch for ingestion. Checks how long since the last successful (or
 * partial) Gmail sync; if that exceeds STALE_MINUTES it pings Slack — throttled to
 * once per hour via the Gmail connection's metadata so a prolonged outage doesn't
 * spam the channel. Meant to be hit by its own cron, independent of the sync cron.
 */
export async function checkSyncHeartbeat(): Promise<HeartbeatResult> {
  const lastOk = await prisma.syncRun.findFirst({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL, status: { in: ['success', 'partial'] } },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  });

  const minutesSince = lastOk ? Math.floor((Date.now() - lastOk.startedAt.getTime()) / 60000) : null;
  const stale = minutesSince === null || minutesSince >= STALE_MINUTES;
  if (!stale) return { ok: true, minutesSince, alerted: false };

  // Throttle re-alerts using lastDownAlertAt on the Gmail connection metadata.
  const conn = await prisma.integrationConnection.findUnique({
    where: { provider: IntegrationProvider.GOOGLE_GMAIL },
    select: { id: true, metadata: true },
  });
  const meta = (conn?.metadata && typeof conn.metadata === 'object' && !Array.isArray(conn.metadata)
    ? (conn.metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const lastAlertMs = typeof meta.lastDownAlertAt === 'string' ? Date.parse(meta.lastDownAlertAt) : 0;
  if (Date.now() - lastAlertMs < REALERT_MS) return { ok: false, minutesSince, alerted: false };

  await notifySlackSyncDown(minutesSince);
  if (conn) {
    await prisma.integrationConnection.update({
      where: { id: conn.id },
      data: { metadata: { ...meta, lastDownAlertAt: new Date().toISOString() } as Prisma.InputJsonValue },
    });
  }
  return { ok: false, minutesSince, alerted: true };
}
