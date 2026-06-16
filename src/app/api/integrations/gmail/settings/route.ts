import { NextResponse } from 'next/server';
import { z } from 'zod';

import { updateGmailSyncInterval } from '@/domain/integrations/repository';

const schema = z.object({
  syncIntervalMinutes: z.number().int().min(1).max(60),
});

export async function PATCH(request: Request) {
  try {
    const json = await request.json();
    const { syncIntervalMinutes } = schema.parse(json);
    await updateGmailSyncInterval(syncIntervalMinutes);
    return NextResponse.json({ ok: true, syncIntervalMinutes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
