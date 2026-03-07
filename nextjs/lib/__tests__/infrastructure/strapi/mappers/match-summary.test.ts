import { describe, it, expect, vi } from 'vitest';
import matchFixture from '../../../fixtures/strapi-matches-summary.json';

vi.mock('@/lib/config', () => ({
  config: {
    SESSION_SECRET: 'a'.repeat(32),
    STRAPI_URL: 'http://strapi:1337',
    STRAPI_API_TOKEN: 'a'.repeat(50),
    PUBLIC_UPLOADS_URL: 'http://uploads.test',
    NODE_ENV: 'test',
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_SECURE: 'false',
    EMAIL_FROM: 'test@test.cz',
    EMAIL_TO: 'test@test.cz',
  },
  getPublicUploadsUrl: () => 'http://uploads.test',
  getStrapiUrl: () => 'http://strapi:1337',
  constants: {
    API_TIMEOUT: 10000,
    MAX_FILE_SIZE: 10485760,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },
}));

const { mapMatch, mapMatches } = await import(
  '../../../../infrastructure/strapi/mappers/match'
);

describe('mapMatch with summary (minimal populate) data', () => {
  const summaryItems = matchFixture.data;

  it('maps all summary matches without throwing', () => {
    const results = mapMatches(summaryItems);
    expect(results).toHaveLength(summaryItems.length);
  });

  it('maps team names from summary data', () => {
    const result = mapMatch(summaryItems[0]);
    expect(result.homeTeam).toBe('FC ZBROJOVKA BRNO');
    expect(result.awayTeam).toBe('FK Frýdek-Místek');
  });

  it('maps scores correctly', () => {
    const result = mapMatch(summaryItems[0]);
    expect(result.homeScore).toBe(8);
    expect(result.awayScore).toBe(0);
  });

  it('maps matchDate', () => {
    const result = mapMatch(summaryItems[0]);
    expect(result.matchDate).toBe('2026-03-04');
  });

  it('maps categories from summary data', () => {
    const result = mapMatch(summaryItems[0]);
    expect(result.categories.length).toBeGreaterThan(0);
    expect(result.categories[0]).toEqual(expect.objectContaining({
      name: expect.any(String),
      slug: expect.any(String),
    }));
  });

  it('maps documentId as id', () => {
    const result = mapMatch(summaryItems[0]);
    expect(result.id).toBe(summaryItems[0].documentId);
  });

  it('handles null teams in summary data', () => {
    const withNullTeams = { ...summaryItems[0], homeTeam: null, awayTeam: null };
    const result = mapMatch(withNullTeams);
    expect(result.homeTeam).toBe('');
    expect(result.awayTeam).toBe('');
  });

  it('returns empty arrays for unpopulated images and files', () => {
    const result = mapMatch(summaryItems[0]);
    expect(result.images).toEqual([]);
    expect(result.files).toEqual([]);
  });

  it('team logos are null when not populated', () => {
    const result = mapMatch(summaryItems[0]);
    expect(result.homeTeamLogo).toBeNull();
    expect(result.awayTeamLogo).toBeNull();
  });
});
