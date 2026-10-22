import { IntegrationProvider } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getGoogleConnection } from '@/domain/integrations/repository';

// At one sync per 5 minutes, an expired token would otherwise ping Slack twelve
// times an hour. Once an hour is loud enough.
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Instant alarm for the one failure the OAuth model re-accepts: Google revoking
 * the sales@ token (password change, access revocation). Fires a Slack ping with
 * the reconnect link on the FIRST failed sync instead of waiting for the 95-minute
 * dead-man's switch, rate-limited via connection metadata. Never throws.
 */
export async function alertGmailAuthFailure(error: unknown): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    if (!/invalid_grant|invalid_client|unauthorized_client/i.test(message)) return;

    const connection = await getGoogleConnection();
    const meta =
      connection?.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata)
        ? (connection.metadata as Record<string, unknown>)
        : {};
    const last = typeof meta.lastAuthFailureAlertAt === 'number' ? meta.lastAuthFailureAlertAt : 0;
    if (Date.now() - last < ALERT_COOLDOWN_MS) return;

    const webhookUrl = env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      const appUrl = (env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Gmail connection died (${message.slice(0, 60)}) — lead ingestion is DOWN. Reconnect sales@ now: ${appUrl}/settings`,
        }),
      });
    }

    await prisma.integrationConnection.update({
      where: { provider: IntegrationProvider.GOOGLE_GMAIL },
      data: { metadata: { ...meta, lastAuthFailureAlertAt: Date.now() } },
    });
  } catch {
    // best-effort — never mask the original sync failure
  }
}
