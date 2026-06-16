import { NextResponse } from 'next/server';

import { createGoogleOAuthClient } from '@/lib/google/gmail';

export async function GET() {
  const client = createGoogleOAuthClient();
  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });

  return NextResponse.redirect(url);
}
