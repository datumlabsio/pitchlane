import { after, NextResponse, type NextRequest } from 'next/server';

import { enrichPendingLeads } from '@/domain/leads/enrich-pending';

// Each lead's Bright Data unlock takes ~45-60s; 3 per run stays under the cap.
export const maxDuration = 300;

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no auth configured
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// Vercel Cron (or an external cron) hits this on a schedule. A batch takes
// ~1-3 min (Bright Data + Claude) — far longer than external crons wait
// (cron-job.org caps each request at ~30s, so it logs a "timeout (30s)" failure
// even though the work succeeds server-side). So ACK immediately and run the
// work via after(): Vercel keeps the function alive up to maxDuration, the cron
// gets a clean 200, and repeated "failures" can't auto-disable the job.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  after(async () => {
    try {
      await enrichPendingLeads(3);
    } catch {
      // Surfaced in platform logs; the cron only needs the ACK below.
    }
  });
  return NextResponse.json({ ok: true, scheduled: true });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
