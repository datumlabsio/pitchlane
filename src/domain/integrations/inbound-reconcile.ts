import { getGoogleConnection } from '@/domain/integrations/repository';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { decodeHtmlEntities } from '@/lib/utils';

const WINDOW_HOURS = 24;
const ALERT_COOLDOWN_MS = 60 * 60 * 1000;

export type InboundReconcileResult = {
  windowHours: number;
  /** Channel has received at least one email ever — checks only arm after that. */
  armed: boolean;
  gmailLeads: number;
  inboundSeen: number;
  matched: number;
  missing: Array<{ subject: string; account: string }>;
  unroutable: number;
  errors: number;
  forwardingDead: boolean;
  inboundSilent: boolean;
  alerted: boolean;
};

const normalize = (value: string) =>
  decodeHtmlEntities(value).trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Proves the forwarding path carries everything the Gmail path ingests: every
 * Gmail-created lead in the window should have an inbound email with the same
 * normalized subject. Misses mean the Gmail filter or the MX path dropped mail —
 * exactly what must be ZERO before cutover. Doubles as the inbound dead-man's
 * switch: Gmail saw Upwork mail but the webhook saw nothing (pre-cutover), or the
 * channel went completely silent (post-cutover). Alerts are throttled hourly and
 * everything stays quiet until the channel has received its first email.
 */
export async function reconcileInbound(): Promise<InboundReconcileResult> {
  // Run receipt: proves the external cron is actually hitting this endpoint
  // (otherwise "no alert" is indistinguishable from "never ran").
  const receiptConn = await getGoogleConnection();
  if (receiptConn) {
    const receiptMeta =
      receiptConn.metadata && typeof receiptConn.metadata === 'object' && !Array.isArray(receiptConn.metadata)
        ? (receiptConn.metadata as Record<string, unknown>)
        : {};
    await prisma.integrationConnection.update({
      where: { id: receiptConn.id },
      data: { metadata: { ...receiptMeta, lastInboundReconcileRunAt: Date.now() } },
    });
  }

  // Never alarm before the channel is wired up — the first Upwork delivery arms it.
  // Skipped rows don't count: the Gmail forward-address confirmation email and
  // synthetic tests land (and are skipped) before the forwarding filter exists,
  // and arming on those would gap-alert on every Gmail lead until the filter is live.
  const armedBy = await prisma.inboundEmail.findFirst({
    where: { outcome: { not: 'skipped' } },
    orderBy: { receivedAt: 'asc' },
    select: { receivedAt: true },
  });
  if (!armedBy) {
    return {
      windowHours: WINDOW_HOURS,
      armed: false,
      gmailLeads: 0,
      inboundSeen: 0,
      matched: 0,
      missing: [],
      unroutable: 0,
      errors: 0,
      forwardingDead: false,
      inboundSilent: false,
      alerted: false,
    };
  }

  // The comparison window starts when the channel went live, never earlier — Gmail
  // leads from before the forwarding filter existed can't have inbound twins, and
  // counting them would false-alarm on day one. A short grace excludes the newest
  // leads whose forwarded copy may still be in flight.
  const GRACE_MS = 5 * 60 * 1000;
  const since = new Date(
    Math.max(Date.now() - WINDOW_HOURS * 3600 * 1000, armedBy.receivedAt.getTime()),
  );

  const [leads, inbound] = await Promise.all([
    prisma.lead.findMany({
      where: {
        createdAt: { gte: since, lte: new Date(Date.now() - GRACE_MS) },
        dedupeKey: { startsWith: 'gmail:' },
      },
      select: { emailSubject: true, title: true, account: { select: { name: true } } },
    }),
    prisma.inboundEmail.findMany({
      where: { receivedAt: { gte: since } },
      select: { subject: true, outcome: true },
    }),
  ]);

  // Upwork alert subjects repeat the job title, so subject identity is the join key.
  const relevant = inbound.filter((row) => row.outcome !== 'skipped');
  const inboundSubjects = new Set(relevant.map((row) => normalize(row.subject ?? '')).filter(Boolean));
  const missingLeads = leads.filter((lead) => {
    const key = normalize(lead.emailSubject ?? lead.title);
    return Boolean(key) && !inboundSubjects.has(key);
  });

  const forwardingDead = leads.length > 0 && relevant.length === 0;
  const inboundSilent = leads.length === 0 && relevant.length === 0;
  const shouldAlert = forwardingDead || missingLeads.length > 0;

  let alerted = false;
  if (shouldAlert && env.SLACK_WEBHOOK_URL) {
    // Hourly throttle, stored next to the other alert timestamps on the connection.
    const connection = await getGoogleConnection();
    const meta =
      connection?.metadata && typeof connection.metadata === 'object' && !Array.isArray(connection.metadata)
        ? (connection.metadata as Record<string, unknown>)
        : {};
    const last = typeof meta.lastInboundReconcileAlertAt === 'number' ? meta.lastInboundReconcileAlertAt : 0;

    if (Date.now() - last >= ALERT_COOLDOWN_MS) {
      const text = forwardingDead
        ? `🚨 Inbound mail channel looks DEAD — ${leads.length} Upwork emails reached Gmail in the last ${WINDOW_HOURS}h but the inbound webhook received 0. Check the sales@ forwarding filter and Resend.`
        : `⚠️ Inbound forwarding gap — ${missingLeads.length} of ${leads.length} Gmail leads in the last ${WINDOW_HOURS}h never arrived at the inbound address. Samples: ${missingLeads
            .slice(0, 3)
            .map((lead) => `"${(lead.emailSubject ?? lead.title).slice(0, 60)}" (${lead.account.name})`)
            .join(', ')}`;
      try {
        await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        alerted = true;
        if (connection) {
          await prisma.integrationConnection.update({
            where: { id: connection.id },
            data: { metadata: { ...meta, lastInboundReconcileAlertAt: Date.now() } },
          });
        }
      } catch {
        // Alerting is best-effort — the reconcile result still reports the state.
      }
    }
  }

  return {
    windowHours: WINDOW_HOURS,
    armed: true,
    gmailLeads: leads.length,
    inboundSeen: relevant.length,
    matched: leads.length - missingLeads.length,
    missing: missingLeads.slice(0, 10).map((lead) => ({
      subject: lead.emailSubject ?? lead.title,
      account: lead.account.name,
    })),
    unroutable: relevant.filter((row) => row.outcome === 'unroutable').length,
    errors: relevant.filter((row) => row.outcome === 'error').length,
    forwardingDead,
    inboundSilent,
    alerted,
  };
}
