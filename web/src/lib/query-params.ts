/**
 * Filter values from the query string (`?typ=a,b`, `?kategorie=x`), reduced to values that
 * exist (`known`, from a cached list), deduplicated and sorted. Unknown values are dropped
 * instead of reaching Strapi: every distinct combination is its own cache key and query, so
 * free text would let anyone mint uncached Strapi requests. A repeated param
 * (`?typ=a&typ=b`) is read as one list.
 */
export function pickKnownSlugs(raw: string | string[] | undefined, known: Iterable<string>): string[] {
  if (raw === undefined) return [];
  const allowed = new Set(known);
  const values = (Array.isArray(raw) ? raw.join(',') : raw).split(',');
  return [...new Set(values.filter((value) => allowed.has(value)))].sort();
}
