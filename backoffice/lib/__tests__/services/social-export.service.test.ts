import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

// Mock the config module — must be done BEFORE importing the service
vi.mock('@/lib/config', () => ({
  getWboostConfig: vi.fn().mockReturnValue({
    apiBase: 'http://wboost.test',
    clientId: 'cid',
    clientSecret: 'secret',
    projectId: 'proj1',
    thumbnailsEnabled: false,
  }),
  isWboostConfigured: vi.fn().mockReturnValue(true),
}));

const { SocialExportService } = await import('@/lib/services/social-export.service');
const { AppError, ErrorCode } = await import('@/lib/core/errors');
const { getWboostConfig } = await import('@/lib/config');

// ---------- Helpers ----------------------------------------------------------

const makeRawInput = (overrides = {}) => ({
  id: 'inp-1',
  name: 'Domácí',
  maxLength: 30,
  locked: false,
  uppercase: false,
  description: null,
  hidable: false,
  ...overrides,
});

const makeRawVariant = (overrides = {}) => ({
  id: 'v1',
  dimension: '1:1',
  width: 1080,
  height: 1080,
  previewImageUrl: null,
  backgroundImageUrl: null,
  exportUrl: null,
  inputs: [makeRawInput()],
  ...overrides,
});

const makeRawTemplate = (overrides = {}) => ({
  id: 't1',
  name: 'Šablona A',
  position: 1,
  categoryId: null,
  categoryName: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  variants: [makeRawVariant()],
  ...overrides,
});

const makeRawImageInput = (overrides = {}) => ({
  id: 'slot-1',
  name: 'Foto',
  description: 'Vaše fotka',
  allowMove: true,
  allowResize: true,
  allowRotate: false,
  hidable: true,
  allowedDirectoryIds: ['dir-1'],
  frame: { x: 100, y: 120, width: 400, height: 300 },
  defaultImageUrl: 'http://store/standin.png',
  ...overrides,
});

const makeRawGalleryImage = (overrides = {}) => ({
  id: 'img-1',
  url: 'http://store/photo.jpg',
  directoryId: 'dir-1',
  directoryName: 'Fotky',
  uploadedAt: '2026-06-05 14:10',
  ...overrides,
});

function makeFakeClient(overrides = {}) {
  return {
    listTemplates: vi.fn().mockResolvedValue([]),
    renderVariant: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    fetchThumbnail: vi.fn().mockResolvedValue({ body: new Uint8Array([4, 5]), contentType: 'image/png' }),
    listPlaceholderImages: vi.fn().mockResolvedValue([]),
    uploadPlaceholderImage: vi.fn().mockResolvedValue(makeRawGalleryImage()),
    ...overrides,
  };
}

// ---------- Tests ------------------------------------------------------------

