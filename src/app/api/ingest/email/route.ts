import { after, type NextRequest, NextResponse } from 'next/server';
import { LeadSource, SourceCompleteness } from '@prisma/client';
import { z } from 'zod';

import { createLeadFromEmail } from '@/domain/leads/create-email-lead';
import { enrichLead } from '@/domain/leads/enrich-lead';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// The post-response enrichment (job fetch + on-prem judge) can take a couple of
// minutes; keep the function alive for it like the sync route does.
export const maxDuration = 300;

// Middleware deliberately skips /api/* — this route gates itself. The Add-lead
// dialog authenticates via its session cookie; programmatic callers may use the
// cron secret. Same pattern as the Gmail sync route's manual trigger.
function hasCronSecret(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

async function authorized(request: NextRequest) {
  if (!process.env.CRON_SECRET) return true; // dev with no auth configured
  if (hasCronSecret(request)) return true;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims);
  } catch {
    return false;
  }
}

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

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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
