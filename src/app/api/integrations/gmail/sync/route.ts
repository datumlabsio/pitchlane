import { type NextRequest, NextResponse } from 'next/server';

import { syncGmailInbox } from '@/domain/integrations/gmail-sync';
import { shouldRunGmailSync } from '@/domain/integrations/repository';

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

async function runSync() {
  const result = await syncGmailInbox();
  return NextResponse.json({ ok: true, ...result });
}

// Vercel Cron calls every minute — checks DB interval before actually syncing
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
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
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await runSync();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Gmail sync failure';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
