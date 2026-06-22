import { type NextRequest, NextResponse } from 'next/server';

import { enrichPendingLeads } from '@/domain/leads/enrich-pending';

// Each lead's Bright Data unlock takes ~45-60s; 3 per run stays under the cap.
export const maxDuration = 300;

function cronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev / no auth configured
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

async function run() {
  const result = await enrichPendingLeads(3);
  return NextResponse.json({ ok: true, ...result });
}

// Vercel Cron (or an external cron) hits this on a schedule.
export async function GET(request: NextRequest) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrichment pass failed';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

// Manual trigger from the dashboard ("Enrich pending" button, if added).
export async function POST(request: NextRequest) {
  return GET(request);
}
