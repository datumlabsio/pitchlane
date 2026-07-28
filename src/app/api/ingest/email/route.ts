import { after, NextResponse } from 'next/server';
import { LeadSource, SourceCompleteness } from '@prisma/client';
import { z } from 'zod';

import { createLeadFromEmail } from '@/domain/leads/create-email-lead';
import { enrichLead } from '@/domain/leads/enrich-lead';

// The post-response enrichment (job fetch + on-prem judge) can take a couple of
// minutes; keep the function alive for it like the sync route does.
export const maxDuration = 300;

const requestSchema = z.object({
  gmailLabel: z.string().min(1),
  from: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  source: z.nativeEnum(LeadSource).optional(),
  externalMessageId: z.string().optional(),
  externalThreadId: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  extractedBudget: z.string().optional(),
  extractedSkills: z.array(z.string()).optional(),
  sourceCompleteness: z.nativeEnum(SourceCompleteness).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = requestSchema.parse(json);
    const result = await createLeadFromEmail(payload);

    // Manually added leads shouldn't wait for the safety-net cron: enrich right
    // after responding (fetch, judge, triage to Qualified/Rejected, alert) —
    // same after() pattern as the Gmail sync route.
    if (!result.duplicate && result.lead.sourceUrl) {
      const leadId = result.lead.id;
      after(async () => {
        try {
          await enrichLead(leadId);
        } catch {
          // Best-effort — the enrich-pending cron sweeps stragglers.
        }
      });
    }

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      leadId: result.lead.id,
      status: result.lead.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown ingestion error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
