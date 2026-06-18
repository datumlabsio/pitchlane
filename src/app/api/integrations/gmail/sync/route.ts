import { type NextRequest, NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { syncGmailInbox } from '@/domain/integrations/gmail-sync';
import { shouldRunGmailSync } from '@/domain/integrations/repository';

// Each new lead may trigger a scrape-enrichment call (up to ~70s); allow the
// batch room to finish. Vercel caps this to the plan limit (300s on Pro).
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
  return NextResponse.json({ ok: true, ...result });
}

// Vercel Cron calls every minute — checks DB interval before actually syncing
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { should, nextInSeconds } = await shouldRunGmailSync();
    if (!should) {
      return NextResponse.json({ ok: true, skipped: true, nextInSeconds });
    }
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
