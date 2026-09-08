import { describe, it, expect } from 'vitest';
import { candidateCodes, deepLinkValidity } from '../../lib/deep-links.js';
import type { StrapiRawDeepLink } from '../../types/strapi.js';

function link(overrides: Partial<StrapiRawDeepLink> = {}): StrapiRawDeepLink {
  return {
    id: 1,
    documentId: 'dl-1',
    name: 'Test',
    code: '7K3M9PQ2',
    url: 'https://fotbal-fm.cz/a/7K3M9PQ2',
    active: true,
    expiresAt: null,
    claimsCount: 0,
    audienceCategories: [],
    ...overrides,
  };
}

describe('candidateCodes', () => {
  it('uppercases and strips dashes and spaces', () => {
    expect(candidateCodes(' 7k3m-9pq2 ')).toEqual(['7K3M9PQ2']);
  });

  it('adds the Crockford variant when the input contains I, L or O', () => {
    expect(candidateCodes('7K3MOPQL')).toEqual(['7K3MOPQL', '7K3M0PQ1']);
  });

  it('rejects empty, overlong and non-alphanumeric input', () => {
    expect(candidateCodes('')).toEqual([]);
    expect(candidateCodes('A'.repeat(33))).toEqual([]);
    expect(candidateCodes('7K3M9PQ2?')).toEqual([]);
  });
});

describe('deepLinkValidity', () => {
  const now = new Date('2026-09-08T12:00:00Z');

  it('is valid when active and not expired', () => {
    expect(deepLinkValidity(link(), now)).toBeNull();
    expect(deepLinkValidity(link({ expiresAt: '2026-12-31T00:00:00Z' }), now)).toBeNull();
  });

  it('reports inactive before expired', () => {
    expect(deepLinkValidity(link({ active: false, expiresAt: '2020-01-01T00:00:00Z' }), now)).toBe('inactive');
  });

  it('reports expired at and after the expiry instant', () => {
    expect(deepLinkValidity(link({ expiresAt: '2026-09-08T12:00:00Z' }), now)).toBe('expired');
    expect(deepLinkValidity(link({ expiresAt: '2026-09-01T00:00:00Z' }), now)).toBe('expired');
  });
});
