import { after, NextResponse, type NextRequest } from 'next/server';

import { env } from '@/lib/env';
import { syncGmailInbox } from '@/domain/integrations/gmail-sync';
import { enrichNewLeads } from '@/domain/integrations/enrich-new-leads';

// Post-ACK work: full sync + fetch + on-prem judge for every new lead.
export const maxDuration = 300;

/**
 * Gmail push endpoint. A Pub/Sub push subscription POSTs here the moment the
 * mailbox changes; the notification only says "something changed", so the handler
 * ACKs immediately and runs the exact same idempotent sync + enrich pipeline as
 * the cron (id-diff + 3-layer dedupe make double-triggering a no-op). The cron
 * stays on as a safety net and renews the watch.
 *
 * Auth: Pub/Sub can't set custom headers, so the subscription's push URL carries
 * a shared token (?token=...) validated against GMAIL_PUSH_TOKEN.
 */
export async function POST(request: NextRequest) {
  if (!env.GMAIL_PUSH_TOKEN) {
    return NextResponse.json({ error: 'Push not configured' }, { status: 404 });
  }
  if (request.nextUrl.searchParams.get('token') !== env.GMAIL_PUSH_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Body shape (informational only — we resync regardless):
  // { message: { data: base64({emailAddress, historyId}), messageId }, subscription }
  const body = (await request.json().catch(() => null)) as
    | { message?: { messageId?: string } }
    | null;

  after(async () => {
    try {
      const result = await syncGmailInbox();
      if (result.newLeadIds?.length) {
        await enrichNewLeads(result.newLeadIds);
      }
    } catch {
      // Surfaced in platform logs; the cron safety net re-syncs within minutes.
    }
  });

  // ACK fast — Pub/Sub redelivers on slow/non-2xx responses.
  return NextResponse.json({ ok: true, received: body?.message?.messageId ?? null });
}
