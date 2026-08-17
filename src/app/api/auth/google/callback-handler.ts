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

    // Lock the connect flow to the shared inbox: someone signing in with the wrong
    // Google account must not overwrite the working connection (that's how alerts
    // silently die). Reject anything but the configured mailbox.
    const allowed = env.GMAIL_CONNECT_ALLOWED?.trim().toLowerCase();
    if (allowed && me.data.email?.toLowerCase() !== allowed) {
      return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/settings?gmail=wrong-account`);
    }

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
