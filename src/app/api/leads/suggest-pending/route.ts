import { after, NextResponse, type NextRequest } from 'next/server';

import { suggestPendingLeads } from '@/domain/leads/suggest-profiles';

// Each lead is judged against every other active profile (~20–40s per judge on the
// on-prem model) — 2 leads per run keeps the worst case inside the window.
export const maxDuration = 300;

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no auth configured
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// External cron hits this on a schedule (same pattern as enrich-pending): ACK
// immediately, do the slow judging via after() so cron-job.org's ~30s request cap
// never logs false failures.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  after(async () => {
    try {
      await suggestPendingLeads(2);
    } catch {
      // Surfaced in platform logs; the cron only needs the ACK below.
    }
  });
  return NextResponse.json({ ok: true, scheduled: true });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
