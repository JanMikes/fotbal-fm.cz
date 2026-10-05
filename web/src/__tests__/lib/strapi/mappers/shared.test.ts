import { describe, it, expect, vi } from 'vitest';
import type { StrapiRawMedia } from '@fotbal-fm/strapi-client';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

const { transformImageUrl, mapMedia, mapMediaArray, mapFile, versionedUrl } = await import('../../../../lib/strapi/mappers/shared');

describe('transformImageUrl', () => {
  it('prepends public uploads URL to /uploads/ paths', () => {
    expect(transformImageUrl('/uploads/photo.jpg')).toBe('http://uploads.test/uploads/photo.jpg');
  });

  it('returns external URLs unchanged', () => {
    expect(transformImageUrl('https://cdn.example.com/photo.jpg')).toBe('https://cdn.example.com/photo.jpg');
  });

  it('returns non-uploads paths unchanged', () => {
    expect(transformImageUrl('/other/path.jpg')).toBe('/other/path.jpg');
  });
});

describe('mapMedia', () => {
  it('maps valid media object', () => {
    const raw: StrapiRawMedia = {
      id: 1,
      documentId: 'doc-1',
      url: '/uploads/photo.jpg',
      alternativeText: 'A photo',
      width: 800,
      height: 600,
    };

    const result = mapMedia(raw);
    expect(result).toEqual({
      url: 'http://uploads.test/uploads/photo.jpg',
      alternativeText: 'A photo',
      width: 800,
      height: 600,
    });
  });

  it('returns null for null input', () => {
    expect(mapMedia(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(mapMedia(undefined)).toBeNull();
  });

  it('returns null for media without url', () => {
    expect(mapMedia({ id: 1 } as unknown as StrapiRawMedia)).toBeNull();
  });

  it('defaults alternativeText to null', () => {
    const raw: StrapiRawMedia = { id: 1, url: '/uploads/photo.jpg', width: 100, height: 100 };
    const result = mapMedia(raw);
    expect(result?.alternativeText).toBeNull();
  });

  it('defaults dimensions to 0', () => {
    const raw: StrapiRawMedia = { id: 1, url: '/uploads/photo.jpg' };
    const result = mapMedia(raw);
    expect(result?.width).toBe(0);
    expect(result?.height).toBe(0);
  });
});

describe('mapMediaArray', () => {
  it('maps array of media objects', () => {
    const raw: StrapiRawMedia[] = [
      { id: 1, url: '/uploads/a.jpg', alternativeText: null, width: 100, height: 100 },
      { id: 2, url: '/uploads/b.jpg', alternativeText: 'B', width: 200, height: 200 },
    ];

    const result = mapMediaArray(raw);
    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('http://uploads.test/uploads/a.jpg');
    expect(result[1].url).toBe('http://uploads.test/uploads/b.jpg');
  });

  it('returns empty array for null', () => {
    expect(mapMediaArray(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(mapMediaArray(undefined)).toEqual([]);
  });

  it('filters out items without url', () => {
    const raw = [
      { id: 1, url: '/uploads/a.jpg', width: 100, height: 100 },
      { id: 2 },
    ] as unknown as StrapiRawMedia[];
    const result = mapMediaArray(raw);
    expect(result).toHaveLength(1);
  });
});

describe('media URL versioning (U8)', () => {
  const updatedAt = '2026-10-06T08:15:30.123Z';
  const v = Date.parse(updatedAt).toString(36);

  it('mapMedia appends ?v=<updatedAt> so a replaced file (same URL) gets a new one', () => {
    const media = mapMedia({ id: 1, url: '/uploads/photo_abc.jpg', updatedAt } as StrapiRawMedia);
    expect(media!.url).toBe(`http://uploads.test/uploads/photo_abc.jpg?v=${v}`);
  });

  it('mapFile (documents) is versioned too', () => {
    expect(mapFile({ id: 1, url: '/uploads/rozpis.pdf', name: 'Rozpis', updatedAt } as StrapiRawMedia).url)
      .toBe(`http://uploads.test/uploads/rozpis.pdf?v=${v}`);
  });

  it('appends once, and keeps an existing query string', () => {
    expect(versionedUrl(`/uploads/a.jpg?v=${v}`, updatedAt)).toBe(`/uploads/a.jpg?v=${v}`);
    expect(versionedUrl('/uploads/a.jpg?w=1', updatedAt)).toBe(`/uploads/a.jpg?w=1&v=${v}`);
  });

  it('a different updatedAt gives a different URL', () => {
    expect(versionedUrl('/uploads/a.jpg', updatedAt)).not.toBe(versionedUrl('/uploads/a.jpg', '2026-10-07T00:00:00.000Z'));
  });

  it('without updatedAt (or an invalid one) the URL is unchanged', () => {
    expect(mapMedia({ id: 1, url: '/uploads/a.jpg' } as StrapiRawMedia)!.url).toBe('http://uploads.test/uploads/a.jpg');
    expect(versionedUrl('/uploads/a.jpg', 'not a date')).toBe('/uploads/a.jpg');
  });
});
