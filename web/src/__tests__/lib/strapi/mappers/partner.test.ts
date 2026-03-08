import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

import { mapPartner, mapPartnerDetail } from '@/lib/strapi/mappers/partner';
import type { StrapiRawPartner } from '@/lib/strapi/types';

function makeRawPartner(overrides: Partial<StrapiRawPartner> = {}): StrapiRawPartner {
  return {
    id: 1,
    documentId: 'partner-1',
    name: 'Test Partner',
    slug: 'test-partner',
    logo: null,
    description: 'A test partner',
    sortOrder: 5,
    content: [],
    panel: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('mapPartner', () => {
  it('maps basic fields', () => {
    const result = mapPartner(makeRawPartner());
    expect(result.documentId).toBe('partner-1');
    expect(result.name).toBe('Test Partner');
    expect(result.slug).toBe('test-partner');
    expect(result.description).toBe('A test partner');
    expect(result.sortOrder).toBe(5);
  });

  it('maps logo media with URL transform', () => {
    const result = mapPartner(makeRawPartner({
      logo: { url: '/uploads/logo.png', alternativeText: 'Logo', width: 200, height: 100, name: 'logo.png' },
    }));
    expect(result.logo).not.toBeNull();
    expect(result.logo!.url).toBe('http://uploads.test/uploads/logo.png');
    expect(result.logo!.alternativeText).toBe('Logo');
    expect(result.logo!.width).toBe(200);
    expect(result.logo!.height).toBe(100);
  });

  it('handles null logo', () => {
    const result = mapPartner(makeRawPartner({ logo: null }));
    expect(result.logo).toBeNull();
  });

  it('handles null description', () => {
    const result = mapPartner(makeRawPartner({ description: null }));
    expect(result.description).toBeNull();
  });

  it('defaults sortOrder to 0 when undefined', () => {
    const raw = makeRawPartner();
    // @ts-expect-error testing undefined case
    raw.sortOrder = undefined;
    const result = mapPartner(raw);
    expect(result.sortOrder).toBe(0);
  });
});

describe('mapPartnerDetail', () => {
  it('includes basic partner fields', () => {
    const result = mapPartnerDetail(makeRawPartner());
    expect(result.documentId).toBe('partner-1');
    expect(result.name).toBe('Test Partner');
  });

  it('maps content dynamic zone', () => {
    const result = mapPartnerDetail(makeRawPartner({
      content: [
        { id: 10, __component: 'components.text', text: '<p>Hello</p>' },
      ],
    }));
    expect(result.content).toHaveLength(1);
    expect(result.content[0].__component).toBe('components.text');
  });

  it('maps panel dynamic zone', () => {
    const result = mapPartnerDetail(makeRawPartner({
      panel: [
        { id: 20, __component: 'components.heading', text: 'Side', type: 'h3', anchor: null },
      ],
    }));
    expect(result.panel).toHaveLength(1);
    expect(result.panel[0].__component).toBe('components.heading');
  });

  it('defaults null panel to empty array', () => {
    const result = mapPartnerDetail(makeRawPartner({ panel: null }));
    expect(result.panel).toEqual([]);
  });

  it('defaults empty content to empty array', () => {
    const result = mapPartnerDetail(makeRawPartner({ content: [] }));
    expect(result.content).toEqual([]);
  });
});
