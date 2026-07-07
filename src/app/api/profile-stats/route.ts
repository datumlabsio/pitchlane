import { NextResponse } from 'next/server';
import { z } from 'zod';

import { upsertProfileStat } from '@/domain/profile-stats/repository';

const count = z.number().int().min(0).max(1_000_000);

const requestSchema = z.object({
  accountId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week must be YYYY-MM-DD'),
  views: count.default(0),
  invites: count.default(0),
  impressions: count.default(0),
  clicks: count.default(0),
});

export async function POST(request: Request) {
  try {
    const payload = requestSchema.parse(await request.json());
    const stat = await upsertProfileStat(payload);
    return NextResponse.json({ ok: true, stat });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? 'Invalid stats'
        : error instanceof Error
          ? error.message
          : 'Unable to save stats';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
