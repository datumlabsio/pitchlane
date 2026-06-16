import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

import { env } from '@/lib/env';
import { getGoogleConnection } from '@/domain/integrations/repository';

export function createGoogleOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error('Google OAuth env vars are not configured.');
  }

  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

export async function createAuthenticatedGmailClient() {
  const connection = await getGoogleConnection();

  if (!connection?.refreshToken && !connection?.accessToken) {
    throw new Error('Google Gmail is not connected.');
  }

  const auth = createGoogleOAuthClient();
  auth.setCredentials({
    access_token: connection.accessToken ?? undefined,
    refresh_token: connection.refreshToken ?? undefined,
    expiry_date: connection.expiryDate?.getTime(),
  });

  return google.gmail({ version: 'v1', auth });
}

export function getHeaderValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | null | undefined,
  name: string,
) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export function decodeMessageBody(part?: gmail_v1.Schema$MessagePart | null): string {
  if (!part) return '';

  const inlineData = part.body?.data;
  if (inlineData) {
    return decodeBase64Url(inlineData);
  }

  const plainTextPart = part.parts?.find((child) => child.mimeType === 'text/plain');
  if (plainTextPart?.body?.data) {
    return decodeBase64Url(plainTextPart.body.data);
  }

  const htmlPart = part.parts?.find((child) => child.mimeType === 'text/html');
  if (htmlPart?.body?.data) {
    return stripHtml(decodeBase64Url(htmlPart.body.data));
  }

  for (const child of part.parts ?? []) {
    const text = decodeMessageBody(child);
    if (text) return text;
  }

  return '';
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
