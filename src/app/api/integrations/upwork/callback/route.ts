import { type NextRequest, NextResponse } from 'next/server';

import { exchangeUpworkCode } from '@/lib/upwork/auth';

// Upwork redirects here with ?code=… after the user approves. Exchange it for
// tokens, store them, and bounce back to Settings.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const settings = new URL('/settings', url.origin);

  if (error || !code) {
    settings.searchParams.set('upwork', 'error');
    return NextResponse.redirect(settings);
  }

  try {
    await exchangeUpworkCode(code);
    settings.searchParams.set('upwork', 'connected');
  } catch {
    settings.searchParams.set('upwork', 'error');
  }
  return NextResponse.redirect(settings);
}
