import { IntegrationProvider } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { createAuthenticatedGmailClient } from '@/lib/google/gmail';
import { getGoogleConnection } from '@/domain/integrations/repository';

// Renew when less than a day of the 7-day watch remains — called from every sync
// tick, so the watch effectively never lapses while the cron is alive.
const RENEW_MARGIN_MS = 24 * 60 * 60 * 1000;

type WatchMeta = { expiration?: number; historyId?: string; topic?: string };

function readWatchMeta(metadata: unknown): WatchMeta {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const w = (metadata as Record<string, unknown>).gmailWatch;
    if (w && typeof w === 'object' && !Array.isArray(w)) return w as WatchMeta;
  }
  return {};
}

/**
 * Keep the Gmail push watch alive (users.watch expires every 7 days). Registers the
 * mailbox against the Pub/Sub topic in GMAIL_PUSH_TOPIC; Gmail then notifies our
 * webhook the moment mail arrives, instead of waiting for the next cron tick.
 * Best-effort and cheap: no-ops unless the topic is configured and the current
 * watch is within a day of expiry. Never throws — the poller keeps working without it.
 */
export async function ensureGmailWatch(): Promise<
  { status: 'active' | 'renewed' | 'skipped'; expiration?: number }
> {
  try {
    if (!env.GMAIL_PUSH_TOPIC) return { status: 'skipped' };
    const connection = await getGoogleConnection();
    if (!connection?.refreshToken && !connection?.accessToken) return { status: 'skipped' };

    const watch = readWatchMeta(connection.metadata);
    if (
      watch.expiration &&
      watch.topic === env.GMAIL_PUSH_TOPIC &&
      watch.expiration - Date.now() > RENEW_MARGIN_MS
    ) {
      return { status: 'active', expiration: watch.expiration };
    }

    const gmail = await createAuthenticatedGmailClient();
    const res = await gmail.users.watch({
      userId: 'me',
      // Whole-mailbox watch: the Upwork alerts arrive under per-profile labels, and
      // the sync's id-diff makes unrelated-mail notifications a cheap no-op.
      requestBody: { topicName: env.GMAIL_PUSH_TOPIC },
    });

    const expiration = res.data.expiration ? Number(res.data.expiration) : undefined;
    const currentMeta =
      connection.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata)
        ? (connection.metadata as Record<string, unknown>)
        : {};
    await prisma.integrationConnection.update({
      where: { provider: IntegrationProvider.GOOGLE_GMAIL },
      data: {
        metadata: {
          ...currentMeta,
          gmailWatch: {
            expiration,
            historyId: res.data.historyId ?? undefined,
            topic: env.GMAIL_PUSH_TOPIC,
            renewedAt: new Date().toISOString(),
          },
        },
      },
    });
    return { status: 'renewed', expiration };
  } catch {
    return { status: 'skipped' };
  }
}