describe('SocialExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset config mock to default (thumbnails disabled)
    vi.mocked(getWboostConfig).mockReturnValue({
      apiBase: 'http://wboost.test',
      clientId: 'cid',
      clientSecret: 'secret',
      projectId: 'proj1',
      thumbnailsEnabled: false,
    });
  });

  describe('getTemplates', () => {
    it('sorts templates by position asc then name', async () => {
      const rawTemplates = [
        makeRawTemplate({ id: 't3', name: 'Zebra', position: 2 }),
        makeRawTemplate({ id: 't1', name: 'Alfa', position: 1 }),
        makeRawTemplate({ id: 't2', name: 'Beta', position: 2 }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();

      expect(result.success).toBe(true);
      if (!result.success) return;

      const ids = result.data.map((t) => t.id);
      expect(ids).toEqual(['t1', 't2', 't3']); // position 1, then position 2 sorted by name (Beta < Zebra)
    });

    it('maps template fields to DTO correctly', async () => {
      const rawTemplates = [makeRawTemplate({ id: 'tX', name: 'Test', position: 5, categoryId: 'c1', categoryName: 'Výsledky' })];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const [t] = result.data;
      expect(t.id).toBe('tX');
      expect(t.name).toBe('Test');
      expect(t.position).toBe(5);
      expect(t.categoryId).toBe('c1');
      expect(t.categoryName).toBe('Výsledky');
    });

    it('thumbnailUrl is null when thumbnails disabled', async () => {
      vi.mocked(getWboostConfig).mockReturnValue({
        apiBase: 'http://wboost.test',
        clientId: 'cid',
        clientSecret: 'secret',
        projectId: 'proj1',
        thumbnailsEnabled: false,
      });

      const rawTemplates = [
        makeRawTemplate({
          variants: [makeRawVariant({ previewImageUrl: 'http://store/prev.png', backgroundImageUrl: 'http://store/bg.png' })],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data[0].variants[0].thumbnailUrl).toBeNull();
    });

    it('thumbnailUrl is proxy path when thumbnails enabled and source URL exists', async () => {
      vi.mocked(getWboostConfig).mockReturnValue({
        apiBase: 'http://wboost.test',
        clientId: 'cid',
        clientSecret: 'secret',
        projectId: 'proj1',
        thumbnailsEnabled: true,
      });

      const rawTemplates = [
        makeRawTemplate({
          variants: [makeRawVariant({ id: 'v42', previewImageUrl: 'http://store/prev.png', backgroundImageUrl: null })],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data[0].variants[0].thumbnailUrl).toBe('/api/social-export/thumbnail?variantId=v42');
    });

    it('thumbnailUrl is proxy path when thumbnails enabled and only backgroundImageUrl exists', async () => {
      vi.mocked(getWboostConfig).mockReturnValue({
        apiBase: 'http://wboost.test',
        clientId: 'cid',
        clientSecret: 'secret',
        projectId: 'proj1',
        thumbnailsEnabled: true,
      });

      const rawTemplates = [
        makeRawTemplate({
          variants: [makeRawVariant({ id: 'v99', previewImageUrl: null, backgroundImageUrl: 'http://store/bg.png' })],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data[0].variants[0].thumbnailUrl).toBe('/api/social-export/thumbnail?variantId=v99');
    });

    it('thumbnailUrl is null when thumbnails enabled but no source URLs', async () => {
      vi.mocked(getWboostConfig).mockReturnValue({
        apiBase: 'http://wboost.test',
        clientId: 'cid',
        clientSecret: 'secret',
        projectId: 'proj1',
        thumbnailsEnabled: true,
      });

      const rawTemplates = [
        makeRawTemplate({
          variants: [makeRawVariant({ previewImageUrl: null, backgroundImageUrl: null })],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data[0].variants[0].thumbnailUrl).toBeNull();
    });

    it('maps hasDefaultPreview correctly', async () => {
      const rawTemplates = [
        makeRawTemplate({
          id: 't1',
          variants: [makeRawVariant({ id: 'v1', previewImageUrl: 'http://store/prev.png' })],
        }),
        makeRawTemplate({
          id: 't2',
          variants: [makeRawVariant({ id: 'v2', previewImageUrl: null })],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const t1 = result.data.find((t) => t.id === 't1')!;
      const t2 = result.data.find((t) => t.id === 't2')!;
      expect(t1.variants[0].hasDefaultPreview).toBe(true);
      expect(t2.variants[0].hasDefaultPreview).toBe(false);
    });

    it('maps imageInputs to DTOs', async () => {
      const rawTemplates = [
        makeRawTemplate({
          variants: [makeRawVariant({ imageInputs: [makeRawImageInput({ id: 'slotX' })] })],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const slot = result.data[0].variants[0].imageInputs[0];
      expect(slot.id).toBe('slotX');
      expect(slot.allowMove).toBe(true);
      expect(slot.allowRotate).toBe(false);
      expect(slot.hidable).toBe(true);
      expect(slot.frame).toEqual({ x: 100, y: 120, width: 400, height: 300 });
      expect(slot.defaultImageUrl).toBe('http://store/standin.png');
      // allowedDirectoryIds is intentionally not exposed to the client DTO
      expect(slot).not.toHaveProperty('allowedDirectoryIds');
    });

    it('defaults imageInputs to [] when the variant has none', async () => {
      const rawTemplates = [makeRawTemplate({ variants: [makeRawVariant({})] })];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0].variants[0].imageInputs).toEqual([]);
    });

    it('propagates AppError from client as err result', async () => {
      const appErr = new AppError('Šablony se nepodařilo načíst', ErrorCode.INTERNAL_ERROR, 500);
      const client = makeFakeClient({ listTemplates: vi.fn().mockRejectedValue(appErr) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe(appErr);
    });
  });

  describe('renderVariant', () => {
    it('returns ok with Uint8Array on success', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const client = makeFakeClient({ renderVariant: vi.fn().mockResolvedValue(bytes) });
      const service = new SocialExportService(client as never);

      const result = await service.renderVariant('v1', { inp: 'val' });

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBe(bytes);
    });

    it('passes images through to the client', async () => {
      const renderVariant = vi.fn().mockResolvedValue(new Uint8Array([1]));
      const client = makeFakeClient({ renderVariant });
      const service = new SocialExportService(client as never);

      const images = { slot1: 'img-9', slot2: { imageId: 'img-3', scale: 1.4 } };
      await service.renderVariant('v1', { inp: 'val' }, images);

      expect(renderVariant).toHaveBeenCalledWith('v1', { inp: 'val' }, images);
    });

    it('propagates AppError from client', async () => {
      const appErr = new AppError('Chyba při generování', ErrorCode.INTERNAL_ERROR, 500);
      const client = makeFakeClient({ renderVariant: vi.fn().mockRejectedValue(appErr) });
      const service = new SocialExportService(client as never);

      const result = await service.renderVariant('v1', {});

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe(appErr);
    });
  });

  describe('getThumbnail', () => {
    it('returns ok with body and contentType on success', async () => {
      const payload = { body: new Uint8Array([4, 5]), contentType: 'image/webp' };
      const client = makeFakeClient({ fetchThumbnail: vi.fn().mockResolvedValue(payload) });
      const service = new SocialExportService(client as never);

      const result = await service.getThumbnail('v1');

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toBe(payload);
    });

    it('propagates AppError from client', async () => {
      const appErr = new AppError('Šablona nebyla nalezena', ErrorCode.NOT_FOUND, 404);
      const client = makeFakeClient({ fetchThumbnail: vi.fn().mockRejectedValue(appErr) });
      const service = new SocialExportService(client as never);

      const result = await service.getThumbnail('v99');

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe(appErr);
    });
  });

  describe('listPlaceholderImages', () => {
    it('maps raw gallery images to DTOs (url passed through)', async () => {
      const raw = [makeRawGalleryImage({ id: 'g1' }), makeRawGalleryImage({ id: 'g2', directoryName: undefined, uploadedAt: undefined })];
      const client = makeFakeClient({ listPlaceholderImages: vi.fn().mockResolvedValue(raw) });
      const service = new SocialExportService(client as never);

      const result = await service.listPlaceholderImages('v1', 'slot-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data[0]).toEqual({
        id: 'g1',
        url: 'http://store/photo.jpg',
        directoryId: 'dir-1',
        directoryName: 'Fotky',
        uploadedAt: '2026-06-05 14:10',
      });
      // Missing optional fields become null
      expect(result.data[1].directoryName).toBeNull();
      expect(result.data[1].uploadedAt).toBeNull();
    });

    it('propagates AppError from client', async () => {
      const appErr = new AppError('Slot nenalezen', ErrorCode.NOT_FOUND, 404);
      const client = makeFakeClient({ listPlaceholderImages: vi.fn().mockRejectedValue(appErr) });
      const service = new SocialExportService(client as never);

      const result = await service.listPlaceholderImages('v1', 'bad');
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe(appErr);
    });
  });

  describe('uploadPlaceholderImage', () => {
    it('forwards file + filename + directoryId and maps the created image', async () => {
      const uploadPlaceholderImage = vi.fn().mockResolvedValue(makeRawGalleryImage({ id: 'new-1' }));
      const client = makeFakeClient({ uploadPlaceholderImage });
      const service = new SocialExportService(client as never);

      const blob = new Blob([new Uint8Array([1, 2])], { type: 'image/png' });
      const result = await service.uploadPlaceholderImage('v1', 'slot-1', blob, 'photo.png', 'dir-1');

      expect(uploadPlaceholderImage).toHaveBeenCalledWith('v1', 'slot-1', blob, 'photo.png', 'dir-1');
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.id).toBe('new-1');
    });

    it('propagates AppError from client', async () => {
      const appErr = new AppError('Složka není povolena', ErrorCode.FORBIDDEN, 403);
      const client = makeFakeClient({ uploadPlaceholderImage: vi.fn().mockRejectedValue(appErr) });
      const service = new SocialExportService(client as never);

      const blob = new Blob([new Uint8Array([1])], { type: 'image/png' });
      const result = await service.uploadPlaceholderImage('v1', 'slot-1', blob, 'x.png');
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toBe(appErr);
    });
  });
});
