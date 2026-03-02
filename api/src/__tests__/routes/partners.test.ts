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

const mockPartners = {
  data: [
    {
      id: 1,
      documentId: 'partner-1',
      name: 'Hlavní sponzor s.r.o.',
      slug: 'hlavni-sponzor',
      logo: {
        id: 60,
        url: '/uploads/sponzor_logo.png',
        alternativeText: 'Hlavní sponzor',
        width: 300,
        height: 100,
      },
      description: 'Generální partner klubu od roku 2015.',
      sortOrder: 1,
      content: [],
      panel: null,
    },
    {
      id: 2,
      documentId: 'partner-2',
      name: 'Město Frýdek-Místek',
      slug: 'mesto-frydek-mistek',
      logo: null,
      description: null,
      sortOrder: 2,
      content: [],
      panel: null,
    },
  ],
  meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 2 } },
};

const mockPartnerDetail = {
  data: [
    {
      id: 1,
      documentId: 'partner-1',
      name: 'Hlavní sponzor s.r.o.',
      slug: 'hlavni-sponzor',
      logo: {
        id: 60,
        url: '/uploads/sponzor_logo.png',
        alternativeText: 'Hlavní sponzor',
        width: 300,
        height: 100,
      },
      description: 'Generální partner klubu od roku 2015.',
      sortOrder: 1,
      content: [
        {
          id: 1,
          __component: 'components.text',
          text: '<p>Hlavní sponzor s.r.o. je naším generálním partnerem.</p>',
        },
        {
          id: 2,
          __component: 'components.heading',
          text: 'O partnerovi',
          type: 'h2',
          anchor: 'o-partnerovi',
        },
        {
          id: 3,
          __component: 'components.image',
          image: {
            id: 61,
            url: '/uploads/sponzor_office.jpg',
            alternativeText: 'Kancelář sponzora',
            width: 800,
            height: 600,
          },
        },
      ],
      panel: [
        {
          id: 4,
          __component: 'components.contact-cards',
          cards: [
            {
              name: 'Jan Manažer',
              role: 'Ředitel',
              phone: '+420 123 456 789',
              email: 'jan@sponzor.cz',
              photo: {
                id: 62,
                url: '/uploads/jan_manazer.jpg',
                alternativeText: null,
                width: 200,
                height: 200,
              },
            },
          ],
        },
      ],
    },
  ],
  meta: {},
};

describe('GET /api/v1/partners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns partner list with logos', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockPartners);

    const res = await app.request('/api/v1/partners');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      documentId: 'partner-1',
      name: 'Hlavní sponzor s.r.o.',
      slug: 'hlavni-sponzor',
      logo: {
        url: 'http://localhost:8080/uploads/sponzor_logo.png',
        alternativeText: 'Hlavní sponzor',
        width: 300,
        height: 100,
      },
      description: 'Generální partner klubu od roku 2015.',
      sortOrder: 1,
    });
    expect(json.data[1].logo).toBeNull();
    expect(json.data[1].description).toBeNull();
  });
});

describe('GET /api/v1/partners/:slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns partner detail with dynamic zone content', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockPartnerDetail);

    const res = await app.request('/api/v1/partners/hlavni-sponzor');
    expect(res.status).toBe(200);

    const json = await res.json();
    const partner = json.data;
    expect(partner.documentId).toBe('partner-1');
    expect(partner.logo.url).toBe('http://localhost:8080/uploads/sponzor_logo.png');

    // Check dynamic zone content
    expect(partner.content).toHaveLength(3);
    expect(partner.content[0].__component).toBe('components.text');
    expect(partner.content[0].text).toContain('generálním partnerem');
    expect(partner.content[1].__component).toBe('components.heading');
    expect(partner.content[1].text).toBe('O partnerovi');
    expect(partner.content[2].__component).toBe('components.image');
    expect(partner.content[2].image.url).toBe('http://localhost:8080/uploads/sponzor_office.jpg');

    // Check panel
    expect(partner.panel).toHaveLength(1);
    expect(partner.panel[0].__component).toBe('components.contact-cards');
    expect(partner.panel[0].cards[0].name).toBe('Jan Manažer');
    expect(partner.panel[0].cards[0].photo.url).toBe('http://localhost:8080/uploads/jan_manazer.jpg');
  });

  it('returns 404 for non-existent partner', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    const res = await app.request('/api/v1/partners/nonexistent');
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Partner not found');
  });
});
