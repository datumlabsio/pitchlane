import { NextResponse } from 'next/server';
import { LeadSource, SourceCompleteness } from '@prisma/client';
import { z } from 'zod';

import { createLeadFromEmail } from '@/domain/leads/create-email-lead';

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
