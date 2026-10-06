/**
 * Cheap pre-filter for dynamic route segments that must be a record slug (page, category, article,
 * partner slugs; also player slugs, which are uids or slugify() output, and article documentIds):
 * letters, digits, `-`, `_`, `~`, at most 120 characters. Anything else — percent-encoded paths,
 * `/`, spaces, non-ASCII, absurd lengths, and DOTS — cannot be a real slug and is 404'd before any
 * data call. Strapi's uid charset would allow `.`, but no record slug on prod has one (0 of 903:
 * pages, categories, articles, partners, players, deep links; 2026-10-06), while dotted paths are
 * what scanners and files look like (`/wp-login.php`, `/.env`, `/logo.svg`): rejecting them here
 * keeps them from ever reaching Strapi — or, with a cold slug index during a Strapi outage, from
 * waiting for it and erroring (review BF-V9). The record gate (lib/record-gate.ts) uses the same rule.
 */
const PLAUSIBLE_SLUG = /^[A-Za-z0-9_~-]{1,120}$/;

export function isPlausibleSlug(value: string | null | undefined): value is string {
  return typeof value === 'string' && PLAUSIBLE_SLUG.test(value);
}
