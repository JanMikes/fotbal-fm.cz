import { describe, it, expect } from 'vitest';
import { mapCategory, mapCategories } from '../../../../lib/strapi/mappers/category';

describe('mapCategory', () => {
  it('maps raw category to domain category', () => {
    const raw = {
      id: 1,
      documentId: 'cat-1',
      name: 'Muži',
      slug: 'muzi',
      sortOrder: 1,
      hidden: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    expect(mapCategory(raw)).toEqual({
      documentId: 'cat-1',
      name: 'Muži',
      slug: 'muzi',
      sortOrder: 1,
    });
  });

  it('defaults sortOrder to 0 when undefined', () => {
    const raw = {
      id: 1,
      documentId: 'cat-1',
      name: 'Test',
      slug: 'test',
      sortOrder: undefined as any,
    };

    expect(mapCategory(raw).sortOrder).toBe(0);
  });
});

describe('mapCategories', () => {
  it('maps array of raw categories', () => {
    const raw = [
      { id: 1, documentId: 'cat-1', name: 'A', slug: 'a', sortOrder: 1 },
      { id: 2, documentId: 'cat-2', name: 'B', slug: 'b', sortOrder: 2 },
    ];

    const result = mapCategories(raw as any);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('A');
    expect(result[1].name).toBe('B');
  });

  it('returns empty array for null', () => {
    expect(mapCategories(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(mapCategories(undefined)).toEqual([]);
  });
});
