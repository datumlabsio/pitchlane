import { NextResponse, type NextRequest } from 'next/server';

import { sendDailyDigest } from '@/domain/metrics/daily-digest';

export const maxDuration = 60;

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no auth configured
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// daily-upwork-metrics — external cron at 23:00 UTC Mon–Fri (4:00 PKT Tue–Sat).
// Posts yesterday's per-profile metrics when yesterday (PKT) was a weekday.
// Skips Sun/Mon 4am runs (weekend data). ?force=1 posts anyway. Manual hit doubles as debug.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const force = request.nextUrl.searchParams.get('force') === '1';
  const result = await sendDailyDigest({ force });

  if (result.skipped) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: result.reason,
      digest: result.digest,
    });
  }

  return NextResponse.json({ ok: true, digest: result.digest });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
