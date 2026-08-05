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
  directories: [{ id: 'dir-1', name: 'Fotky' }],
  includesRoot: false,
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

    it('maps a text input frame (and defaults to null when absent)', async () => {
      const rawTemplates = [
        makeRawTemplate({
          variants: [
            makeRawVariant({
              inputs: [
                makeRawInput({ id: 'with-frame', frame: { x: 10, y: 20, width: 200, height: 80 } }),
                makeRawInput({ id: 'no-frame' }),
              ],
            }),
          ],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const [withFrame, noFrame] = result.data[0].variants[0].inputs;
      expect(withFrame.frame).toEqual({ x: 10, y: 20, width: 200, height: 80 });
      expect(noFrame.frame).toBeNull();
    });

    it('maps lists + listStyle + sampleValue (and defaults on pre-lists payloads)', async () => {
      const rawTemplates = [
        makeRawTemplate({
          variants: [
            makeRawVariant({
              inputs: [
                makeRawInput({
                  id: 'with-lists',
                  richText: true,
                  lists: true,
                  listStyle: {
                    bullet: 'image',
                    bulletImageUrl: 'http://store/check.png',
                    indent: 60,
                    itemSpacing: 4,
                    blockSpacing: 23.2,
                  },
                  sampleValue: '{"runs":[{"text":"Intro\nItem"}],"lines":["p","ul"]}',
                }),
                makeRawInput({ id: 'pre-lists' }),
              ],
            }),
          ],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const [withLists, preLists] = result.data[0].variants[0].inputs;
      expect(withLists.lists).toBe(true);
      expect(withLists.listStyle).toEqual({
        bullet: 'image',
        bulletImageUrl: 'http://store/check.png',
        indent: 60,
        itemSpacing: 4,
        blockSpacing: 23.2,
      });
      expect(withLists.sampleValue).toBe('{"runs":[{"text":"Intro\nItem"}],"lines":["p","ul"]}');
      // Pre-lists payloads (fields absent) default to disabled/none.
      expect(preLists.lists).toBe(false);
      expect(preLists.listStyle).toBeNull();
      expect(preLists.sampleValue).toBeNull();
    });

    it('maps containers + per-input containerId/textStyle (and defaults when absent)', async () => {
      const rawTemplates = [
        makeRawTemplate({
          variants: [
            makeRawVariant({
              inputs: [
                makeRawInput({
                  id: 'member-1',
                  containerId: 'cont-1',
                  textStyle: { fontFamily: 'Rubik (Rubik Bold)', fontSize: 24, lineHeight: 1.4, charSpacing: 0 },
                }),
                makeRawInput({ id: 'independent' }),
              ],
              containers: [
                { id: 'cont-1', maxHeight: 200, y: 60, memberInputIds: ['member-1', 'member-2'] },
              ],
            }),
          ],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const variant = result.data[0].variants[0];
      expect(variant.containers).toEqual([
        {
          id: 'cont-1',
          maxHeight: 200,
          y: 60,
          memberInputIds: ['member-1', 'member-2'],
          // Nesting-rework fields, defaulted for pre-nesting API payloads.
          memberContainerIds: [],
          gap: null,
          spaceAfter: null,
          nested: false,
        },
      ]);

      const [member, independent] = variant.inputs;
      expect(member.containerId).toBe('cont-1');
      expect(member.textStyle).toEqual({
        fontFamily: 'Rubik (Rubik Bold)',
        fontSize: 24,
        lineHeight: 1.4,
        charSpacing: 0,
      });
      // Older payloads without the fields -> safe defaults.
      expect(independent.containerId).toBeNull();
      expect(independent.textStyle).toBeNull();
    });

    it('defaults containers to [] when the variant has none', async () => {
      const rawTemplates = [makeRawTemplate()];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data[0].variants[0].containers).toEqual([]);
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
      expect(slot.directories).toEqual([{ id: 'dir-1', name: 'Fotky' }]);
      expect(slot.includesRoot).toBe(false);
      // The helper omits isBackground (like an older API payload) → false.
      expect(slot.isBackground).toBe(false);
      // allowedDirectoryIds is intentionally not exposed to the client DTO
      expect(slot).not.toHaveProperty('allowedDirectoryIds');
    });

    it('passes isBackground through when the API sends it', async () => {
      const rawTemplates = [
        makeRawTemplate({
          variants: [
            makeRawVariant({
              imageInputs: [
                makeRawImageInput({
                  id: 'bg',
                  isBackground: true,
                  allowMove: false,
                  allowResize: false,
                  allowRotate: false,
                }),
                makeRawImageInput({ id: 'regular', isBackground: false }),
              ],
            }),
          ],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const [bg, regular] = result.data[0].variants[0].imageInputs;
      expect(bg.isBackground).toBe(true);
      expect(regular.isBackground).toBe(false);
    });

    it('defaults the upload-target fields when an older payload omits them', async () => {
      const rawTemplates = [
        makeRawTemplate({
          variants: [
            makeRawVariant({
              imageInputs: [makeRawImageInput({ directories: undefined, includesRoot: undefined })],
            }),
          ],
        }),
      ];
      const client = makeFakeClient({ listTemplates: vi.fn().mockResolvedValue(rawTemplates) });
      const service = new SocialExportService(client as never);

      const result = await service.getTemplates();
      expect(result.success).toBe(true);
      if (!result.success) return;

      const slot = result.data[0].variants[0].imageInputs[0];
      expect(slot.directories).toEqual([]);
      expect(slot.includesRoot).toBe(false);
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

    it('maps gallery-root images (absent directoryId) to null', async () => {
      // Unrestricted slots list root images; the API omits their null
      // directoryId/directoryName entirely.
      const raw = [makeRawGalleryImage({ id: 'root-1', directoryId: undefined, directoryName: undefined })];
      const client = makeFakeClient({ listPlaceholderImages: vi.fn().mockResolvedValue(raw) });
      const service = new SocialExportService(client as never);

      const result = await service.listPlaceholderImages('v1', 'slot-1');
      expect(result.success).toBe(true);
      if (!result.success) return;

      expect(result.data[0].directoryId).toBeNull();
      expect(result.data[0].directoryName).toBeNull();
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
