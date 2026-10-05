import { describe, it, expect } from 'vitest';
import { pickKnownSlugs } from '@/lib/query-params';

describe('pickKnownSlugs (U13)', () => {
  const known = ['reporty', 'rozhovory', 'vstupenky'];

  it('keeps known values, sorted and deduplicated', () => {
    expect(pickKnownSlugs('vstupenky,reporty,vstupenky', known)).toEqual(['reporty', 'vstupenky']);
  });

  it('drops unknown values (free text never reaches Strapi)', () => {
    expect(pickKnownSlugs('<script>,zzz,'.repeat(3), known)).toEqual([]);
    expect(pickKnownSlugs('reporty,nonsense', known)).toEqual(['reporty']);
  });

  it('handles empty and missing params', () => {
    expect(pickKnownSlugs(undefined, known)).toEqual([]);
    expect(pickKnownSlugs('', known)).toEqual([]);
    expect(pickKnownSlugs(',,', known)).toEqual([]);
  });

  it('reads a repeated param as one list', () => {
    expect(pickKnownSlugs(['rozhovory', 'reporty,zzz'], known)).toEqual(['reporty', 'rozhovory']);
  });

  it('with no known values everything is dropped', () => {
    expect(pickKnownSlugs('reporty', [])).toEqual([]);
  });
});
