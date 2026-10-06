import { describe, it, expect } from 'vitest';
import { isPlausibleSlug } from '@/lib/slug';

describe('isPlausibleSlug (Strapi uid charset pre-filter)', () => {
  it.each(['o-klubu', 'muzi-a', 'pripravka-u9', 'Novinka_2026', 'a-b~c', 'x', 'clh3k2m9x0000a8b7c6d5e4f3', 'a'.repeat(120)])(
    'accepts %s',
    (slug) => {
      expect(isPlausibleSlug(slug)).toBe(true);
    },
  );

  it.each([
    ['empty', ''],
    ['121 chars', 'a'.repeat(121)],
    ['percent-encoded traversal', '..%2f..%2fetc'],
    ['slash', '../etc/passwd'],
    ['space', 'o klubu'],
    ['diacritics', 'muži-a'],
    ['query-ish', 'page?x=1'],
    ['null byte', 'a\u0000b'],
  ])('rejects %s', (_label, slug) => {
    expect(isPlausibleSlug(slug)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isPlausibleSlug(undefined)).toBe(false);
    expect(isPlausibleSlug(null)).toBe(false);
  });

  it('rejects dots: scanner favourites and files never reach Strapi (no record slug has a dot — BF-V9)', () => {
    for (const slug of ['.env', 'wp-login.php', 'logo.svg', 'a.b~c', 'index.html', 'x.json']) {
      expect([slug, isPlausibleSlug(slug)]).toEqual([slug, false]);
    }
  });
});
