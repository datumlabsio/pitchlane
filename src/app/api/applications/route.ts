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

const requestSchema = z.object({
  leadId: z.string().min(1),
  connectsSpent: z.number().int().min(0).max(999).nullable(),
  appliedAt: nullableDate,
  lastFollowUpAt: nullableDate,
  notes: z.string().max(10_000).default(''),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = requestSchema.parse(json);
    const application = await upsertApplication({
      leadId: payload.leadId,
      connectsSpent: payload.connectsSpent,
      appliedAt: payload.appliedAt ?? null,
      lastFollowUpAt: payload.lastFollowUpAt ?? null,
      notes: payload.notes,
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
