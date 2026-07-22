import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  updateGmailSyncInterval,
  updateSlackAlertFloor,
  updateSlackMinScore,
} from '@/domain/integrations/repository';

const schema = z
  .object({
    syncIntervalMinutes: z.number().int().min(1).max(60).optional(),
    slackMinScore: z.number().int().min(0).max(100).optional(),
    slackAlertFloor: z.number().int().min(0).max(100).optional(),
  })
  .refine(
    (d) => d.syncIntervalMinutes !== undefined || d.slackMinScore !== undefined || d.slackAlertFloor !== undefined,
    { message: 'Nothing to update' },
  );

export async function PATCH(request: Request) {
  try {
    const json = await request.json();
    const data = schema.parse(json);
    if (data.syncIntervalMinutes !== undefined) await updateGmailSyncInterval(data.syncIntervalMinutes);
    if (data.slackMinScore !== undefined) await updateSlackMinScore(data.slackMinScore);
    if (data.slackAlertFloor !== undefined) await updateSlackAlertFloor(data.slackAlertFloor);
    return NextResponse.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
