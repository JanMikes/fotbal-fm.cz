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

const { strapiGet, strapiGetWithPagination } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

const mockArticle = {
  id: 1,
  documentId: 'news-1',
  title: 'A-tým zvítězil v derby!',
  slug: 'a-tym-zvitezil-v-derby',
  date: '2025-03-15T20:30:00.000Z',
  description: 'Frýdek-Místek porazil rivala 3:1 v 20. kole MSFL.',
  video: 'dQw4w9WgXcQ',
  mainPhoto: {
    id: 50,
    url: '/uploads/derby_win_main.jpg',
    alternativeText: 'Radost hráčů po gólu',
    width: 1200,
    height: 800,
  },
  gallery: [
    {
      id: 51,
      url: '/uploads/derby_gallery_1.jpg',
      alternativeText: 'Gól na 1:0',
      width: 1200,
      height: 800,
    },
    {
      id: 52,
      url: '/uploads/derby_gallery_2.jpg',
      alternativeText: null,
      width: 1200,
      height: 800,
    },
  ],
  categories: [
    { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
  ],
  newsArticleTypes: [
    {
      id: 1,
      documentId: 'nat-1',
      name: 'Zápas',
      slug: 'zapas',
    },
  ],
  relatedNews: [
    {
      id: 2,
      documentId: 'news-2',
      title: 'Sestava na derby',
      slug: 'sestava-na-derby',
      date: '2025-03-14T08:00:00.000Z',
      description: 'Trenér nominoval 18 hráčů.',
      video: null,
      mainPhoto: {
        id: 53,
        url: '/uploads/sestava_preview.jpg',
        alternativeText: null,
        width: 600,
        height: 400,
      },
      gallery: null,
      categories: [
        { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
      ],
      newsArticleTypes: [
        {
          id: 2,
          documentId: 'nat-2',
          name: 'Oznámení',
          slug: 'oznameni',
        },
      ],
      relatedNews: null,
      createdAt: '2025-03-14T08:00:00.000Z',
    },
  ],
  createdAt: '2025-03-15T20:30:00.000Z',
};

describe('GET /api/v1/news', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated news list', async () => {
    vi.mocked(strapiGetWithPagination).mockResolvedValueOnce({
      data: [mockArticle],
      pagination: { page: 1, pageSize: 20, pageCount: 1, total: 1 },
    });

    const res = await app.request('/api/v1/news');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(1);
    expect(json.pagination).toEqual({ page: 1, pageSize: 20, pageCount: 1, total: 1 });

    // List should not include gallery, video, or relatedNews
    const article = json.data[0];
    expect(article.documentId).toBe('news-1');
    expect(article.title).toBe('A-tým zvítězil v derby!');
    expect(article.mainPhoto.url).toBe('http://localhost:8080/uploads/derby_win_main.jpg');
    expect(article.newsArticleTypes).toEqual([{ documentId: 'nat-1', name: 'Zápas', slug: 'zapas' }]);
    expect(article).not.toHaveProperty('gallery');
    expect(article).not.toHaveProperty('video');
    expect(article).not.toHaveProperty('relatedNews');
  });

  it('passes category and pagination to Strapi', async () => {
    vi.mocked(strapiGetWithPagination).mockResolvedValueOnce({
      data: [],
      pagination: { page: 2, pageSize: 10, pageCount: 0, total: 0 },
    });

    await app.request('/api/v1/news?category=a-tym&page=2&pageSize=10');

    expect(strapiGetWithPagination).toHaveBeenCalledWith('/news-articles', expect.objectContaining({
      sort: 'date:desc',
      pagination: { page: 2, pageSize: 10 },
      filters: { categories: { slug: { $eq: 'a-tym' } } },
    }));
  });
});

describe('GET /api/v1/news/:slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns full article detail with gallery and related news', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({
      data: [mockArticle],
      meta: {},
    });

    const res = await app.request('/api/v1/news/a-tym-zvitezil-v-derby');
    expect(res.status).toBe(200);

    const json = await res.json();
    const article = json.data;
    expect(article.documentId).toBe('news-1');
    expect(article.video).toBe('dQw4w9WgXcQ');
    expect(article.gallery).toHaveLength(2);
    expect(article.gallery[0].url).toBe('http://localhost:8080/uploads/derby_gallery_1.jpg');
    expect(article.relatedNews).toHaveLength(1);
    expect(article.relatedNews[0].documentId).toBe('news-2');
    expect(article.relatedNews[0].mainPhoto.url).toBe('http://localhost:8080/uploads/sestava_preview.jpg');
  });

  it('returns 404 for non-existent article', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    const res = await app.request('/api/v1/news/nonexistent-slug');
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Article not found');
  });
});
