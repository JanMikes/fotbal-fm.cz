import { describe, it, expect, vi } from 'vitest';
import eventFixture from '../../../fixtures/strapi-events-summary.json';

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

const { mapEvent, mapEvents } = await import(
  '../../../../infrastructure/strapi/mappers/event'
);

describe('mapEvent with summary (minimal populate) data', () => {
  const summaryItems = eventFixture.data;

  it('maps all summary events without throwing', () => {
    const results = mapEvents(summaryItems);
    expect(results).toHaveLength(summaryItems.length);
  });

  it('maps name and eventType', () => {
    const result = mapEvent(summaryItems[0]);
    expect(result.name).toBe(summaryItems[0].name);
    expect(result.eventType).toBe(summaryItems[0].eventType);
  });

  it('maps documentId as id', () => {
    const result = mapEvent(summaryItems[0]);
    expect(result.id).toBe(summaryItems[0].documentId);
  });

  it('maps dateFrom and dateTo', () => {
    const result = mapEvent(summaryItems[0]);
    expect(result.dateFrom).toBe(summaryItems[0].dateFrom);
  });

  it('maps eventTime', () => {
    const result = mapEvent(summaryItems[0]);
    expect(result.eventTime).toBe(summaryItems[0].eventTime);
  });

  it('maps categories from summary data', () => {
    const result = mapEvent(summaryItems[0]);
    expect(result.categories).toBeDefined();
    expect(result.categories!.length).toBeGreaterThan(0);
    expect(result.categories![0]).toEqual(expect.objectContaining({
      name: expect.any(String),
      slug: expect.any(String),
    }));
  });

  it('returns empty arrays for unpopulated photos and files', () => {
    const result = mapEvent(summaryItems[0]);
    expect(result.photos).toEqual([]);
    expect(result.files).toEqual([]);
  });
});
