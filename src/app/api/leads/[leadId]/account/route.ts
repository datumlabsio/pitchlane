import { NextResponse } from 'next/server';
import { z } from 'zod';

import { reassignLead } from '@/domain/leads/reassign-lead';

const requestSchema = z.object({ accountId: z.string().min(1) });

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await context.params;
    const { accountId } = requestSchema.parse(await request.json());
    const result = await reassignLead(leadId, accountId);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reassign lead';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
