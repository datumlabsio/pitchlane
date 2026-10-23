import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';

export type InboundChannelStatus = {
  /** Webhook signing secret present — the channel can receive. */
  configured: boolean;
  /** API key present — routing can read forwarded headers; required for live mode. */
  keyPresent: boolean;
  mode: 'shadow' | 'live';
  /** Our receiving address, derived from the latest delivery. */
  receivingAddress: string | null;
  last24h: { received: number; routed: number; unroutable: number; errors: number };
  /** When the reconciler armed (first routable delivery), if ever. */
  armedAt: Date | null;
  /** Last time the reconcile cron actually ran (its run receipt), if ever. */
  reconcileLastRunAt: Date | null;
  recent: Array<{
    id: string;
    subject: string | null;
    outcome: string;
    receivedAt: Date;
    accountName: string | null;
  }>;
};

export async function getInboundChannelStatus(): Promise<InboundChannelStatus> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);

  const [recentRows, windowRows, armedBy, connection] = await Promise.all([
    prisma.inboundEmail.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        subject: true,
        outcome: true,
        receivedAt: true,
        toAddrs: true,
        receivedFor: true,
        account: { select: { personName: true } },
      },
    }),
    prisma.inboundEmail.findMany({
      where: { receivedAt: { gte: since } },
      select: { outcome: true, accountId: true },
    }),
    prisma.inboundEmail.findFirst({
      where: { outcome: { not: 'skipped' } },
      orderBy: { receivedAt: 'asc' },
      select: { receivedAt: true },
    }),
    prisma.integrationConnection.findUnique({
      where: { provider: 'GOOGLE_GMAIL' },
      select: { metadata: true },
    }),
  ]);

  const meta =
    connection?.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata)
      ? (connection.metadata as Record<string, unknown>)
      : {};
  const reconcileLastRunAt =
    typeof meta.lastInboundReconcileRunAt === 'number' ? new Date(meta.lastInboundReconcileRunAt) : null;

  const receivingAddress =
    recentRows
      .flatMap((row) => [...row.toAddrs, ...row.receivedFor])
      .find((addr) => addr.toLowerCase().endsWith('.resend.app')) ?? null;

  return {
    configured: Boolean(env.RESEND_INBOUND_WEBHOOK_SECRET),
    keyPresent: Boolean(env.RESEND_API_KEY),
    mode: env.INBOUND_INGEST_MODE,
    receivingAddress,
    last24h: {
      received: windowRows.length,
      routed: windowRows.filter((row) => row.accountId).length,
      unroutable: windowRows.filter((row) => row.outcome === 'unroutable').length,
      errors: windowRows.filter((row) => row.outcome === 'error').length,
    },
    armedAt: armedBy?.receivedAt ?? null,
    reconcileLastRunAt,
    recent: recentRows.map((row) => ({
      id: row.id,
      subject: row.subject,
      outcome: row.outcome,
      receivedAt: row.receivedAt,
      accountName: row.account?.personName ?? null,
    })),
  };
}
