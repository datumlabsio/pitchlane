import { NextResponse } from 'next/server';
import { google } from 'googleapis';

import { upsertGoogleConnection } from '@/domain/integrations/repository';
import { env } from '@/lib/env';
import { createGoogleOAuthClient } from '@/lib/google/gmail';

export async function handleGoogleOAuthCallback(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/settings?gmail=missing-code`);
  }

  try {
    const client = createGoogleOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();

    await upsertGoogleConnection({
      email: me.data.email ?? undefined,
      accessToken: tokens.access_token ?? undefined,
      refreshToken: tokens.refresh_token ?? undefined,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope?.split(' ') ?? [],
      metadata: {
        tokenType: tokens.token_type,
      },
    });

    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/settings?gmail=connected`);
  } catch (error) {
    console.error('Google OAuth callback failed', error);
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/settings?gmail=error`);
  }
}
