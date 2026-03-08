import { createHmac } from 'crypto';

export function createFormToken(recipients: string[], secret: string): string {
  const payload = JSON.stringify(recipients);
  const hmac = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ r: recipients, s: hmac })).toString('base64url');
}

export function verifyFormToken(token: string, secret: string): string[] | null {
  try {
    const { r, s } = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!Array.isArray(r) || typeof s !== 'string') return null;
    const expected = createHmac('sha256', secret).update(JSON.stringify(r)).digest('hex');
    if (s !== expected) return null;
    return r;
  } catch {
    return null;
  }
}
