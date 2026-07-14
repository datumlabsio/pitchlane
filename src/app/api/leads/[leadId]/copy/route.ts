import { NextResponse } from 'next/server';
import { z } from 'zod';

import { copyLeadToAccounts } from '@/domain/leads/copy-lead';

// Judge calls run per target profile — give the route room.
export const maxDuration = 90;

const requestSchema = z.object({
  accountIds: z.array(z.string().min(1)).min(1).max(10),
});

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await context.params;
    const { accountIds } = requestSchema.parse(await request.json());
    const results = await copyLeadToAccounts(leadId, accountIds);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to copy lead';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
