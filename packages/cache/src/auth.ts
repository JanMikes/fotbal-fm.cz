import { timingSafeEqual } from 'crypto';

export function isValidWebhookSecret(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}
