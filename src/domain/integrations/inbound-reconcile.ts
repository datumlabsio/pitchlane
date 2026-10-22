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
  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000);

  // Never alarm before the channel is wired up — the first delivery arms it.
  const everReceived = await prisma.inboundEmail.findFirst({ select: { id: true } });
  if (!everReceived) {
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

  const [leads, inbound] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: { gte: since }, dedupeKey: { startsWith: 'gmail:' } },
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
