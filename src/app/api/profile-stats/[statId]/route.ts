import { NextResponse } from 'next/server';

import { deleteProfileStat } from '@/domain/profile-stats/repository';

export async function DELETE(_request: Request, context: { params: Promise<{ statId: string }> }) {
  try {
    const { statId } = await context.params;
    await deleteProfileStat(statId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete stats';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
