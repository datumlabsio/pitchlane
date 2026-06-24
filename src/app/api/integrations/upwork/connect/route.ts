import { NextResponse } from 'next/server';

import { getUpworkAuthorizeUrl, isUpworkConfigured } from '@/lib/upwork/auth';

// Kicks off the Upwork authorization-code flow — redirects the user to Upwork
// to log in and approve, which redirects back to /api/integrations/upwork/callback.
export async function GET() {
  if (!isUpworkConfigured()) {
    return NextResponse.json({ error: 'Upwork client credentials are not configured.' }, { status: 400 });
  }
  return NextResponse.redirect(getUpworkAuthorizeUrl());
}
