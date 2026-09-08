import { describe, it, expect } from 'vitest';
import { deepLinkStatus, mapDeepLink } from '@/lib/strapi/mappers/deep-link';
import type { StrapiRawDeepLink } from '@/lib/strapi/types';

const now = new Date('2026-09-08T12:00:00Z');

const raw: StrapiRawDeepLink = {
  id: 1,
  documentId: 'dl-1',
  name: 'Rodiče U12 podzim',
  code: '7K3M9PQ2',
  url: 'https://fotbal-fm.cz/a/7K3M9PQ2',
  active: true,
  expiresAt: null,
  audienceCategories: [
    { id: 2, documentId: 'ac-2', name: 'Fanoušci', slug: 'fanousci', description: null, sortOrder: 2, selectable: true },
    { id: 1, documentId: 'ac-1', name: 'Rodiče U12', slug: 'rodice-u12', description: 'Rodiče hráčů', sortOrder: 1, selectable: true },
  ],
};

describe('deepLinkStatus', () => {
  it('is valid when active and unexpired', () => {
    expect(deepLinkStatus(raw, now)).toBe('valid');
  });

  it('reports inactive before expired, and expired from the expiry instant', () => {
    expect(deepLinkStatus({ active: false, expiresAt: '2020-01-01T00:00:00Z' }, now)).toBe('inactive');
    expect(deepLinkStatus({ active: true, expiresAt: '2026-09-08T12:00:00Z' }, now)).toBe('expired');
    expect(deepLinkStatus({ active: true, expiresAt: '2026-09-09T00:00:00Z' }, now)).toBe('valid');
  });
});

describe('mapDeepLink', () => {
  it('maps the public fields and sorts categories by sortOrder', () => {
    expect(mapDeepLink(raw, now)).toEqual({
      code: '7K3M9PQ2',
      url: 'https://fotbal-fm.cz/a/7K3M9PQ2',
      name: 'Rodiče U12 podzim',
      status: 'valid',
      audienceCategories: [
        { slug: 'rodice-u12', name: 'Rodiče U12', description: 'Rodiče hráčů' },
        { slug: 'fanousci', name: 'Fanoušci', description: null },
      ],
    });
  });

  it('tolerates a missing relation', () => {
    expect(mapDeepLink({ ...raw, audienceCategories: null }, now).audienceCategories).toEqual([]);
  });
});
