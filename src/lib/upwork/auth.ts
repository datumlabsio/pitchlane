import { env } from '@/lib/env';
import { getUpworkConnection, upsertUpworkConnection } from '@/domain/integrations/repository';

const AUTHORIZE_URL = 'https://www.upwork.com/ab/account-security/oauth2/authorize';
const TOKEN_URL = 'https://www.upwork.com/api/v3/oauth2/token';

export function isUpworkConfigured(): boolean {
  return Boolean(env.UPWORK_CLIENT_ID && env.UPWORK_CLIENT_SECRET);
}

/** Must exactly match a Callback URL registered on the Upwork app. */
export function getUpworkRedirectUri(): string {
  return `${env.NEXT_PUBLIC_APP_URL}/api/integrations/upwork/callback`;
}

export function getUpworkAuthorizeUrl(state?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.UPWORK_CLIENT_ID ?? '',
    redirect_uri: getUpworkRedirectUri(),
  });
  if (state) params.set('state', state);
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upwork token request failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text) as TokenResponse;
}

async function persist(tokens: TokenResponse, fallbackRefresh?: string) {
  await upsertUpworkConnection({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? fallbackRefresh,
    expiryDate: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
  });
}

/** Exchange the authorization-code-flow `code` for tokens and store them. */
export async function exchangeUpworkCode(code: string): Promise<void> {
  const tokens = await postToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.UPWORK_CLIENT_ID ?? '',
      client_secret: env.UPWORK_CLIENT_SECRET ?? '',
      redirect_uri: getUpworkRedirectUri(),
    }),
  );
  await persist(tokens);
}

/** A valid access token, refreshing if near expiry. null if not connected. */
export async function getUpworkAccessToken(): Promise<string | null> {
  const conn = await getUpworkConnection();
  if (!conn) return null;

  const stillValid = conn.accessToken && conn.expiryDate && conn.expiryDate.getTime() - Date.now() > 60_000;
  if (stillValid) return conn.accessToken;

  if (!conn.refreshToken) return conn.accessToken ?? null;

  const tokens = await postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: conn.refreshToken,
      client_id: env.UPWORK_CLIENT_ID ?? '',
      client_secret: env.UPWORK_CLIENT_SECRET ?? '',
    }),
  );
  await persist(tokens, conn.refreshToken);
  return tokens.access_token;
}
