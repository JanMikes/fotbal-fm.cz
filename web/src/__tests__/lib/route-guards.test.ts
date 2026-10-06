import { describe, it, expect, vi, beforeEach } from 'vitest';

// The [slug] / kategorie membership guards. BF-V9: a dotted slug (scanner paths, files) is unknown
// at once, with no index read — with a cold index during a Strapi outage it used to fall through
// to the record lookup and wait (40 s → 500 for /wp-login.php).

const getPageSlugIndex = vi.fn();
const getCategorySlugIndex = vi.fn();
vi.mock('@/lib/strapi/data', () => ({ getPageSlugIndex, getCategorySlugIndex }));

const { isKnownPageSlug, isKnownCategorySlug } = await import('@/lib/route-guards');

beforeEach(() => {
  getPageSlugIndex.mockReset().mockResolvedValue(['kontakty']);
  getCategorySlugIndex.mockReset().mockResolvedValue(['muzi-a']);
});

describe('route guards', () => {
  it.each(['wp-login.php', '.env', 'logo.svg', 'index.html', 'kontakty.json'])('%s is unknown without reading an index', async (slug) => {
    expect(await isKnownPageSlug(slug)).toBe(false);
    expect(await isKnownCategorySlug(slug)).toBe(false);
    expect(getPageSlugIndex).not.toHaveBeenCalled();
    expect(getCategorySlugIndex).not.toHaveBeenCalled();
  });

  it('a slug the index lists is known; one it does not list is not', async () => {
    expect(await isKnownPageSlug('kontakty')).toBe(true);
    expect(await isKnownPageSlug('neexistuje')).toBe(false);
    expect(await isKnownCategorySlug('muzi-a')).toBe(true);
  });

  it('an index that cannot tell (null) lets the request through to the record lookup — never a false 404', async () => {
    getPageSlugIndex.mockResolvedValue(null);
    expect(await isKnownPageSlug('kontakty')).toBe(true);
  });
});
