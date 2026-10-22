import { after, type NextRequest, NextResponse } from 'next/server';

import { processInboundEmail, type EmailReceivedEvent } from '@/domain/integrations/inbound-ingest';
import { enrichLead } from '@/domain/leads/enrich-lead';
import { env } from '@/lib/env';
import { verifySvixSignature } from '@/lib/resend/webhook';

// Body fetch + ingest run inline (seconds); enrichment runs after the response like
// the other ingestion routes and can take a couple of minutes on the on-prem judge.
export const maxDuration = 300;

// Resend inbound webhook — the stage-2 mail path. Public route (middleware skips
// /api/*): authentication is the svix signature over the raw body.
export async function POST(request: NextRequest) {
  const secret = env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: 'Inbound webhook is not configured.' }, { status: 503 });
  }

  // The signature covers the exact raw bytes — read them before any JSON parsing.
  const rawBody = await request.text();
  const verified = verifySvixSignature(
    secret,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    rawBody,
  );
  if (!verified) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  let event: { type?: string; data?: EmailReceivedEvent };
  try {
    event = JSON.parse(rawBody) as { type?: string; data?: EmailReceivedEvent };
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed payload' }, { status: 400 });
  }
  if (event.type !== 'email.received' || !event.data?.email_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await processInboundEmail(event.data);

  if (result.outcome === 'error' && result.retryable) {
    // Non-2xx → Resend retries with backoff; the stored row makes retries idempotent.
    return NextResponse.json({ ok: false, outcome: result.outcome }, { status: 500 });
  }

  const leadId = result.enrichableLeadId;
  if (leadId) {
    after(async () => {
      try {
        await enrichLead(leadId);
      } catch {
        // Best-effort — the enrich-pending cron sweeps stragglers.
      }
    });
  }

  return NextResponse.json({ ok: true, outcome: result.outcome });
}
