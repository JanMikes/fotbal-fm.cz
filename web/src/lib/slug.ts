/**
 * Cheap pre-filter for dynamic route segments that must be a Strapi `uid` (page, category,
 * article, partner slugs; also player slugs, which are uids or slugify() output, and article
 * documentIds). Strapi's uid charset is `[A-Za-z0-9-_.~]`; anything else — percent-encoded
 * paths, `/`, spaces, non-ASCII, absurd lengths — cannot be a real slug and is 404'd before
 * any data call. It is only a pre-filter: `.env` or `wp-login.php` pass it, the membership
 * indexes (lib/route-guards.ts) reject those.
 */
const PLAUSIBLE_SLUG = /^[A-Za-z0-9._~-]{1,120}$/;

export function isPlausibleSlug(value: string | null | undefined): value is string {
  return typeof value === 'string' && PLAUSIBLE_SLUG.test(value);
}
