import { NextResponse } from 'next/server';
import { LeadStatus } from '@prisma/client';
import { z } from 'zod';

import { updateLeadStatus } from '@/domain/leads/update-lead-status';

// NEW is entry-only, and the three consolidated legacy stages can no longer be set
// (FOLLOW_UP → Ongoing Discussion, QUALIFIED_LOST → Lost, CLOSED → Job Closed).
const RETIRED: LeadStatus[] = [
  LeadStatus.NEW,
  LeadStatus.FOLLOW_UP,
  LeadStatus.QUALIFIED_LOST,
  LeadStatus.CLOSED,
];

const requestSchema = z.object({
  status: z.nativeEnum(LeadStatus).refine((value) => !RETIRED.includes(value), {
    message: 'Unsupported lifecycle status',
  }),
});

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await context.params;
    const json = await request.json();
    const payload = requestSchema.parse(json);
    const lead = await updateLeadStatus(leadId, payload.status);

    return NextResponse.json({
      ok: true,
      leadId: lead?.id,
      status: lead?.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update lead status';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
