import { NextResponse } from 'next/server';

import { enrichLead } from '@/domain/leads/enrich-lead';

export const maxDuration = 90;

export async function POST(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await context.params;
    // Manual button → force past the already-enriched guard so "Refresh from Upwork" always re-runs.
    const result = await enrichLead(leadId, { force: true });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enrichment failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
