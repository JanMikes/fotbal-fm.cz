import { describe, it, expect, vi, beforeEach } from 'vitest';
import unpopulatedFixture from '../fixtures/strapi-match-unpopulated.json';
import populatedFixture from '../fixtures/strapi-match-populated.json';

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

const { MatchRepository } = await import('../../repositories/match.repository');

function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(populatedFixture.data),
    findMany: vi.fn().mockResolvedValue({ data: [populatedFixture.data], pagination: null }),
    create: vi.fn().mockResolvedValue(unpopulatedFixture.data),
    update: vi.fn().mockResolvedValue(unpopulatedFixture.data),
    delete: vi.fn().mockResolvedValue(undefined),
    uploadToEntity: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
}

describe('MatchRepository', () => {
  describe('update', () => {
    it('re-fetches with populate after update', async () => {
      const client = createMockClient();
      const repo = new MatchRepository(client as never);

      const result = await repo.update('zz9jyohea26zk3chdyn47gnl', {
        homeScore: 1,
        awayScore: 0,
      });

      // Should call update on Strapi
      expect(client.update).toHaveBeenCalledWith(
        'matches',
        'zz9jyohea26zk3chdyn47gnl',
        expect.objectContaining({ homeScore: 1, awayScore: 0 })
      );

      // Should re-fetch with findOne (which includes populate)
      expect(client.findOne).toHaveBeenCalledWith(
        'matches',
        'zz9jyohea26zk3chdyn47gnl',
        expect.objectContaining({ populate: expect.any(Object) })
      );

      // Result should have populated team names
      expect(result.homeTeam).toBe('FK Frýdek-Místek z.s.');
      expect(result.awayTeam).toBe('FC Zlín');
      expect(result.categories.length).toBeGreaterThan(0);
    });

    it('does not try to map unpopulated data directly', async () => {
      const client = createMockClient();
      const repo = new MatchRepository(client as never);

      // This should NOT throw even though update returns unpopulated data
      const result = await repo.update('zz9jyohea26zk3chdyn47gnl', {
        matchReport: 'Updated report',
      });

      expect(result.id).toBe('zz9jyohea26zk3chdyn47gnl');
    });
  });

  describe('create', () => {
    it('re-fetches with populate after create', async () => {
      const client = createMockClient({
        // findMany is called for team lookups and duplicate check — return empty for all
        findMany: vi.fn().mockResolvedValue({ data: [], pagination: null }),
        // create is called for teams and match — return unpopulated data
        create: vi.fn().mockResolvedValue(unpopulatedFixture.data),
      });
      const repo = new MatchRepository(client as never);

      const result = await repo.create({
        homeTeam: 'FK Frýdek-Místek z.s.',
        awayTeam: 'FC Zlín',
        homeScore: 0,
        awayScore: 0,
        matchDate: '2026-03-07',
        categories: ['cm6adl47cnh19rx3852bwavw'],
      });

      // Should re-fetch with findOne
      expect(client.findOne).toHaveBeenCalled();

      // Result should have populated data
      expect(result.homeTeam).toBe('FK Frýdek-Místek z.s.');
      expect(result.categories.length).toBeGreaterThan(0);
    });
  });

  describe('updateWithFiles (no files)', () => {
    it('does not make redundant findById when no files uploaded', async () => {
      const client = createMockClient();
      const repo = new MatchRepository(client as never);

      const { match } = await repo.updateWithFiles(
        'zz9jyohea26zk3chdyn47gnl',
        { matchReport: 'Updated' },
        { images: [], files: [] }
      );

      // findOne called once by update() re-fetch, not twice
      expect(client.findOne).toHaveBeenCalledTimes(1);
      expect(match.homeTeam).toBe('FK Frýdek-Místek z.s.');
    });
  });

  describe('findById', () => {
    it('maps populated Strapi response correctly', async () => {
      const client = createMockClient();
      const repo = new MatchRepository(client as never);

      const result = await repo.findById('zz9jyohea26zk3chdyn47gnl');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('zz9jyohea26zk3chdyn47gnl');
      expect(result!.homeTeam).toBe('FK Frýdek-Místek z.s.');
      expect(result!.awayTeam).toBe('FC Zlín');
      expect(result!.homeScore).toBe(0);
      expect(result!.awayScore).toBe(0);
      expect(result!.categories).toEqual([
        expect.objectContaining({ name: 'Dorost U17', slug: 'dorost-u17' }),
      ]);
      expect(result!.author).toEqual(expect.objectContaining({
        firstName: 'Kamil',
        lastName: 'Raška',
      }));
    });

    it('returns null when entity not found', async () => {
      const client = createMockClient({ findOne: vi.fn().mockResolvedValue(null) });
      const repo = new MatchRepository(client as never);

      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findAllSummary', () => {
    it('uses summary populate config', async () => {
      const client = createMockClient();
      const repo = new MatchRepository(client as never);

      await repo.findAllSummary();

      expect(client.findMany).toHaveBeenCalledWith(
        'matches',
        expect.objectContaining({
          pagination: { page: 1, pageSize: 100 },
          sort: 'matchDate:desc',
          populate: expect.not.objectContaining({ images: true }),
        })
      );
    });
  });
});
