import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TAGS } from '../tags';
import { TYPE_TAGS, tagsForUid } from '../type-tags';

// U2b (cross-repo): Strapi bumps tags from strapi/src/cache-tags.json, the web reads tags from
// packages/cache/src/type-tags.json — they must be the same file, and every tag the web declares
// must be one Strapi can bump.

const ROOT = path.resolve(__dirname, '../../../..');

describe('type → tags map', () => {
  it('strapi/src/cache-tags.json is a byte-identical copy of packages/cache/src/type-tags.json', () => {
    const web = readFileSync(path.join(ROOT, 'packages/cache/src/type-tags.json'), 'utf8');
    const strapi = readFileSync(path.join(ROOT, 'strapi/src/cache-tags.json'), 'utf8');
    expect(strapi).toBe(web);
  });

  it('every tag the web declares is bumpable (a type tag, media or all)', () => {
    const bumpable = new Set([...Object.values(TYPE_TAGS.typeTags).flat(), 'media', 'all']);
    for (const tag of Object.values(TAGS)) expect(bumpable).toContain(tag);
  });

  it('every tag Strapi can bump is one the web knows', () => {
    const known = new Set<string>(Object.values(TAGS));
    for (const tag of Object.values(TYPE_TAGS.typeTags).flat()) expect(known).toContain(tag);
  });

  it('no content type is both mapped and ignored', () => {
    for (const name of TYPE_TAGS.ignored) expect(TYPE_TAGS.typeTags).not.toHaveProperty([name]);
  });
});

describe('tagsForUid', () => {
  it('maps api:: types through the map', () => {
    expect(tagsForUid('api::match.match')).toEqual(['match']);
    expect(tagsForUid('api::category-code.category-code')).toEqual(['match', 'standing']);
  });

  it('ignored types bump nothing, unknown api:: types bump all, plugin types nothing', () => {
    expect(tagsForUid('api::social-export-state.social-export-state')).toEqual([]);
    expect(tagsForUid('api::brand-new.brand-new')).toEqual(['all']);
    expect(tagsForUid('plugin::users-permissions.user')).toEqual([]);
    expect(tagsForUid('admin::user')).toEqual([]);
  });
});
