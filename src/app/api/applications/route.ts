import { NextResponse } from 'next/server';
import { z } from 'zod';

import { upsertApplication } from '@/domain/leads/upsert-application';

const nullableDate = z
  .string()
  .trim()
  .min(1)
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()), 'Invalid date')
  .nullable()
  .optional();

// Every field is optional (partial update): omitted = leave the stored value
// untouched, null = explicitly clear. The application form sends the full set;
// quick actions (kanban Applied-drop, review toggles) send only what they change.
const requestSchema = z.object({
  leadId: z.string().min(1),
  connectsSpent: z.number().int().min(0).max(999).nullable().optional(),
  appliedAt: nullableDate,
  lastFollowUpAt: nullableDate,
  notes: z.string().max(10_000).optional(),
  connectsRefunded: z.number().int().min(0).max(999).nullable().optional(),
  sentProposal: z.string().max(30_000).nullable().optional(),
  proposalFeedback: z.string().max(10_000).nullable().optional(),
  buReviewed: z.boolean().optional(),
  proposalViewed: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = requestSchema.parse(json);
    const application = await upsertApplication({
      leadId: payload.leadId,
      connectsSpent: payload.connectsSpent,
      appliedAt: payload.appliedAt,
      lastFollowUpAt: payload.lastFollowUpAt,
      notes: payload.notes,
      connectsRefunded: payload.connectsRefunded,
      sentProposal: payload.sentProposal,
      proposalFeedback: payload.proposalFeedback,
      buReviewed: payload.buReviewed,
      proposalViewed: payload.proposalViewed,
    });

    return NextResponse.json({
      ok: true,
      applicationId: application.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save application';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
