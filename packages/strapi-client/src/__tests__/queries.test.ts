import { describe, it, expect } from 'vitest';
import { buildStrapiQueryString } from '../queries';

describe('buildStrapiQueryString', () => {
  it('returns empty string for empty options', () => {
    expect(buildStrapiQueryString({})).toBe('');
  });

  // Populate
  describe('populate', () => {
    it('handles string populate', () => {
      const result = buildStrapiQueryString({ populate: 'mainPhoto' });
      expect(result).toBe('?populate=mainPhoto');
    });

    it('handles array populate', () => {
      const result = buildStrapiQueryString({ populate: ['mainPhoto', 'categories'] });
      expect(result).toBe('?populate%5B0%5D=mainPhoto&populate%5B1%5D=categories');
    });

    it('handles object populate (nested)', () => {
      const result = buildStrapiQueryString({
        populate: {
          mainPhoto: { fields: ['url', 'alternativeText'] },
        },
      });
      expect(result).toContain('populate%5BmainPhoto%5D%5Bfields%5D%5B0%5D=url');
      expect(result).toContain('populate%5BmainPhoto%5D%5Bfields%5D%5B1%5D=alternativeText');
    });

    it('handles deeply nested object populate', () => {
      const result = buildStrapiQueryString({
        populate: {
          relatedNews: {
            populate: {
              mainPhoto: { fields: ['url'] },
            },
          },
        },
      });
      expect(result).toContain('populate%5BrelatedNews%5D%5Bpopulate%5D%5BmainPhoto%5D%5Bfields%5D%5B0%5D=url');
    });
  });

  // Filters
  describe('filters', () => {
    it('handles simple filter', () => {
      const result = buildStrapiQueryString({
        filters: { hidden: { $ne: true } },
      });
      expect(result).toBe('?filters%5Bhidden%5D%5B%24ne%5D=true');
    });

    it('handles nested filter', () => {
      const result = buildStrapiQueryString({
        filters: { categories: { slug: { $eq: 'men' } } },
      });
      expect(result).toBe('?filters%5Bcategories%5D%5Bslug%5D%5B%24eq%5D=men');
    });
  });

  // Sort
  describe('sort', () => {
    it('handles string sort', () => {
      const result = buildStrapiQueryString({ sort: 'sortOrder:asc' });
      expect(result).toBe('?sort=sortOrder%3Aasc');
    });

    it('handles array sort', () => {
      const result = buildStrapiQueryString({ sort: ['sortOrder:asc', 'name:desc'] });
      expect(result).toBe('?sort%5B0%5D=sortOrder%3Aasc&sort%5B1%5D=name%3Adesc');
    });
  });

  // Pagination
  describe('pagination', () => {
    it('handles page and pageSize', () => {
      const result = buildStrapiQueryString({ pagination: { page: 2, pageSize: 10 } });
      expect(result).toContain('pagination%5Bpage%5D=2');
      expect(result).toContain('pagination%5BpageSize%5D=10');
    });

    it('handles limit only', () => {
      const result = buildStrapiQueryString({ pagination: { limit: 50 } });
      expect(result).toBe('?pagination%5Blimit%5D=50');
    });

    it('handles partial pagination', () => {
      const result = buildStrapiQueryString({ pagination: { pageSize: 100 } });
      expect(result).toBe('?pagination%5BpageSize%5D=100');
    });
  });

  // Fields
  describe('fields', () => {
    it('handles fields array', () => {
      const result = buildStrapiQueryString({ fields: ['url', 'alternativeText', 'width'] });
      expect(result).toContain('fields%5B0%5D=url');
      expect(result).toContain('fields%5B1%5D=alternativeText');
      expect(result).toContain('fields%5B2%5D=width');
    });
  });

  // Combined
  it('handles combined options', () => {
    const result = buildStrapiQueryString({
      populate: 'mainPhoto',
      filters: { hidden: { $ne: true } },
      sort: 'sortOrder:asc',
      pagination: { pageSize: 100 },
      fields: ['name', 'slug'],
    });
    expect(result).toContain('populate=mainPhoto');
    expect(result).toContain('filters%5Bhidden%5D%5B%24ne%5D=true');
    expect(result).toContain('sort=sortOrder%3Aasc');
    expect(result).toContain('pagination%5BpageSize%5D=100');
    expect(result).toContain('fields%5B0%5D=name');
    expect(result).toContain('fields%5B1%5D=slug');
  });
});
