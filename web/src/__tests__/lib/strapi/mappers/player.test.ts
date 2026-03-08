import { describe, it, expect, vi } from 'vitest';
import type { StrapiRawPlayer } from '../../../../lib/strapi/types';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

const { mapPlayer } = await import('../../../../lib/strapi/mappers/player');

function makeRawPlayer(overrides: Record<string, unknown> = {}): StrapiRawPlayer {
  return {
    id: 1,
    documentId: 'player-1',
    name: 'Jan Novák',
    slug: 'jan-novak',
    type: 'hráč' as const,
    number: 10,
    sortOrder: 1,
    position: 'záložník' as const,
    positionText: 'Střední záložník',
    bio: 'Zkušený hráč',
    photo: {
      id: 5,
      url: '/uploads/jan.jpg',
      alternativeText: 'Jan Novák',
      width: 300,
      height: 400,
    },
    instagram: 'https://instagram.com/jan',
    twitter: null,
    facebook: null,
    categories: [
      { id: 1, documentId: 'cat-1', name: 'Muži', slug: 'muzi', sortOrder: 1 },
    ],
    facrId: 'facr-001',
    dateOfBirth: '1995-06-15',
    nationality: 'CZE',
    facrUuid: 'uuid-001',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
    ...overrides,
  } as StrapiRawPlayer;
}

describe('mapPlayer', () => {
  it('maps all fields correctly', () => {
    const result = mapPlayer(makeRawPlayer());

    expect(result.documentId).toBe('player-1');
    expect(result.name).toBe('Jan Novák');
    expect(result.slug).toBe('jan-novak');
    expect(result.type).toBe('hráč');
    expect(result.number).toBe(10);
    expect(result.sortOrder).toBe(1);
    expect(result.position).toBe('záložník');
    expect(result.positionText).toBe('Střední záložník');
    expect(result.bio).toBe('Zkušený hráč');
    expect(result.instagram).toBe('https://instagram.com/jan');
    expect(result.twitter).toBeNull();
    expect(result.facebook).toBeNull();
    expect(result.facrId).toBe('facr-001');
    expect(result.dateOfBirth).toBe('1995-06-15');
    expect(result.nationality).toBe('CZE');
    expect(result.isActive).toBe(true);
  });

  it('maps photo with transformed URL', () => {
    const result = mapPlayer(makeRawPlayer());
    expect(result.photo?.url).toBe('http://uploads.test/uploads/jan.jpg');
  });

  it('maps categories', () => {
    const result = mapPlayer(makeRawPlayer());
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].slug).toBe('muzi');
  });

  it('handles null photo', () => {
    const result = mapPlayer(makeRawPlayer({ photo: null }));
    expect(result.photo).toBeNull();
  });

  it('handles null categories', () => {
    const result = mapPlayer(makeRawPlayer({ categories: null }));
    expect(result.categories).toEqual([]);
  });

  it('defaults isActive to true when null', () => {
    const result = mapPlayer(makeRawPlayer({ isActive: null }));
    expect(result.isActive).toBe(true);
  });

  it('generates slug from name when slug is null', () => {
    const result = mapPlayer(makeRawPlayer({ slug: null }));
    expect(result.slug).toBe('jan-novak');
  });

  it('defaults sortOrder to 0 when missing', () => {
    const result = mapPlayer(makeRawPlayer({ sortOrder: undefined }));
    expect(result.sortOrder).toBe(0);
  });

  it('handles missing optional fields', () => {
    const result = mapPlayer(makeRawPlayer({
      number: null,
      position: null,
      positionText: null,
      bio: null,
      instagram: null,
      facrId: null,
      dateOfBirth: null,
      nationality: null,
    }));

    expect(result.number).toBeNull();
    expect(result.position).toBeNull();
    expect(result.positionText).toBeNull();
    expect(result.bio).toBeNull();
  });
});
