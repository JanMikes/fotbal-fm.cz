import { createHmac } from 'crypto';
import { config } from './config';

function getSecret(): string {
  const secret = config.formTokenSecret;
  if (!secret) throw new Error('FORM_TOKEN_SECRET environment variable is not configured');
  return secret;
}

export function createFormToken(recipients: string[]): string {
  const payload = JSON.stringify(recipients);
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ r: recipients, s: hmac })).toString('base64url');
}

export function verifyFormToken(token: string): string[] | null {
  try {
    const { r, s } = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!Array.isArray(r) || typeof s !== 'string') return null;
    const expected = createHmac('sha256', getSecret()).update(JSON.stringify(r)).digest('hex');
    if (s !== expected) return null;
    return r;
  } catch {
    return null;
  }
}
