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

const { mapMatch, safeMapMatch, safeMapMatches } = await import(
  '../../../../infrastructure/strapi/mappers/match'
);

function makeValidRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    documentId: 'match-001',
    homeTeam: { id: 1, documentId: 'team-001', name: 'FK Frýdek-Místek' },
    awayTeam: { id: 2, documentId: 'team-002', name: 'Baník Ostrava' },
    homeScore: 2,
    awayScore: 1,
    homeGoalscorers: 'Novák 15\', Dvořák 78\'',
    awayGoalscorers: 'Svoboda 45\'',
    matchReport: 'Výborný zápas',
    categories: [
      { id: 1, documentId: 'cat-1', name: 'Muži', slug: 'muzi', sortOrder: 1 },
    ],
    matchDate: '2025-03-15',
    imagesUrl: 'https://photos.example.com/match-001',
    images: [],
    files: [],
    author: { id: 10, firstname: 'Admin', lastname: 'User', email: 'admin@test.cz' },
    lastModifiedBy: null,
    facrId: 'facr-001',
    round: 5,
    venue: 'Stadion FM',
    matchTime: '17:00:00.000',
    competitionName: 'Divize E',
    competitionCode: 'DIV-E',
    season: 2025,
    period: 'jaro',
    organizingBody: 'FAČR',
    createdAt: '2025-03-15T10:00:00Z',
    updatedAt: '2025-03-15T12:00:00Z',
    ...overrides,
  };
}

describe('mapMatch', () => {
  it('maps valid raw data to Match', () => {
    const result = mapMatch(makeValidRaw());

    expect(result.id).toBe('match-001');
    expect(result.homeTeam).toBe('FK Frýdek-Místek');
    expect(result.awayTeam).toBe('Baník Ostrava');
    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
    expect(result.homeGoalscorers).toBe('Novák 15\', Dvořák 78\'');
    expect(result.matchDate).toBe('2025-03-15');
    expect(result.venue).toBe('Stadion FM');
    expect(result.competitionName).toBe('Divize E');
    expect(result.season).toBe(2025);
    expect(result.createdAt).toBe('2025-03-15T10:00:00Z');
  });

  it('maps categories with documentId as id', () => {
    const result = mapMatch(makeValidRaw());
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].id).toBe('cat-1');
    expect(result.categories[0].name).toBe('Muži');
  });

  it('maps author info', () => {
    const result = mapMatch(makeValidRaw());
    expect(result.author).toEqual({
      id: 10,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@test.cz',
    });
    expect(result.authorId).toBe(10);
  });

  it('handles null optional fields', () => {
    const result = mapMatch(makeValidRaw({
      homeGoalscorers: null,
      awayGoalscorers: null,
      matchReport: null,
      imagesUrl: null,
      facrId: null,
      venue: null,
      matchTime: null,
      competitionName: null,
    }));

    expect(result.homeGoalscorers).toBeUndefined();
    expect(result.awayGoalscorers).toBeUndefined();
    expect(result.matchReport).toBeUndefined();
    expect(result.imagesUrl).toBeUndefined();
    expect(result.facrId).toBeUndefined();
    expect(result.venue).toBeUndefined();
    expect(result.matchTime).toBeUndefined();
    expect(result.competitionName).toBeUndefined();
  });

  it('uses createdAt date when matchDate is null', () => {
    const result = mapMatch(makeValidRaw({ matchDate: null }));
    expect(result.matchDate).toBe('2025-03-15');
  });

  it('handles null teams', () => {
    const result = mapMatch(makeValidRaw({ homeTeam: null, awayTeam: null }));
    expect(result.homeTeam).toBe('');
    expect(result.awayTeam).toBe('');
  });

  it('handles null categories', () => {
    const result = mapMatch(makeValidRaw({ categories: null }));
    expect(result.categories).toEqual([]);
  });

  it('throws ValidationError for invalid data', () => {
    expect(() => mapMatch({ invalid: 'data' })).toThrow();
  });

  it('throws ValidationError when required fields are missing', () => {
    expect(() => mapMatch({ id: 1 })).toThrow();
  });
});

describe('safeMapMatch', () => {
  it('returns mapped result for valid data', () => {
    const result = safeMapMatch(makeValidRaw());
    expect(result).not.toBeNull();
    expect(result?.homeTeam).toBe('FK Frýdek-Místek');
  });

  it('returns null for invalid data', () => {
    const result = safeMapMatch({ invalid: 'data' });
    expect(result).toBeNull();
  });
});

describe('safeMapMatches', () => {
  it('maps valid items and filters invalid ones', () => {
    const results = safeMapMatches([
      makeValidRaw(),
      { invalid: 'data' },
      makeValidRaw({ documentId: 'match-002' }),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('match-001');
    expect(results[1].id).toBe('match-002');
  });

  it('returns empty array when all items are invalid', () => {
    const results = safeMapMatches([{ bad: true }, { also: 'bad' }]);
    expect(results).toEqual([]);
  });
});
