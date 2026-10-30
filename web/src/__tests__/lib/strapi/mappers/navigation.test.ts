import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

import { mapNavigation } from '@/lib/strapi/mappers/navigation';
import type { StrapiRawNavigation } from '@/lib/strapi/types';

describe('mapNavigation', () => {
  it('maps navigation with page link', () => {
    const raw: StrapiRawNavigation = {
      id: 1,
      documentId: 'nav-1',
      title: 'O klubu',
      link: {
        id: 10,
        page: { slug: 'o-klubu' },
        anchor: null,
        url: null,
        file: null,
      },
      level: 'Úroveň 1',
      sortOrder: 0,
    };

    const result = mapNavigation(raw);
    expect(result).toEqual({
      title: 'O klubu',
      href: '/o-klubu',
      external: false,
      level: 1,
    });
  });

  it('maps navigation with external URL', () => {
    const raw: StrapiRawNavigation = {
      id: 2,
      documentId: 'nav-2',
      title: 'FAČR',
      link: {
        id: 20,
        page: null,
        anchor: null,
        url: 'https://facr.cz',
        file: null,
      },
      level: 'Úroveň 1',
      sortOrder: 1,
    };

    const result = mapNavigation(raw);
    expect(result).toEqual({
      title: 'FAČR',
      href: 'https://facr.cz',
      external: true,
      level: 1,
    });
  });

  it('returns null when link has no target', () => {
    const raw: StrapiRawNavigation = {
      id: 3,
      documentId: 'nav-3',
      title: 'Broken',
      link: {
        id: 30,
        page: null,
        anchor: null,
        url: null,
        file: null,
      },
      level: 'Úroveň 1',
      sortOrder: 2,
    };

    expect(mapNavigation(raw)).toBeNull();
  });

  it('returns null when link is null', () => {
    const raw: StrapiRawNavigation = {
      id: 4,
      documentId: 'nav-4',
      title: 'No Link',
      link: null,
      level: 'Úroveň 1',
      sortOrder: 3,
    };

    expect(mapNavigation(raw)).toBeNull();
  });

  it('maps navigation with anchor link', () => {
    const raw: StrapiRawNavigation = {
      id: 5,
      documentId: 'nav-5',
      title: 'Kontakty',
      link: {
        id: 50,
        page: { slug: 'o-klubu' },
        anchor: 'kontakty',
        url: null,
        file: null,
      },
      level: 'Úroveň 1',
      sortOrder: 4,
    };

    const result = mapNavigation(raw);
    expect(result).toEqual({
      title: 'Kontakty',
      href: '/o-klubu#kontakty',
      external: false,
      level: 1,
    });
  });

  it('maps level 2 items to the second row', () => {
    const raw: StrapiRawNavigation = {
      id: 6,
      documentId: 'nav-6',
      title: 'Obchod JOMA',
      link: { id: 60, page: null, anchor: null, url: 'https://joma.cz', file: null },
      level: 'Úroveň 2',
      sortOrder: 5,
    };

    expect(mapNavigation(raw)?.level).toBe(2);
  });

  it('treats a missing level (items created before the field) as level 1', () => {
    const raw: StrapiRawNavigation = {
      id: 7,
      documentId: 'nav-7',
      title: 'O klubu',
      link: { id: 70, page: { slug: 'o-klubu' }, anchor: null, url: null, file: null },
      level: null,
      sortOrder: 0,
    };

    expect(mapNavigation(raw)?.level).toBe(1);
  });
});
