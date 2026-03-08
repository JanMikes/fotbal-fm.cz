import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

import { mapFooter } from '@/lib/strapi/mappers/footer';
import type { StrapiRawFooter } from '@/lib/strapi/types';

describe('mapFooter', () => {
  it('maps all footer fields', () => {
    const raw: StrapiRawFooter = {
      id: 1,
      documentId: 'footer-1',
      text: 'Popis klubu',
      address: 'Sportovní 1234',
      mail: 'info@fkfm.cz',
      phone: '+420 558 123 456',
      linkSections: [
        {
          id: 10,
          title: 'Klub',
          links: [
            { id: 100, text: 'O nás', page: { slug: 'o-nas' }, anchor: null, url: null, file: null, disabled: false },
          ],
          sortOrder: 0,
        },
      ],
      bottomLinks: [
        { id: 200, text: 'Ochrana údajů', page: { slug: 'ochrana-udaju' }, anchor: null, url: null, file: null, disabled: false },
      ],
    };

    const result = mapFooter(raw);
    expect(result.text).toBe('Popis klubu');
    expect(result.address).toBe('Sportovní 1234');
    expect(result.mail).toBe('info@fkfm.cz');
    expect(result.phone).toBe('+420 558 123 456');
    expect(result.linkSections).toHaveLength(1);
    expect(result.linkSections[0].title).toBe('Klub');
    expect(result.linkSections[0].links).toHaveLength(1);
    expect(result.linkSections[0].links[0].href).toBe('/o-nas');
    expect(result.bottomLinks).toHaveLength(1);
    expect(result.bottomLinks[0].href).toBe('/ochrana-udaju');
  });

  it('handles null fields gracefully', () => {
    const raw: StrapiRawFooter = {
      id: 1,
      documentId: 'footer-1',
      text: null,
      address: null,
      mail: null,
      phone: null,
      linkSections: null,
      bottomLinks: null,
    };

    const result = mapFooter(raw);
    expect(result.text).toBeNull();
    expect(result.address).toBeNull();
    expect(result.mail).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.linkSections).toEqual([]);
    expect(result.bottomLinks).toEqual([]);
  });

  it('sorts link sections by sortOrder', () => {
    const raw: StrapiRawFooter = {
      id: 1,
      documentId: 'footer-1',
      text: null,
      address: null,
      mail: null,
      phone: null,
      linkSections: [
        { id: 11, title: 'Second', links: [], sortOrder: 2 },
        { id: 10, title: 'First', links: [], sortOrder: 1 },
      ],
      bottomLinks: null,
    };

    const result = mapFooter(raw);
    expect(result.linkSections[0].title).toBe('First');
    expect(result.linkSections[1].title).toBe('Second');
  });

  it('filters out unresolvable links', () => {
    const raw: StrapiRawFooter = {
      id: 1,
      documentId: 'footer-1',
      text: null,
      address: null,
      mail: null,
      phone: null,
      linkSections: [
        {
          id: 10,
          title: 'Section',
          links: [
            { id: 100, text: 'Good', page: { slug: 'good' }, anchor: null, url: null, file: null, disabled: false },
            { id: 101, text: 'Broken', page: null, anchor: null, url: null, file: null, disabled: false },
          ],
          sortOrder: 0,
        },
      ],
      bottomLinks: [
        { id: 200, text: 'Broken', page: null, anchor: null, url: null, file: null, disabled: false },
      ],
    };

    const result = mapFooter(raw);
    expect(result.linkSections[0].links).toHaveLength(1);
    expect(result.linkSections[0].links[0].text).toBe('Good');
    expect(result.bottomLinks).toHaveLength(0);
  });
});
