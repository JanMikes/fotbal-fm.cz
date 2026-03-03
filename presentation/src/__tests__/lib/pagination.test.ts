import { describe, it, expect } from 'vitest';
import { generatePageNumbers, buildPageHref } from '../../lib/pagination';

describe('buildPageHref', () => {
  it('returns clean baseHref for page 1', () => {
    expect(buildPageHref('/kategorie/muzi/novinky', 1)).toBe('/kategorie/muzi/novinky');
  });

  it('appends query param for page > 1', () => {
    expect(buildPageHref('/kategorie/muzi/novinky', 2)).toBe('/kategorie/muzi/novinky?stranka=2');
  });

  it('uses custom param name', () => {
    expect(buildPageHref('/news', 3, 'page')).toBe('/news?page=3');
  });
});

describe('generatePageNumbers', () => {
  it('returns empty array for totalPages <= 1', () => {
    expect(generatePageNumbers(1, 0)).toEqual([]);
    expect(generatePageNumbers(1, 1)).toEqual([]);
  });

  it('returns all pages for small total', () => {
    expect(generatePageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(generatePageNumbers(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it('always includes first and last page', () => {
    const pages = generatePageNumbers(5, 10);
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(10);
  });

  it('includes pages around current page', () => {
    const pages = generatePageNumbers(5, 10);
    expect(pages).toContain(4);
    expect(pages).toContain(5);
    expect(pages).toContain(6);
  });

  it('adds ellipsis for gaps', () => {
    const pages = generatePageNumbers(5, 10);
    // Should be: [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
    expect(pages).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  });

  it('no leading ellipsis when current is near start', () => {
    const pages = generatePageNumbers(2, 10);
    // Should be: [1, 2, 3, 'ellipsis', 10]
    expect(pages).toEqual([1, 2, 3, 'ellipsis', 10]);
  });

  it('no trailing ellipsis when current is near end', () => {
    const pages = generatePageNumbers(9, 10);
    // Should be: [1, 'ellipsis', 8, 9, 10]
    expect(pages).toEqual([1, 'ellipsis', 8, 9, 10]);
  });

  it('handles current page at start', () => {
    const pages = generatePageNumbers(1, 5);
    // Should be: [1, 2, 'ellipsis', 5]
    expect(pages).toEqual([1, 2, 'ellipsis', 5]);
  });

  it('handles current page at end', () => {
    const pages = generatePageNumbers(5, 5);
    // Should be: [1, 'ellipsis', 4, 5]
    expect(pages).toEqual([1, 'ellipsis', 4, 5]);
  });

  it('handles 2 pages', () => {
    expect(generatePageNumbers(1, 2)).toEqual([1, 2]);
    expect(generatePageNumbers(2, 2)).toEqual([1, 2]);
  });
});
