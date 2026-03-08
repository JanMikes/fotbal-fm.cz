import { createFormToken as _createFormToken, verifyFormToken as _verifyFormToken } from '@fotbal-fm/form';
import { config } from './config';

function getSecret(): string {
  const secret = config.formTokenSecret;
  if (!secret) throw new Error('FORM_TOKEN_SECRET environment variable is not configured');
  return secret;
}

export function createFormToken(recipients: string[]): string {
  return _createFormToken(recipients, getSecret());
}

export function verifyFormToken(token: string): string[] | null {
  return _verifyFormToken(token, getSecret());
}
