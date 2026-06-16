import { handleGoogleOAuthCallback } from '@/app/api/auth/google/callback-handler';

export async function GET(request: Request) {
  return handleGoogleOAuthCallback(request);
}
