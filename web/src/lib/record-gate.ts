import { hasEntry } from '@fotbal-fm/cache';
import { RECORDS, getCategorySlugIndex, getPageSlugIndex, type RouteRecord } from '@/lib/strapi/data';
import { isRecordUnavailableError } from '@/lib/strapi/record-unavailable';
import { isPlausibleSlug } from '@/lib/slug';

/*
 * The record gate (src/proxy.ts). A record route — a CMS page, a category and everything under
 * it, an article, a player, a partner — cannot render without its own record. When Strapi fails
 * (or answers slower than RECORD_WAIT_MS) and no copy of that record is cached, the route must
 * answer 503 "temporarily unavailable", never 404 (search engines drop a 404'd page) and never an
 * empty page. Next.js cannot set a 503 from a page, so the gate decides before the page renders:
 *
 * - any cached copy of every record (fresh, soft-stale or invalidated: the page serves it) → pass,
 *   with no Strapi call and no refresh of its own (one Redis EXISTS per record);
 * - a cold record → load it now, through the same cache entry the page reads (RECORDS), so the
 *   page then finds it; Strapi failed, or no answer within RECORD_WAIT_MS → 503 (a load that is
 *   only slow goes on and fills the cache for the retry);
 * - a slug that genuinely does not exist (membership index says unknown, or Strapi answers "no
 *   such record") → pass: the page answers 404 as before;
 * - anything else (auth failures, bugs) → pass: the page shows it as it always has.
 *
 * Nothing is stored about an unavailable record: the data cache's failure memo (10 s) is the only
 * memory of the failure, and the 503 response is `no-store`.
 */

export const RECORD_WAIT_MS = 5000;

/** Top-level app segments that are not CMS pages: the `[slug]` catch-all's siblings (a test keeps it equal to src/app). */
export const STATIC_TOP_LEVEL = new Set(['a', 'api', 'kategorie', 'kdy-hrajeme', 'komponenty', 'novinky', 'partner', 'partneri']);

/** Files the app serves at the top level (metadata routes); never CMS pages either. */
export const FILE_ROUTES = new Set(['apple-icon.png', 'favicon.ico', 'manifest.webmanifest', 'robots.txt']);

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The records a path cannot render without; [] when it is no record route or its slug cannot exist. */
export async function recordsFor(pathname: string): Promise<RouteRecord[]> {
  const parts = pathname.split('/').filter(Boolean).map(decode);

  if (parts.length === 1) {
    const [slug] = parts;
    if (STATIC_TOP_LEVEL.has(slug) || FILE_ROUTES.has(slug) || !isPlausibleSlug(slug)) return [];
    const index = await getPageSlugIndex();
    if (index && !index.includes(slug)) return []; // unknown: the page 404s (no Strapi call)
    return [RECORDS.page(slug)]; // known — or the index is unavailable and we cannot tell
  }

  if (parts[0] === 'kategorie') {
    const [, category, sub, slug] = parts;
    if (!isPlausibleSlug(category)) return [];
    const index = await getCategorySlugIndex();
    if (index && !index.includes(category)) return [];
    const records: RouteRecord[] = [RECORDS.category(category)];
    if (parts.length === 4 && sub === 'clanek' && isPlausibleSlug(slug)) records.push(RECORDS.article(slug));
    if (parts.length === 4 && sub === 'hrac' && isPlausibleSlug(slug)) records.push(RECORDS.roster(category));
    return records;
  }

  if (parts.length === 3 && parts[0] === 'novinky' && parts[1] === 'clanek' && isPlausibleSlug(parts[2])) {
    return [RECORDS.article(parts[2])];
  }

  if (parts.length === 2 && parts[0] === 'partner' && isPlausibleSlug(parts[1])) {
    return [RECORDS.partner(parts[1])];
  }

  return [];
}

export type GateDecision =
  | { status: 'pass' }
  | { status: 'unavailable'; fn: string; reason: 'failed' | 'timeout' };

const PASS: GateDecision = { status: 'pass' };

/** Loads a cold record; settles as 'loaded', 'failed' (RecordUnavailableError) or 'other' (let the page handle it). */
async function secure(record: RouteRecord): Promise<'present' | 'loaded' | 'failed' | 'other'> {
  if ((await hasEntry(record.fn, record.url)) === true) return 'present';
  try {
    await record.read();
    return 'loaded';
  } catch (error) {
    return isRecordUnavailableError(error) ? 'failed' : 'other';
  }
}

export async function gate(pathname: string, waitMs = RECORD_WAIT_MS): Promise<GateDecision> {
  let records: RouteRecord[];
  try {
    records = await recordsFor(pathname);
  } catch {
    return PASS; // the indexes never throw on a Strapi failure (they answer null); anything else is the page's
  }
  if (records.length === 0) return PASS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), waitMs);
  });
  // All records at once (secure() never rejects); one deadline for the whole gate.
  const pending = records.map((record) => secure(record));
  try {
    for (let i = 0; i < pending.length; i++) {
      const outcome = await Promise.race([pending[i], timeout]);
      if (outcome === 'timeout') return { status: 'unavailable', fn: records[i].fn, reason: 'timeout' };
      if (outcome === 'failed') return { status: 'unavailable', fn: records[i].fn, reason: 'failed' };
    }
    return PASS;
  } finally {
    clearTimeout(timer);
  }
}
