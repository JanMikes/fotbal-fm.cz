import { describe, it, expect, vi } from 'vitest';
import type { StrapiRawNewsArticle } from '../../../../lib/strapi/types';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

const { mapNewsArticleSummary, mapNewsArticle } = await import('../../../../lib/strapi/mappers/news-article');

function makeRawArticle(overrides: Record<string, unknown> = {}): StrapiRawNewsArticle {
  return {
    id: 1,
    documentId: 'article-1',
    title: 'Výhra nad soupeřem',
    slug: 'vyhra-nad-souperem',
    description: 'Krátký popis článku',
    video: null,
    mainPhoto: {
      id: 10,
      url: '/uploads/photo.jpg',
      alternativeText: 'Match photo',
      width: 800,
      height: 600,
    },
    gallery: null,
    categories: [
      { id: 1, documentId: 'cat-1', name: 'Muži', slug: 'muzi', sortOrder: 1 },
    ],
    newsArticleTypes: [
      {
        id: 1,
        documentId: 'type-1',
        name: 'Zápasy',
        slug: 'zapasy',
      },
    ],
    relatedNews: null,
    date: '2025-01-15T10:00:00Z',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T12:00:00Z',
    ...overrides,
  } as StrapiRawNewsArticle;
}

describe('mapNewsArticleSummary', () => {
  it('maps basic article summary', () => {
    const result = mapNewsArticleSummary(makeRawArticle());

    expect(result.documentId).toBe('article-1');
    expect(result.title).toBe('Výhra nad soupeřem');
    expect(result.slug).toBe('vyhra-nad-souperem');
    expect(result.description).toBe('Krátký popis článku');
    expect(result.date).toBe('2025-01-15T10:00:00Z');
  });

  it('maps mainPhoto with transformed URL', () => {
    const result = mapNewsArticleSummary(makeRawArticle());
    expect(result.mainPhoto?.url).toBe('http://uploads.test/uploads/photo.jpg');
  });

  it('maps categories', () => {
    const result = mapNewsArticleSummary(makeRawArticle());
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe('Muži');
  });

  it('maps newsArticleTypes', () => {
    const result = mapNewsArticleSummary(makeRawArticle());
    expect(result.newsArticleTypes[0]?.name).toBe('Zápasy');
  });

  it('handles null mainPhoto', () => {
    const result = mapNewsArticleSummary(makeRawArticle({ mainPhoto: null }));
    expect(result.mainPhoto).toBeNull();
  });

  it('handles null categories', () => {
    const result = mapNewsArticleSummary(makeRawArticle({ categories: null }));
    expect(result.categories).toEqual([]);
  });

  it('handles null newsArticleTypes', () => {
    const result = mapNewsArticleSummary(makeRawArticle({ newsArticleTypes: null }));
    expect(result.newsArticleTypes).toEqual([]);
  });

  it('falls back to documentId when slug is null', () => {
    const result = mapNewsArticleSummary(makeRawArticle({ slug: null }));
    expect(result.slug).toBe('article-1');
  });
});

describe('mapNewsArticle', () => {
  it('includes summary fields plus video, gallery, relatedNews', () => {
    const result = mapNewsArticle(makeRawArticle({
      video: 'https://youtube.com/watch?v=123',
      gallery: [
        { id: 20, url: '/uploads/gallery1.jpg', alternativeText: null, width: 400, height: 300 },
      ],
      relatedNews: [makeRawArticle({ documentId: 'related-1', title: 'Related Article' })],
    }));

    expect(result.video).toBe('https://youtube.com/watch?v=123');
    expect(result.gallery).toHaveLength(1);
    expect(result.gallery[0].url).toBe('http://uploads.test/uploads/gallery1.jpg');
    expect(result.relatedNews).toHaveLength(1);
    expect(result.relatedNews[0].title).toBe('Related Article');
  });

  it('defaults gallery to empty array', () => {
    const result = mapNewsArticle(makeRawArticle());
    expect(result.gallery).toEqual([]);
  });

  it('defaults relatedNews to empty array', () => {
    const result = mapNewsArticle(makeRawArticle());
    expect(result.relatedNews).toEqual([]);
  });
});
