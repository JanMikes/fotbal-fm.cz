import { describe, it, expect, vi } from 'vitest';

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

const {
  transformImageUrl,
  transformImageFormats,
  mapRawMediaToImage,
  mapMediaToImages,
  mapMediaToFiles,
  mapUserInfo,
  extractUserId,
  nullToUndefined,
  emptyToUndefined,
} = await import('../../../../infrastructure/strapi/mappers/shared');

describe('transformImageUrl', () => {
  it('prepends public uploads URL to /uploads/ paths', () => {
    expect(transformImageUrl('/uploads/photo.jpg')).toBe('http://uploads.test/uploads/photo.jpg');
  });

  it('returns external URLs unchanged', () => {
    expect(transformImageUrl('https://cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg');
  });
});

describe('transformImageFormats', () => {
  it('transforms format URLs', () => {
    const formats = {
      thumbnail: { url: '/uploads/thumb.jpg', width: 100, height: 100 },
      small: { url: '/uploads/small.jpg', width: 500, height: 500 },
    };

    const result = transformImageFormats(formats);
    expect(result.thumbnail?.url).toBe('http://uploads.test/uploads/thumb.jpg');
    expect(result.small?.url).toBe('http://uploads.test/uploads/small.jpg');
  });

  it('returns empty object for null', () => {
    expect(transformImageFormats(null)).toEqual({});
  });

  it('returns empty object for undefined', () => {
    expect(transformImageFormats(undefined)).toEqual({});
  });
});

describe('mapRawMediaToImage', () => {
  it('maps all fields', () => {
    const raw = {
      id: 1, name: 'photo.jpg', alternativeText: 'Photo', caption: 'Caption',
      width: 800, height: 600, formats: null, url: '/uploads/photo.jpg',
      previewUrl: null, provider: 'local', size: 1024, ext: '.jpg', mime: 'image/jpeg',
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    };

    const result = mapRawMediaToImage(raw);
    expect(result.id).toBe(1);
    expect(result.url).toBe('http://uploads.test/uploads/photo.jpg');
    expect(result.alternativeText).toBe('Photo');
    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
  });

  it('defaults null fields', () => {
    const raw = {
      id: 1, name: 'photo.jpg', url: '/uploads/photo.jpg',
      size: 100, ext: '.jpg', mime: 'image/jpeg',
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    };

    const result = mapRawMediaToImage(raw as any);
    expect(result.alternativeText).toBeNull();
    expect(result.caption).toBeNull();
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
    expect(result.provider).toBe('local');
  });
});

describe('mapMediaToImages', () => {
  it('maps array of media', () => {
    const media = [{
      id: 1, name: 'a.jpg', url: '/uploads/a.jpg', size: 100, ext: '.jpg', mime: 'image/jpeg',
      createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z',
    }];
    const result = mapMediaToImages(media as any);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for null', () => {
    expect(mapMediaToImages(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(mapMediaToImages(undefined)).toEqual([]);
  });
});

describe('mapMediaToFiles', () => {
  it('returns empty array for null', () => {
    expect(mapMediaToFiles(null)).toEqual([]);
  });
});

describe('mapUserInfo', () => {
  it('maps flattened user info', () => {
    const result = mapUserInfo({ id: 1, firstname: 'Jan', lastname: 'Novák', email: 'jan@test.cz' });
    expect(result).toEqual({ id: 1, firstName: 'Jan', lastName: 'Novák', email: 'jan@test.cz' });
  });

  it('maps nested user info', () => {
    const result = mapUserInfo({ data: { id: 1, firstname: 'Jan', lastname: 'Novák', email: 'jan@test.cz' } });
    expect(result).toEqual({ id: 1, firstName: 'Jan', lastName: 'Novák', email: 'jan@test.cz' });
  });

  it('returns undefined for null', () => {
    expect(mapUserInfo(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(mapUserInfo(undefined)).toBeUndefined();
  });

  it('returns undefined when nested data is null', () => {
    expect(mapUserInfo({ data: null })).toBeUndefined();
  });

  it('defaults firstname/lastname to empty string', () => {
    const result = mapUserInfo({ id: 1 });
    expect(result?.firstName).toBe('');
    expect(result?.lastName).toBe('');
  });
});

describe('extractUserId', () => {
  it('extracts from flattened structure', () => {
    expect(extractUserId({ id: 42 })).toBe(42);
  });

  it('extracts from nested structure', () => {
    expect(extractUserId({ data: { id: 42 } })).toBe(42);
  });

  it('returns undefined for null', () => {
    expect(extractUserId(null)).toBeUndefined();
  });

  it('returns undefined when nested data is null', () => {
    expect(extractUserId({ data: null })).toBeUndefined();
  });
});

describe('nullToUndefined', () => {
  it('converts null to undefined', () => {
    expect(nullToUndefined(null)).toBeUndefined();
  });

  it('passes through values', () => {
    expect(nullToUndefined('hello')).toBe('hello');
    expect(nullToUndefined(0)).toBe(0);
    expect(nullToUndefined(false)).toBe(false);
  });

  it('passes through undefined', () => {
    expect(nullToUndefined(undefined)).toBeUndefined();
  });
});

describe('emptyToUndefined', () => {
  it('converts empty string to undefined', () => {
    expect(emptyToUndefined('')).toBeUndefined();
  });

  it('converts null to undefined', () => {
    expect(emptyToUndefined(null)).toBeUndefined();
  });

  it('converts undefined to undefined', () => {
    expect(emptyToUndefined(undefined)).toBeUndefined();
  });

  it('passes through non-empty strings', () => {
    expect(emptyToUndefined('hello')).toBe('hello');
  });
});
