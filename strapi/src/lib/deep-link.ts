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

/**
 * Uppercase, strip whitespace and dashes — the canonical stored form of a code. A whole pasted
 * link (`https://fotbal-fm.cz/a/FOTBALFM`, `fotbal-fm.cz/a/fotbalfm/?x=1`) is reduced to its last
 * path segment first, so an admin who pastes a link into the code field still gets the code.
 */
export function normalizeDeepLinkCode(raw: string): string {
  let value = raw.trim();
  if (value.includes('/')) {
    const path = value.split(/[?#]/)[0].replace(/\/+$/, '');
    value = path.slice(path.lastIndexOf('/') + 1);
  }
  return value.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidDeepLinkCode(code: string): boolean {
  return CUSTOM_CODE_PATTERN.test(code);
}

/**
 * Public base of every deep link (no trailing slash), e.g. https://fotbal-fm.cz/a. The web app
 * serves links only under `/a/<code>`, so a DEEP_LINK_BASE_URL that is not an absolute http(s) URL
 * ending in `/a` would hand out dead links — it falls back to the default instead (see
 * deepLinkBaseUrlProblem(), logged at boot).
 */
export function deepLinkBaseUrl(): string {
  const configured = (process.env.DEEP_LINK_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (!configured || deepLinkBaseUrlProblem(configured)) return DEFAULT_BASE_URL;
  return configured;
}

/** Why a base URL is unusable, or null when it is fine. */
export function deepLinkBaseUrlProblem(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'is not an absolute URL';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'must be http(s)';
  if (url.search || url.hash) return 'must not contain ? or #';
  if (!url.pathname.replace(/\/+$/, '').endsWith('/a')) return 'must end with /a (the web route is /a/<code>)';
  return null;
}

export function buildDeepLinkUrl(code: string): string {
  return `${deepLinkBaseUrl()}/${code}`;
}
