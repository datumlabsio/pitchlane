import { listActiveAccounts } from '@/domain/accounts/repository';
import { createLeadFromEmail } from '@/domain/leads/create-email-lead';
import { extractLeadSignals } from '@/domain/leads/extract-signals';
import { env } from '@/lib/env';
import { prisma } from '@/lib/prisma';
import { getReceivedEmail, type ReceivedEmailDetail } from '@/lib/resend/client';
import { stripHtml } from '@/lib/utils';

/** Metadata-only payload of Resend's `email.received` webhook event. */
export type EmailReceivedEvent = {
  email_id: string;
  created_at?: string;
  from?: string;
  to?: string[];
  cc?: string[];
  received_for?: string[];
  message_id?: string;
  subject?: string;
};

export type InboundOutcome = 'stored' | 'ingested' | 'duplicate' | 'skipped' | 'unroutable' | 'error';

export type InboundResult = {
  outcome: InboundOutcome;
  /** Set when a brand-new lead was created with a job URL — caller enriches it. */
  enrichableLeadId?: string;
  /** True for failures worth a webhook retry (transient fetch/db errors). */
  retryable?: boolean;
};

type AccountRow = Awaited<ReturnType<typeof listActiveAccounts>>[number];

const UPWORK_SENDER = /upwork\.com/i;

// Outcomes a re-delivery can't improve on — reprocessing is a no-op for these.
// `unroutable` and `error` are deliberately NOT terminal: a redelivered (or
// manually reprocessed) event retries routing, so config fixes self-heal rows.
const TERMINAL_OUTCOMES: ReadonlySet<string> = new Set([
  'stored', 'ingested', 'duplicate', 'skipped',
]);

const EMAIL_ADDRESS = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function extractAddresses(values: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const value of values) {
    for (const match of (value ?? '').match(EMAIL_ADDRESS) ?? []) {
      found.add(match.toLowerCase());
    }
  }
  return [...found];
}

// Headers that can carry the ORIGINAL recipient of a forwarded message. Gmail's
// filter-forward rewrites the ENVELOPE recipient (that's what Resend reports in
// `to`), but it cannot rewrite the DKIM-signed To header — the original alert
// address survives in the parsed headers, alongside the X-Forwarded-* trail.
const RECIPIENT_HEADERS = ['to', 'cc', 'delivered-to', 'x-forwarded-to', 'x-forwarded-for', 'x-original-to'];

function detailRecipientCandidates(detail: ReceivedEmailDetail): string[] {
  const headerValues = RECIPIENT_HEADERS.map((name) => detail.headers?.[name]);
  return extractAddresses([
    ...(detail.to ?? []),
    ...(detail.cc ?? []),
    ...(detail.received_for ?? []),
    ...headerValues,
  ]);
}

/**
 * Handles one inbound email event. Always records the delivery in the InboundEmail
 * store (that's what reconciliation audits); whether it ALSO becomes a lead depends
 * on INBOUND_INGEST_MODE — "shadow" proves delivery + routing while the Gmail path
 * stays the source of truth, "live" ingests through the exact same domain logic as
 * the Gmail sync. Idempotent per provider email id, so svix retries are safe.
 */
