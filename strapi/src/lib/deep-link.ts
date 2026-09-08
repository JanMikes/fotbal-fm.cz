import { randomInt } from 'crypto';

/**
 * Deep-link codes: 8 characters from Crockford's base32 alphabet (no I, L, O, U), so a
 * code printed on a landing page can be read aloud and typed into the app without
 * ambiguity. 32^8 ≈ 1.1e12 combinations — unguessable behind the API rate limit.
 *
 * Admins may also type a custom code (uppercase letters and digits, 4–16 chars); it is
 * normalized the same way, so lookups are case-insensitive and ignore dashes/spaces.
 */
export const DEEP_LINK_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const DEEP_LINK_CODE_LENGTH = 8;

const CUSTOM_CODE_PATTERN = /^[0-9A-Z]{4,16}$/;
const DEFAULT_BASE_URL = 'https://fotbal-fm.cz/a';

export function generateDeepLinkCode(length: number = DEEP_LINK_CODE_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += DEEP_LINK_CODE_ALPHABET[randomInt(DEEP_LINK_CODE_ALPHABET.length)];
  }
  return code;
}

/** Uppercase, strip whitespace and dashes — the canonical stored form of a code. */
export function normalizeDeepLinkCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidDeepLinkCode(code: string): boolean {
  return CUSTOM_CODE_PATTERN.test(code);
}

/** Public base of every deep link (no trailing slash), e.g. https://fotbal-fm.cz/a */
export function deepLinkBaseUrl(): string {
  return (process.env.DEEP_LINK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

export function buildDeepLinkUrl(code: string): string {
  return `${deepLinkBaseUrl()}/${code}`;
}
