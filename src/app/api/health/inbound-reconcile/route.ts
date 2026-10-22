import { NextResponse, type NextRequest } from 'next/server';

import { reconcileInbound } from '@/domain/integrations/inbound-reconcile';

export const maxDuration = 60;

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no auth configured
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

// Inbound-channel reconciliation + dead-man's switch. Hit by its own cron (every
// ~30 min). Compares Gmail-path leads against the inbound received-mail store and
// pings Slack (throttled hourly) on forwarding gaps or a dead channel. Safe to
// register before the channel is wired — it stays silent until the first delivery.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await reconcileInbound();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inbound reconcile failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
