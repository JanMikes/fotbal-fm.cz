/**
 * Change detection for the FAČR sync scripts.
 *
 * Strapi bumps `updatedAt` and fires the cache-clear webhook on every PUT,
 * even when the payload equals what is stored. The syncs run every 15 minutes,
 * so writing unconditionally made every current-season match look edited at
 * the last tick in the backoffice. They compare what they would write with
 * what is stored and skip the PUT when nothing differs.
 */

type RelationRef = { documentId?: string | null } | null | undefined;

/** documentId of a populated to-one relation, or null when unset. */
export function relationId(relation: RelationRef): string | null {
  return relation?.documentId ?? null;
}

/** documentIds of a populated to-many relation. */
export function relationIds(relations: RelationRef[] | null | undefined): string[] {
  return (relations ?? [])
    .map((relation) => relation?.documentId)
    .filter((id): id is string => typeof id === 'string' && id !== '');
}

/**
 * null, undefined, '' and [] all mean "empty" (Strapi returns null for a
 * string the scraper sends as ''); arrays are relation id lists, compared as
 * sets.
 */
function normalize(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((item) => String(item)).sort();
  }
  return value;
}

/**
 * Names of the fields in `desired` (the payload the sync would PUT) whose
 * value differs from `stored` (the entry as loaded from Strapi, relations
 * reduced with relationId/relationIds). Keys whose desired value is
 * undefined are left out of the JSON payload, so they are not compared.
 */
export function changedFields(
  stored: Record<string, unknown>,
  desired: Record<string, unknown>,
): string[] {
  const changed: string[] = [];
  for (const [field, value] of Object.entries(desired)) {
    if (value === undefined) continue;
    if (JSON.stringify(normalize(stored[field])) !== JSON.stringify(normalize(value))) {
      changed.push(field);
    }
  }
  return changed;
}
