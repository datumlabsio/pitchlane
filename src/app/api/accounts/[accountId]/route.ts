import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { updateAccountSettings } from '@/domain/accounts/repository';
import { accountUpdateSchema } from '@/domain/accounts/types';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, context: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await context.params;
    const json = await request.json();
    const payload = accountUpdateSchema.parse(json);
    const account = await updateAccountSettings(accountId, payload);

    revalidatePath('/profiles');

    return NextResponse.json({ ok: true, account });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message || 'Invalid account payload' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Unknown account update error';
    const status = message === 'Account not found.' ? 404 : message.includes('already assigned') ? 409 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ accountId: string }> }) {
  try {
    const { accountId } = await context.params;
    await prisma.account.delete({ where: { id: accountId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
