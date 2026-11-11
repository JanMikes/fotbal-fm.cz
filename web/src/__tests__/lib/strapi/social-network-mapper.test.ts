import { describe, expect, it } from 'vitest';
import { mapSocialLinks } from '@/lib/strapi/mappers/social-network';

const raw = (links: { network: string | null; url: string | null }[]) => ({
  id: 1,
  documentId: 'd',
  links: links.map((l, i) => ({ id: i, ...l })),
});

describe('mapSocialLinks', () => {
  it('keeps the Strapi order and labels the generic icons', () => {
    expect(mapSocialLinks(raw([
      { network: 'Instagram', url: 'https://www.instagram.com/fotbal_fm/' },
      { network: 'Eshop', url: 'https://shop.example.cz' },
    ]))).toEqual([
      { network: 'Instagram', href: 'https://www.instagram.com/fotbal_fm/', label: 'Instagram' },
      { network: 'Eshop', href: 'https://shop.example.cz/', label: 'E-shop' },
    ]);
  });

  it('adds https:// to a bare domain', () => {
    expect(mapSocialLinks(raw([{ network: 'Facebook', url: ' facebook.com/fotbalfm ' }]))[0].href)
      .toBe('https://facebook.com/fotbalfm');
  });

  it('drops unknown networks, empty URLs and non-http(s) schemes', () => {
    expect(mapSocialLinks(raw([
      { network: 'MySpace', url: 'https://myspace.com' },
      { network: 'Facebook', url: '' },
      { network: 'Facebook', url: null },
      { network: 'Facebook', url: 'javascript:alert(1)' },
      { network: null, url: 'https://x.com' },
    ]))).toEqual([]);
  });

  it('never returns more than 5 icons and survives a missing list', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ network: 'Web', url: `https://e${i}.cz` }));
    expect(mapSocialLinks(raw(six))).toHaveLength(5);
    expect(mapSocialLinks({ id: 1, documentId: 'd', links: null })).toEqual([]);
  });
});