export async function processInboundEmail(event: EmailReceivedEvent): Promise<InboundResult> {
  const existing = await prisma.inboundEmail.findUnique({
    where: { providerEmailId: event.email_id },
  });
  if (existing && TERMINAL_OUTCOMES.has(existing.outcome)) {
    return { outcome: existing.outcome as InboundOutcome };
  }

  const receivedAt = event.created_at ? new Date(event.created_at) : new Date();
  const row = existing ?? (await prisma.inboundEmail.create({
    data: {
      providerEmailId: event.email_id,
      rfcMessageId: event.message_id ?? null,
      fromAddr: event.from ?? null,
      toAddrs: event.to ?? [],
      receivedFor: event.received_for ?? [],
      subject: event.subject ?? null,
      receivedAt: Number.isNaN(receivedAt.getTime()) ? new Date() : receivedAt,
    },
  }));

  const finish = async (outcome: InboundOutcome, patch: { accountId?: string; leadId?: string } = {}) => {
    await prisma.inboundEmail.update({
      where: { id: row.id },
      data: { outcome, processedAt: new Date(), error: null, ...patch },
    });
  };

  try {
    // Only Upwork alert mail becomes leads. Anything else a too-broad forwarding
    // filter sends over is kept for the audit trail but never ingested.
    if (!UPWORK_SENDER.test(event.from ?? '')) {
      await finish('skipped');
      return { outcome: 'skipped' };
    }

    // Route by the ORIGINAL recipient — Upwork addresses every alert to the
    // profile's own alert address, the same per-account address the Gmail path
    // routes by (forwardingInbox). Gmail's forward rewrites the envelope (so the
    // webhook's `to` usually shows our own receiving address), but the original
    // To survives in the message headers, which the retrieve API parses — fetch
    // them when a key is configured. Only an address owned by exactly one active
    // account is routable; anything else stays `unroutable` instead of guessing.
    const accounts = await listActiveAccounts();
    const owners = new Map<string, AccountRow[]>();
    for (const account of accounts) {
      const addr = account.forwardingInbox?.trim().toLowerCase();
      if (!addr) continue;
      owners.set(addr, [...(owners.get(addr) ?? []), account]);
    }
    const uniqueOwner = (addresses: string[]) =>
      addresses.map((addr) => owners.get(addr)).find((candidates) => candidates?.length === 1)?.[0];

    let detail: ReceivedEmailDetail | null = null;
    const fetchDetail = async () => (detail ??= await getReceivedEmail(event.email_id));

    // received_for carries the delivery chain (observed: our receiving address,
    // sales@, and the profile's own alert address) — scan it too, so routing can
    // succeed even before the detail fetch.
    let account = uniqueOwner(
      extractAddresses([...(event.to ?? []), ...(event.cc ?? []), ...(event.received_for ?? [])]),
    );
    if (!account && env.RESEND_API_KEY) {
      try {
        account = uniqueOwner(detailRecipientCandidates(await fetchDetail()));
      } catch {
        // Header lookup is a routing nicety — fall through to unroutable.
      }
    }
    if (!account) {
      await finish('unroutable');
      return { outcome: 'unroutable' };
    }

    // Shadow mode: prove delivery + routing without creating leads — the Gmail path
    // stays the source of truth until reconciliation shows parity.
    if (env.INBOUND_INGEST_MODE !== 'live') {
      await finish('stored', { accountId: account.id });
      return { outcome: 'stored' };
    }

    // The webhook only carries metadata — fetch the parsed body (reusing the
    // routing fetch when it already happened), then ingest through the same
    // domain path as the Gmail sync (same dedupe, triage, and guards).
    const fullDetail = await fetchDetail();
    const subject = event.subject ?? fullDetail.subject ?? 'Untitled forwarded lead';
    const body = fullDetail.text || stripHtml(fullDetail.html ?? '') || subject;
    const signals = extractLeadSignals(subject, body);

    const result = await createLeadFromEmail({
      gmailLabel: account.gmailLabel,
      from: event.from,
      subject,
      body,
      externalMessageId: event.email_id,
      externalIdProvider: 'resend',
      externalThreadId: event.message_id ?? undefined,
      sourceUrl: signals.sourceUrl,
      extractedBudget: signals.budget,
      extractedSkills: signals.skills,
      sourceCompleteness: signals.sourceCompleteness,
      receivedAt: row.receivedAt,
    });

    const outcome: InboundOutcome = result.duplicate ? 'duplicate' : 'ingested';
    await finish(outcome, { accountId: account.id, leadId: result.lead.id });
    return {
      outcome,
      enrichableLeadId: !result.duplicate && result.lead.sourceUrl ? result.lead.id : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown inbound processing error';
    await prisma.inboundEmail
      .update({
        where: { id: row.id },
        data: { outcome: 'error', error: message, processedAt: new Date() },
      })
      .catch(() => { /* recording the failure is best-effort */ });
    return { outcome: 'error', retryable: true };
  }
}
