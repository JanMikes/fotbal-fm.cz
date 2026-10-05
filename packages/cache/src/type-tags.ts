import TYPE_TAGS from './type-tags.json';

/*
 * Content type → tags, for writers that only know a Strapi uid (the transitional webhook
 * endpoint). A separate entry point (`@fotbal-fm/cache/type-tags`) so the JSON import never
 * reaches consumers that don't need it (the api CLIs).
 */

export { TYPE_TAGS };

/**
 * Tags to bump for a write to `uid`. Content types the web never reads → none; an `api::` type
 * missing from the map (added later, not mapped yet) → `all`; plugin/admin types → none.
 */
export function tagsForUid(uid: string): string[] {
  if (!uid.startsWith('api::')) return [];
  const name = uid.slice('api::'.length).split('.')[0];
  if (TYPE_TAGS.ignored.includes(name)) return [];
  return (TYPE_TAGS.typeTags as Record<string, string[]>)[name] ?? ['all'];
}
