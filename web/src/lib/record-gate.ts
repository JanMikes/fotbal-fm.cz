import { hasEntry, redisResponds } from '@fotbal-fm/cache';
import { RECORDS, getCategorySlugIndex, getPageSlugIndex, type RouteRecord } from '@/lib/strapi/data';
import { isRecordUnavailableError } from '@/lib/strapi/record-unavailable';
import { isPlausibleSlug } from '@/lib/slug';

/*
 * The record gate (src/proxy.ts). A record route — a CMS page, a category and everything under
 * it, an article, a player, a partner — cannot render without its own record. When Strapi fails
 * (or answers slower than RECORD_WAIT_MS) and no copy of that record is cached, the route must
 * answer 503 "temporarily unavailable", never 404 (search engines drop a 404'd page) and never an
 * empty page. Next.js cannot set a 503 from a page, so the gate decides before the page renders,
 * within ONE deadline (RECORD_WAIT_MS, the slug-index lookup included):
 *
 * - every record cached (fresh, soft-stale or invalidated: the page serves it) → pass, with one
 *   Redis EXISTS per record and nothing else (no index read, no Strapi call, no refresh);
 * - a record cold → the membership index first: a slug it says does not exist → pass (the page
 *   404s as before, and no Strapi query for scanner paths); then the cold records are loaded
 *   through the same cache entries the page reads (RECORDS), so the page then finds them;
 * - Strapi failed, or the index or a record not resolved by the deadline → 503 (a load that is
 *   only slow goes on and fills the cache for the retry);
 * - a record Strapi says does not exist → pass (the page 404s); auth failures and bugs → pass (the
 *   page shows them as it always has);
 * - Redis stalled (no PING answer within REDIS_PROBE_MS) → pass at once: fail open rather than
 *   spend 500 ms per Redis command on every gated request (review BF-V4).
 *
 * Never gated: paths with a dot in any segment — public files (/logo.svg, also fetched by the
 * image optimizer) and scanner paths; no record slug on prod has a dot (0 of 903, 2026-10-06; the
 * proxy's matcher already skips dotted top-level paths, review BF-V1). Nothing is stored about an
 * unavailable record: the data cache's failure memo (10 s) is the only memory of the failure, and
 * the 503 response is `no-store`.
 */

export const RECORD_WAIT_MS = 5000;
export const REDIS_PROBE_MS = 300;
const REDIS_VERDICT_MS = 1000; // a probe's answer is reused this long (at most one PING per second)

/** Top-level app segments that are not CMS pages: the `[slug]` catch-all's siblings (a test keeps it equal to src/app). */
export const STATIC_TOP_LEVEL = new Set(['a', 'api', 'kategorie', 'kdy-hrajeme', 'komponenty', 'novinky', 'partner', 'partneri']);

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** A segment that can be a record slug: plausible and without a dot (public files, scanner paths). */
function isRecordSlug(segment: string | undefined): segment is string {
  return isPlausibleSlug(segment) && !segment.includes('.');
}

export interface Route {
  /** The membership index that says whether the slug can exist, if the route has one. */
  index: null | { name: 'getPageSlugIndex' | 'getCategorySlugIndex'; slug: string; read: () => Promise<string[] | null> };
  records: RouteRecord[];
}

