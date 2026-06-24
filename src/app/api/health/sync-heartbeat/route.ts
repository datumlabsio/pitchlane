import { NextResponse, type NextRequest } from 'next/server';

import { checkSyncHeartbeat } from '@/domain/integrations/sync-heartbeat';

export const maxDuration = 30;

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no auth configured
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// Dead-man's-switch. Hit by its OWN cron (every ~5-10 min), independent of the Gmail
// sync cron, so it can detect when the sync itself has stopped firing or keeps failing.
// Pings Slack (throttled hourly) when no successful sync has happened recently.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await checkSyncHeartbeat();
    return NextResponse.json({
      ok: true,
      healthy: result.ok,
      minutesSinceLastSync: result.minutesSince,
      alerted: result.alerted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Heartbeat check failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
