import { NextResponse } from 'next/server';
import { z } from 'zod';

import { saveProposalVersion } from '@/domain/leads/save-proposal-version';

const requestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('regenerate'),
  }),
  z.object({
    mode: z.literal('edit'),
    content: z.string().trim().min(1, 'Proposal content is required'),
  }),
]);

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  try {
    const { leadId } = await context.params;
    const json = await request.json();
    const payload = requestSchema.parse(json);
    const proposal = await saveProposalVersion({ leadId, ...payload });

    return NextResponse.json({
      ok: true,
      proposalId: proposal.id,
      isPrimary: proposal.isPrimary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save proposal version';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
