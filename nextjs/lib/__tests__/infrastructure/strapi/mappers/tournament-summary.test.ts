import { describe, it, expect, vi } from 'vitest';
import tournamentFixture from '../../../fixtures/strapi-tournaments-summary.json';

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

const { mapTournament, mapTournaments } = await import(
  '../../../../infrastructure/strapi/mappers/tournament'
);

describe('mapTournament with summary (minimal populate) data', () => {
  const summaryItems = tournamentFixture.data;

  it('maps all summary tournaments without throwing', () => {
    const results = mapTournaments(summaryItems);
    expect(results).toHaveLength(summaryItems.length);
  });

  it('maps name correctly', () => {
    const result = mapTournament(summaryItems[0]);
    expect(result.name).toBe(summaryItems[0].name);
  });

  it('maps documentId as id', () => {
    const result = mapTournament(summaryItems[0]);
    expect(result.id).toBe(summaryItems[0].documentId);
  });

  it('maps categories from summary data', () => {
    const result = mapTournament(summaryItems[0]);
    expect(result.categories.length).toBeGreaterThan(0);
    expect(result.categories[0]).toEqual(expect.objectContaining({
      name: expect.any(String),
      slug: expect.any(String),
    }));
  });

  it('returns empty arrays for unpopulated photos', () => {
    const result = mapTournament(summaryItems[0]);
    expect(result.photos).toEqual([]);
  });

  it('returns empty array for unpopulated matches', () => {
    const result = mapTournament(summaryItems[0]);
    expect(result.matches).toEqual([]);
  });

  it('returns empty array for unpopulated players', () => {
    const result = mapTournament(summaryItems[0]);
    expect(result.players).toEqual([]);
  });

  it('maps season and facrId', () => {
    const result = mapTournament(summaryItems[0]);
    expect(result.season).toBe(summaryItems[0].season);
    expect(result.facrId).toBe(summaryItems[0].facrId);
  });
});
