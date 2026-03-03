import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiGetWithPagination: vi.fn(),
  strapiGetSingleEntry: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

const { strapiGet } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

const mockEvents = {
  data: [
    {
      id: 1,
      documentId: 'evt-1',
      name: 'Vánoční turnaj přípravek',
      eventType: 'nadcházející',
      dateFrom: '2025-12-20',
      dateTo: '2025-12-21',
      eventTime: '09:00:00',
      eventTimeTo: '16:00:00',
      description: 'Tradiční vánoční turnaj pro přípravky U8 a U9.',
      photos: [
        {
          id: 10,
          url: '/uploads/turnaj_2024_abc123.jpg',
          alternativeText: 'Vánoční turnaj 2024',
          width: 1200,
          height: 800,
        },
        {
          id: 11,
          url: '/uploads/turnaj_2024_def456.jpg',
          alternativeText: null,
          width: 800,
          height: 600,
        },
      ],
      categories: [
        { id: 5, documentId: 'cat-5', name: 'Přípravka U9', slug: 'pripravka-u9', sortOrder: 5 },
      ],
    },
    {
      id: 2,
      documentId: 'evt-2',
      name: 'Setkání fanoušků',
      eventType: 'proběhlá',
      dateFrom: '2025-11-15',
      dateTo: null,
      eventTime: '18:00:00',
      eventTimeTo: null,
      description: null,
      photos: null,
      categories: [
        { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
      ],
    },
  ],
  meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 2 } },
};

describe('GET /api/v1/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped events', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockEvents);

    const res = await app.request('/api/v1/events');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      documentId: 'evt-1',
      name: 'Vánoční turnaj přípravek',
      eventType: 'nadcházející',
      dateFrom: '2025-12-20',
      dateTo: '2025-12-21',
      eventTime: '09:00:00',
      eventTimeTo: '16:00:00',
      description: '<p>Tradiční vánoční turnaj pro přípravky U8 a U9.</p>\n',
      photos: [
        {
          url: 'http://localhost:8080/uploads/turnaj_2024_abc123.jpg',
          alternativeText: 'Vánoční turnaj 2024',
          width: 1200,
          height: 800,
        },
        {
          url: 'http://localhost:8080/uploads/turnaj_2024_def456.jpg',
          alternativeText: null,
          width: 800,
          height: 600,
        },
      ],
      categories: [{ documentId: 'cat-5', name: 'Přípravka U9', slug: 'pripravka-u9' }],
    });
  });

  it('handles events with null photos and description', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockEvents);

    const res = await app.request('/api/v1/events');
    const json = await res.json();

    expect(json.data[1].photos).toEqual([]);
    expect(json.data[1].description).toBeNull();
    expect(json.data[1].dateTo).toBeNull();
    expect(json.data[1].eventTimeTo).toBeNull();
  });

  it('passes category filter to Strapi', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    await app.request('/api/v1/events?category=a-tym');

    expect(strapiGet).toHaveBeenCalledWith('/events', expect.objectContaining({
      filters: { categories: { slug: { $eq: 'a-tym' } } },
    }));
  });

  it('returns empty array when no events', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    const res = await app.request('/api/v1/events');
    const json = await res.json();
    expect(json.data).toEqual([]);
  });
});
