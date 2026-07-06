import { describe, it, expect } from 'vitest';
import { parseListParams, combineFilters } from '@/lib/api/list-params';

describe('parseListParams', () => {
  it('returns defaults for empty params', () => {
    const result = parseListParams(new URLSearchParams());
    expect(result).toEqual({ page: 1, pageSize: 10, search: null, category: null });
  });

  it('parses valid page and pageSize', () => {
    const result = parseListParams(new URLSearchParams('page=3&pageSize=25'));
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(25);
  });

  it('falls back to defaults for invalid page values', () => {
    expect(parseListParams(new URLSearchParams('page=abc')).page).toBe(1);
    expect(parseListParams(new URLSearchParams('page=0')).page).toBe(1);
    expect(parseListParams(new URLSearchParams('page=-5')).page).toBe(1);
  });

  it('caps pageSize at the maximum', () => {
    expect(parseListParams(new URLSearchParams('pageSize=500')).pageSize).toBe(50);
  });

  it('trims search and normalizes empty values to null', () => {
    expect(parseListParams(new URLSearchParams('search=  slavia  ')).search).toBe('slavia');
    expect(parseListParams(new URLSearchParams('search=   ')).search).toBeNull();
    expect(parseListParams(new URLSearchParams('category=')).category).toBeNull();
  });

  it('passes category through', () => {
    expect(parseListParams(new URLSearchParams('category=abc123')).category).toBe('abc123');
  });
});

describe('combineFilters', () => {
  it('returns undefined for no conditions', () => {
    expect(combineFilters([])).toBeUndefined();
  });

  it('returns the single condition as-is', () => {
    const condition = { name: { $containsi: 'test' } };
    expect(combineFilters([condition])).toBe(condition);
  });

  it('wraps multiple conditions in $and', () => {
    const a = { categories: { documentId: { $eq: 'x' } } };
    const b = { $or: [{ name: { $containsi: 'y' } }] };
    expect(combineFilters([a, b])).toEqual({ $and: [a, b] });
  });
});
