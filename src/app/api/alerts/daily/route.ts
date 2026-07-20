import { NextResponse, type NextRequest } from 'next/server';

import { sendDailyDigest } from '@/domain/metrics/daily-digest';

export const maxDuration = 60;

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no auth configured
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// Fired by the external cron at 04:00 UTC (09:00 PKT): posts yesterday's per-profile
// performance digest to the team Slack channel. The digest JSON is returned too, so
// a manual hit doubles as a debug view.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const digest = await sendDailyDigest();
  return NextResponse.json({ ok: true, digest });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
