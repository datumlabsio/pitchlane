import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { updateProfileConfig } from '@/domain/profiles/repository';
import { profileConfigUpdateSchema } from '@/domain/profiles/types';

export async function PATCH(request: Request, context: { params: Promise<{ profileConfigId: string }> }) {
  try {
    const { profileConfigId } = await context.params;
    const json = await request.json();
    const payload = profileConfigUpdateSchema.parse(json);
    const profileConfig = await updateProfileConfig(profileConfigId, payload);

    revalidatePath('/profiles');

    return NextResponse.json({ ok: true, profileConfig });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ ok: false, error: error.issues[0]?.message || 'Invalid profile config payload' }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : 'Unknown profile config update error';
    const status = message === 'Profile config not found.' ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
