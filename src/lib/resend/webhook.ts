import { createHmac, timingSafeEqual } from 'node:crypto';

// Resend signs webhooks with the Svix scheme: HMAC-SHA256 over
// `${svix-id}.${svix-timestamp}.${rawBody}`, keyed with the base64 payload of the
// `whsec_…` signing secret. The signature header may carry several space-separated
// `v1,<base64>` entries (key rotation) — any one matching means valid. Implemented
// directly on node:crypto so we don't take the svix dependency for 30 lines.
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type SvixHeaders = {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
};

export function verifySvixSignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
  nowMs = Date.now(),
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;

  // Replay protection: reject timestamps outside the tolerance window.
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  if (key.length === 0) return false;

  const expected = createHmac('sha256', key)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`)
    .digest();

  for (const entry of headers.signature.split(' ')) {
    const [version, candidate] = entry.split(',');
    if (version !== 'v1' || !candidate) continue;
    const candidateBytes = Buffer.from(candidate, 'base64');
    if (candidateBytes.length === expected.length && timingSafeEqual(candidateBytes, expected)) {
      return true;
    }
  }
  return false;
}
