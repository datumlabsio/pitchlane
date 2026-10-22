import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifySvixSignature } from '@/lib/resend/webhook';

const keyBytes = Buffer.from('pitchlane-test-signing-key-material');
const secret = `whsec_${keyBytes.toString('base64')}`;

function sign(id: string, timestamp: string, body: string, key: Buffer = keyBytes) {
  return createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
}

const NOW_MS = 1_700_000_000_000;
const nowSeconds = Math.floor(NOW_MS / 1000);
const body = JSON.stringify({ type: 'email.received', data: { email_id: 'abc' } });

describe('verifySvixSignature', () => {
  it('accepts a correctly signed payload', () => {
    const ts = String(nowSeconds);
    const headers = { id: 'msg_1', timestamp: ts, signature: `v1,${sign('msg_1', ts, body)}` };
    expect(verifySvixSignature(secret, headers, body, NOW_MS)).toBe(true);
  });

  it('accepts when any of several rotated signatures matches', () => {
    const ts = String(nowSeconds);
    const stale = sign('msg_1', ts, body, Buffer.from('old-rotated-key'));
    const good = sign('msg_1', ts, body);
    const headers = { id: 'msg_1', timestamp: ts, signature: `v1,${stale} v1,${good}` };
    expect(verifySvixSignature(secret, headers, body, NOW_MS)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const ts = String(nowSeconds);
    const headers = { id: 'msg_1', timestamp: ts, signature: `v1,${sign('msg_1', ts, body)}` };
    expect(verifySvixSignature(secret, headers, `${body} `, NOW_MS)).toBe(false);
  });

  it('rejects a signature made with a different key', () => {
    const ts = String(nowSeconds);
    const forged = sign('msg_1', ts, body, Buffer.from('attacker-key'));
    const headers = { id: 'msg_1', timestamp: ts, signature: `v1,${forged}` };
    expect(verifySvixSignature(secret, headers, body, NOW_MS)).toBe(false);
  });

  it('rejects timestamps outside the tolerance window (replay protection)', () => {
    const ts = String(nowSeconds - 6 * 60);
    const headers = { id: 'msg_1', timestamp: ts, signature: `v1,${sign('msg_1', ts, body)}` };
    expect(verifySvixSignature(secret, headers, body, NOW_MS)).toBe(false);
  });

  it('rejects missing headers', () => {
    const ts = String(nowSeconds);
    expect(verifySvixSignature(secret, { id: null, timestamp: ts, signature: 'v1,x' }, body, NOW_MS)).toBe(false);
    expect(verifySvixSignature(secret, { id: 'msg_1', timestamp: null, signature: 'v1,x' }, body, NOW_MS)).toBe(false);
    expect(verifySvixSignature(secret, { id: 'msg_1', timestamp: ts, signature: null }, body, NOW_MS)).toBe(false);
  });

  it('rejects non-v1 signature schemes', () => {
    const ts = String(nowSeconds);
    const headers = { id: 'msg_1', timestamp: ts, signature: `v2,${sign('msg_1', ts, body)}` };
    expect(verifySvixSignature(secret, headers, body, NOW_MS)).toBe(false);
  });
});
