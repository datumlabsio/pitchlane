import { after, type NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { syncGmailInbox } from '@/domain/integrations/gmail-sync';
import { enrichLead } from '@/domain/leads/enrich-lead';

// Ingest returns fast; enrichment + Slack alerts run in after() (up to maxDuration).
// Vercel caps this to the plan limit (300s on Pro, 60s on Hobby).
export const maxDuration = 300;

function hasCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

// GET = Vercel Cron → requires the cron secret (or none configured, in dev).
function cronAuthorized(request: NextRequest) {
  return !process.env.CRON_SECRET || hasCronSecret(request);
}

// POST = manual "Run sync now" from the dashboard → requires a logged-in user.
// The cron secret also works for programmatic callers.
async function manualAuthorized(request: NextRequest) {
  if (!process.env.CRON_SECRET) return true; // dev with no auth configured
  if (hasCronSecret(request)) return true;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims);
  } catch {
    return false;
  }
}

async function runSync() {
  const result = await syncGmailInbox();

  // Enrich + alert each freshly-created lead right after responding. API-first
  // enrichment is ~1-2s, so the batch usually finishes well within maxDuration;
  // anything that spills (e.g. a slow Bright Data fallback, or the function being
  // cut off on Hobby's 60s) is swept up by the enrich-pending safety-net cron.
  // Sequential keeps us frugal with the Upwork API rate limit.
  if (result.newLeadIds.length) {
    after(async () => {
      for (const id of result.newLeadIds) {
        try {
          await enrichLead(id);
        } catch {
          // Best-effort — the safety-net cron retries stragglers.
        }
      }
    });
  }

  return NextResponse.json({ ok: true, ...result });
}

// The external cron hits this on its own cadence (every ~1 min); we run each
// time it fires — no in-app throttle. Dedupe on dedupeKey makes re-runs safe.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Gmail sync failure';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

// Manual trigger via POST (dashboard "Run sync now" button) — always runs
export async function POST(request: NextRequest) {
  if (!(await manualAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Gmail sync failure';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
