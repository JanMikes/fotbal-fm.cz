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
      sortOrder: 0,
    };

    const result = mapNavigation(raw);
    expect(result).toEqual({
      title: 'O klubu',
      href: '/o-klubu',
      external: false,
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
      sortOrder: 1,
    };

    const result = mapNavigation(raw);
    expect(result).toEqual({
      title: 'FAČR',
      href: 'https://facr.cz',
      external: true,
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
      sortOrder: 4,
    };

    const result = mapNavigation(raw);
    expect(result).toEqual({
      title: 'Kontakty',
      href: '/o-klubu#kontakty',
      external: false,
    });
  });
});