/** The record route a path is, with no I/O; null when it is none (or a slug that cannot be a record). */
export function routeOf(pathname: string): Route | null {
  const parts = pathname.split('/').filter(Boolean).map(decode);
  if (parts.some((part) => part.includes('.'))) return null;

  if (parts.length === 1) {
    const [slug] = parts;
    if (STATIC_TOP_LEVEL.has(slug) || !isRecordSlug(slug)) return null;
    return { index: { name: 'getPageSlugIndex', slug, read: getPageSlugIndex }, records: [RECORDS.page(slug)] };
  }

  if (parts[0] === 'kategorie') {
    const [, category, sub, slug] = parts;
    if (!isRecordSlug(category)) return null;
    const records: RouteRecord[] = [RECORDS.category(category)];
    if (parts.length === 4 && sub === 'clanek' && isRecordSlug(slug)) records.push(RECORDS.article(slug));
    if (parts.length === 4 && sub === 'hrac' && isRecordSlug(slug)) records.push(RECORDS.roster(category));
    return { index: { name: 'getCategorySlugIndex', slug: category, read: getCategorySlugIndex }, records };
  }

  if (parts.length === 3 && parts[0] === 'novinky' && parts[1] === 'clanek' && isRecordSlug(parts[2])) {
    return { index: null, records: [RECORDS.article(parts[2])] };
  }

  if (parts.length === 2 && parts[0] === 'partner' && isRecordSlug(parts[1])) {
    return { index: null, records: [RECORDS.partner(parts[1])] };
  }

  return null;
}

export type GateDecision =
  | { status: 'pass' }
  | { status: 'unavailable'; fn: string; reason: 'failed' | 'timeout' };

const PASS: GateDecision = { status: 'pass' };

let redisVerdict: { at: number; stalled: boolean } | null = null;

/** Redis connected but not answering → stalled (remembered for a second); no client at all → not stalled. */
async function redisStalled(): Promise<boolean> {
  if (redisVerdict && Date.now() - redisVerdict.at < REDIS_VERDICT_MS) return redisVerdict.stalled;
  const stalled = (await redisResponds(REDIS_PROBE_MS)) === false;
  redisVerdict = { at: Date.now(), stalled };
  return stalled;
}

/** Tests only. */
export function __resetGateState(): void {
  redisVerdict = null;
}

/** Loads a cold record: 'loaded', 'failed' (RecordUnavailableError) or 'other' (let the page handle it). */
async function load(record: RouteRecord): Promise<'loaded' | 'failed' | 'other'> {
  try {
    await record.read();
    return 'loaded';
  } catch (error) {
    return isRecordUnavailableError(error) ? 'failed' : 'other';
  }
}

export async function gate(pathname: string, waitMs = RECORD_WAIT_MS): Promise<GateDecision> {
  const route = routeOf(pathname);
  if (!route) return PASS;
  if (await redisStalled()) return PASS;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), waitMs);
  });
  const withinDeadline = <T>(promise: Promise<T>) => Promise.race([promise, deadline]);

  try {
    // 1. Records already cached: the page can render them whatever the index says. Capped like the
    //    PING (a stall can begin right after a good probe): no answer in time → Redis stalled → pass.
    let probeTimer: ReturnType<typeof setTimeout> | undefined;
    const present = await Promise.race([
      Promise.all(route.records.map((r) => hasEntry(r.fn, r.url))),
      new Promise<'stalled'>((resolve) => {
        probeTimer = setTimeout(() => resolve('stalled'), REDIS_PROBE_MS);
      }),
    ]).finally(() => clearTimeout(probeTimer));
    if (present === 'stalled') {
      redisVerdict = { at: Date.now(), stalled: true };
      return PASS;
    }
    const cold = route.records.filter((_, i) => present[i] !== true);
    if (cold.length === 0) return PASS;

    // 2. The membership index: a slug that cannot exist is the page's 404, not ours to load.
    if (route.index) {
      const index = await withinDeadline(route.index.read().catch(() => null));
      if (index === 'timeout') return { status: 'unavailable', fn: route.index.name, reason: 'timeout' }; // it may exist
      if (index && !index.includes(route.index.slug)) return PASS;
    }

    // 3. Load the cold records, all at once, within what is left of the deadline.
    const outcomes = cold.map((record) => load(record));
    for (let i = 0; i < cold.length; i++) {
      const outcome = await withinDeadline(outcomes[i]);
      if (outcome === 'timeout') return { status: 'unavailable', fn: cold[i].fn, reason: 'timeout' };
      if (outcome === 'failed') return { status: 'unavailable', fn: cold[i].fn, reason: 'failed' };
    }
    return PASS;
  } finally {
    clearTimeout(timer);
  }
}
