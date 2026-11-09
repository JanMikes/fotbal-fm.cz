/**
 * Social-export service.
 *
 * Mediates between API routes and the WBoost client. Converts raw WBoost types
 * to safe DTOs (no absolute object-store URLs reach the browser), and wraps all
 * results in the Result<T, AppError> monad so callers never have to try/catch.
 */

import * as Sentry from '@sentry/nextjs';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, ErrorCode, toAppError } from '@/lib/core/errors';
import { getWboostConfig } from '@/lib/config';
import {
  getWboostClient,
  WboostClient,
  type RenderMode,
  type WboostRenderedFile,
} from '@/lib/infrastructure/wboost/client';
import type {
  WboostRawTemplate,
  WboostRawVariant,
  WboostRawInput,
  WboostRawImageInput,
  WboostRawGalleryImage,
  WboostRawProjectFont,
  WboostRawDocumentExportVersion,
  WboostRawDocumentExportVersionDetail,
  WboostRawExportVersion,
  WboostRawExportVersionDetail,
  WboostRawTemplateDocument,
} from '@/lib/infrastructure/wboost/types';
import type {
  TemplateDTO,
  TemplateVariantDTO,
  TemplateInputDTO,
  ImageInputDTO,
  GalleryImageDTO,
  RenderInputValue,
  RenderImageValue,
  RichTextFontOptionDTO,
  GroupPlacements,
  DocumentExportVersionDetailDTO,
  DocumentExportVersionFillDTO,
  ExportVersionDTO,
  ExportVersionDetailDTO,
  ExportVersionFillDTO,
  DocumentDTO,
  DocumentExportFormat,
  DocumentFillBody,
} from '@/lib/social-export/api-types';

// --------------------------------------------------------------------------
// Mappers
// --------------------------------------------------------------------------

function mapInput(raw: WboostRawInput): TemplateInputDTO {
  return {
    id: raw.id,
    name: raw.name,
    maxLength: raw.maxLength,
    locked: raw.locked,
    uppercase: raw.uppercase,
    description: raw.description,
    hidable: raw.hidable,
    // Absent on older payloads → null (falls back to the flat form).
    frame: raw.frame ?? null,
    containerId: raw.containerId ?? null,
    textStyle: raw.textStyle ?? null,
    richText: raw.richText ?? false,
    // Font choice: absent on pre-choice payloads → no switch. Font file URLs
    // go through the same-origin proxy (see richTextOptions below).
    fontOptions: raw.fontOptions
      ? raw.fontOptions.map((font) => ({
          family: font.family,
          fontName: font.fontName,
          faceName: font.faceName,
          weight: font.weight,
          style: font.style,
          url: fontProxyPath(font.family),
        }))
      : null,
    // Colour allowlist: absent on older payloads → any colour (as before).
    colorOptions: raw.colorOptions === undefined ? null : raw.colorOptions,
    // Lists + sample: absent on pre-lists payloads → disabled/none.
    lists: raw.lists ?? false,
    listStyle: raw.listStyle
      ? {
          ...raw.listStyle,
          // Absent before checkbox lists shipped → default drawn checkbox.
          checkboxImageUrl: raw.listStyle.checkboxImageUrl ?? null,
          checkboxCheckedImageUrl: raw.listStyle.checkboxCheckedImageUrl ?? null,
        }
      : null,
    listCheckboxes: raw.listCheckboxes ?? false,
    checklist: raw.checklist ?? null,
    sampleValue: raw.sampleValue ?? null,
    // Absent on older payloads → null (the layers panel sinks it to the end).
    layerIndex: raw.layerIndex ?? null,
  };
}

function mapImageInput(raw: WboostRawImageInput): ImageInputDTO {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    allowMove: raw.allowMove,
    allowResize: raw.allowResize,
    allowRotate: raw.allowRotate,
    hidable: raw.hidable,
    // Fallbacks cover older API payloads without the upload-target fields.
    directories: raw.directories ?? [],
    includesRoot: raw.includesRoot ?? false,
    frame: raw.frame,
    // Presigned store URL, loadable directly by the browser (not behind the
    // OAuth firewall, unlike the variant thumbnail endpoint).
    defaultImageUrl: raw.defaultImageUrl,
    // Absent on older payloads → null (the layers panel sinks it to the end).
    layerIndex: raw.layerIndex ?? null,
    // Absent on older payloads → a regular (contain-fit) slot.
    isBackground: raw.isBackground ?? false,
  };
}

/** Map a gallery image; the `url` is a presigned store URL passed through as-is. */
export function mapGalleryImage(raw: WboostRawGalleryImage): GalleryImageDTO {
  return {
    id: raw.id,
    url: raw.url,
    // Null = gallery root (the API omits null fields, so it may be absent).
    directoryId: raw.directoryId ?? null,
    directoryName: raw.directoryName ?? null,
    uploadedAt: raw.uploadedAt ?? null,
  };
}

function mapVariant(raw: WboostRawVariant, thumbnailsEnabled: boolean): TemplateVariantDTO {
  const hasThumbnailSource = raw.previewImageUrl != null || raw.backgroundImageUrl != null;
  const thumbnailUrl =
    thumbnailsEnabled && hasThumbnailSource
      ? `/api/social-export/thumbnail?variantId=${raw.id}`
      : null;

  return {
    id: raw.id,
    dimension: raw.dimension,
    width: raw.width,
    height: raw.height,
    // Absent on older payloads → null (same as print / free-form variants).
    preset: raw.preset ?? null,
    thumbnailUrl,
    hasDefaultPreview: raw.previewImageUrl != null,
    inputs: raw.inputs.map(mapInput),
    imageInputs: (raw.imageInputs ?? []).map(mapImageInput),
    // Absent on older payloads → nothing recolourable.
    shapeInputs: (raw.shapeInputs ?? []).map((shape) => ({
      id: shape.id,
      name: shape.name ?? null,
      target: shape.target,
      defaultColor: shape.defaultColor,
      colorOptions: shape.colorOptions,
      freeColor: shape.freeColor,
      frame: shape.frame ?? null,
      layerIndex: shape.layerIndex ?? null,
    })),
    // Absent on older payloads → no containers.
    containers: (raw.containers ?? []).map((container) => ({
      id: container.id,
      maxHeight: container.maxHeight,
      y: container.y,
      memberInputIds: container.memberInputIds,
      // Absent on pre-nesting API deploys → flat container, designed gaps.
      memberContainerIds: container.memberContainerIds ?? [],
      gap: container.gap ?? null,
      spaceAfter: container.spaceAfter ?? null,
      nested: container.nested ?? false,
      // Whole-container hide (2026-11): without these the toggles never
      // appear. Absent on older deploys → not hidable, unnamed.
      hidable: container.hidable === true,
      name: container.name ?? null,
      memberImageInputIds: container.memberImageInputIds ?? [],
    })),
    // Rich-text toolbar data. Font file URLs point at the store host (may be
    // `localhost` in dev) → rewrite to the same-origin font proxy so the
    // browser can @font-face them (fonts hard-require CORS, images don't).
    richTextOptions: raw.richTextOptions
      ? {
          fonts: raw.richTextOptions.fonts.map((font) => ({
            family: font.family,
            fontName: font.fontName,
            faceName: font.faceName,
            weight: font.weight,
            style: font.style,
            url: fontProxyPath(font.family),
          })),
          colors: raw.richTextOptions.colors,
        }
      : null,
    groupMember: raw.groupMember === true,
  };
}

/** Same-origin proxy path for one font face (keyed by the Fabric family string). */
function fontProxyPath(family: string): string {
  return `/api/social-export/font?family=${encodeURIComponent(family)}`;
}

/**
 * Make a WBoost store URL fetchable from THIS container. In dev the store URL
 * points at `localhost` (the WBoost server's own config), which from inside
 * this container is the container itself — but the API base host already
 * encodes how we reach the WBoost machine (`host.docker.internal`), and the
 * store lives on the same machine. No-op for real (production) store hosts.
 */
function reachableStoreUrl(url: string, apiBase: string): string {
  try {
    const storeUrl = new URL(url);
    if (storeUrl.hostname !== 'localhost' && storeUrl.hostname !== '127.0.0.1') return url;
    const apiHost = new URL(apiBase).hostname;
    if (apiHost === 'localhost' || apiHost === '127.0.0.1') return url;
    storeUrl.hostname = apiHost;
    return storeUrl.toString();
  } catch {
    return url;
  }
}

function mapTemplate(raw: WboostRawTemplate, thumbnailsEnabled: boolean): TemplateDTO {
  return {
    id: raw.id,
    name: raw.name,
    position: raw.position,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    variants: raw.variants.map((v) => mapVariant(v, thumbnailsEnabled)),
    group: raw.group ? { id: raw.group.id, name: raw.group.name } : null,
    // Absent on pre-documents deploys → an ordinary template.
    document: raw.document
      ? {
          id: raw.document.id,
          name: raw.document.name,
          position: raw.document.position,
          pageId: raw.document.pageId,
        }
      : null,
  };
}

function mapDocument(raw: WboostRawTemplateDocument, thumbnailsEnabled: boolean): DocumentDTO {
  const pages = raw.pages
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((page) => ({
      id: page.id,
      position: page.position,
      templateId: page.templateId,
      templateName: page.templateName,
      variant: mapVariant(page.variant, thumbnailsEnabled),
    }));

  return {
    id: raw.id,
    name: raw.name,
    position: raw.position,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    dimension: raw.dimension,
    width: raw.width,
    height: raw.height,
    printFormat: raw.printFormat === true,
    pages,
    fields: (raw.fields ?? []).map((field) => ({
      id: field.id,
      name: field.name,
      kind: field.kind,
      // `valid: false` = the input was deleted from its page: never fill it.
      bindings: field.bindings
        .filter((binding) => binding.valid)
        .map((binding) => ({ pageId: binding.pageId, inputId: binding.inputId })),
      maxLength: field.maxLength ?? null,
      richText: field.richText === true,
      // Older deploys: no textMode — rich when every bound input is.
      textMode: field.textMode ?? (field.richText === true ? 'rich' : 'plain'),
      hidable: field.hidable === true,
      allowedDirectoryIds: Array.isArray(field.allowedDirectoryIds) ? field.allowedDirectoryIds : null,
    })),
  };
}

function thumbnailsEnabledOrFalse(): boolean {
  try {
    return getWboostConfig().thumbnailsEnabled;
  } catch {
    return false;
  }
}

function mapExportVersion(raw: WboostRawExportVersion): ExportVersionDTO {
  return {
    id: raw.id,
    subject: raw.subject,
    groupId: raw.groupId,
    variantId: raw.variantId,
    name: raw.name,
    pinned: raw.pinned,
    pinnedAt: raw.pinnedAt,
    createdAt: raw.createdAt,
    lastExportedAt: raw.lastExportedAt,
    exportCount: raw.exportCount,
    channel: raw.channel,
    summary: raw.summary,
  };
}

function mapDocumentExportVersion(raw: WboostRawDocumentExportVersion): ExportVersionDTO {
  return {
    id: raw.id,
    subject: 'document',
    groupId: null,
    variantId: null,
    documentId: raw.documentId,
    draft: raw.draft === true,
    name: raw.name,
    pinned: raw.pinned,
    pinnedAt: raw.pinnedAt,
    createdAt: raw.createdAt,
    lastExportedAt: raw.lastExportedAt,
    exportCount: raw.exportCount,
    channel: raw.channel,
    summary: raw.summary,
  };
}

function mapDocumentExportVersionDetail(raw: WboostRawDocumentExportVersionDetail): DocumentExportVersionDetailDTO {
  const pages: DocumentExportVersionFillDTO['pages'] = {};
  for (const [pageId, page] of Object.entries(raw.fill?.pages ?? {})) {
    pages[pageId] = {
      inputs: (page?.inputs ?? {}) as DocumentExportVersionFillDTO['pages'][string]['inputs'],
      images: (page?.images ?? {}) as DocumentExportVersionFillDTO['pages'][string]['images'],
      shapeColors: page?.shapeColors ?? {},
    };
  }
  return {
    ...mapDocumentExportVersion(raw),
    fill: { fields: (raw.fill?.fields ?? {}) as DocumentExportVersionFillDTO['fields'], pages },
  };
}

function mapExportVersionDetail(raw: WboostRawExportVersionDetail): ExportVersionDetailDTO {
  return {
    ...mapExportVersion(raw),
    // The fill is already in the render request shape; its image `url`s are
    // public store URLs the browser loads directly (like gallery images).
    fill: {
      inputs: (raw.fill?.inputs ?? {}) as ExportVersionFillDTO['inputs'],
      images: (raw.fill?.images ?? {}) as ExportVersionFillDTO['images'],
      placements: (raw.fill?.placements ?? {}) as GroupPlacements,
      shapeColors: raw.fill?.shapeColors ?? {},
    },
  };
}

// --------------------------------------------------------------------------
// Service
// --------------------------------------------------------------------------

/** How long a fetched project-fonts list is reused (dedupes the browser's font-file burst). */
const FONTS_CACHE_TTL_MS = 5 * 60 * 1000;

export class SocialExportService {
  constructor(private readonly client: WboostClient = getWboostClient()) {}

  /** Memoized raw project fonts (the font proxy is hit once per face in a burst). */
  private fontsCache: { at: number; promise: Promise<WboostRawProjectFont[]> } | null = null;

  private rawProjectFonts(): Promise<WboostRawProjectFont[]> {
    const now = Date.now();
    if (!this.fontsCache || now - this.fontsCache.at > FONTS_CACHE_TTL_MS) {
      const promise = this.client.listProjectFonts();
      this.fontsCache = { at: now, promise };
      // A failed fetch must not poison the cache for the whole TTL.
      promise.catch(() => {
        if (this.fontsCache?.promise === promise) this.fontsCache = null;
      });
    }
    return this.fontsCache.promise;
  }

  async getTemplates(): Promise<Result<TemplateDTO[], AppError>> {
    try {
      const raw = await this.client.listTemplates();

      let thumbnailsEnabled: boolean;
      try {
        thumbnailsEnabled = getWboostConfig().thumbnailsEnabled;
      } catch {
        thumbnailsEnabled = false;
      }

      const templates = raw
        .slice()
        .sort((a, b) => {
          if (a.position !== b.position) return a.position - b.position;
          return a.name.localeCompare(b.name, 'cs');
        })
        .map((t) => mapTemplate(t, thumbnailsEnabled));

      return ok(templates);
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'getTemplates' } });
      return err(toAppError(e));
    }
  }

  /**
   * The project's multi-page documents, sorted like the templates. An API
   * deploy without documents (404) simply has none.
   */
  async getDocuments(): Promise<Result<DocumentDTO[], AppError>> {
    try {
      const raw = await this.client.listDocuments();
      const thumbnailsEnabled = thumbnailsEnabledOrFalse();

      return ok(
        raw
          .slice()
          .sort((a, b) => (a.position !== b.position ? a.position - b.position : a.name.localeCompare(b.name, 'cs')))
          .map((doc) => mapDocument(doc, thumbnailsEnabled))
      );
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 404) return ok([]);
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'getDocuments' } });
      return err(toAppError(e));
    }
  }

  /** Document fill: `pageId` → that page's WebP preview; null → the whole document in `format`. */
  async renderDocument(
    documentId: string,
    pageId: string | null,
    fill: DocumentFillBody,
    format?: DocumentExportFormat
  ): Promise<Result<WboostRenderedFile, AppError>> {
    return this.attempt('renderDocument', () => this.client.renderDocument(documentId, pageId, fill, format));
  }

  /** `preview` = unrecorded WebP for the screen, `export` = the recorded PNG download. */
  async renderVariant(
    variantId: string,
    inputs: Record<string, RenderInputValue>,
    images: Record<string, RenderImageValue> | undefined,
    mode: RenderMode,
    shapeColors?: Record<string, string>
  ): Promise<Result<WboostRenderedFile, AppError>> {
    return this.attempt('renderVariant', () =>
      this.client.renderVariant(variantId, inputs, images, mode, shapeColors)
    );
  }

  /** Group fill: preview / export one dimension, or (no variantId + export) the whole ZIP. */
  async renderGroup(
    groupId: string,
    variantId: string | null,
    fill: {
      inputs: Record<string, RenderInputValue>;
      images?: Record<string, RenderImageValue>;
      placements?: GroupPlacements;
      shapeColors?: Record<string, string>;
    },
    mode: RenderMode
  ): Promise<Result<WboostRenderedFile, AppError>> {
    return this.attempt('renderGroup', () => this.client.renderGroup(groupId, variantId, fill, mode));
  }

  async listExportVersions(
    subject: { groupId: string } | { variantId: string }
  ): Promise<Result<ExportVersionDTO[], AppError>> {
    return this.attempt('listExportVersions', async () =>
      (await this.client.listExportVersions(subject)).map(mapExportVersion)
    );
  }

  async listDocumentExportVersions(documentId: string): Promise<Result<ExportVersionDTO[], AppError>> {
    return this.attempt('listDocumentExportVersions', async () =>
      (await this.client.listDocumentExportVersions(documentId)).map(mapDocumentExportVersion)
    );
  }

  async getDocumentExportVersion(versionId: string): Promise<Result<DocumentExportVersionDetailDTO, AppError>> {
    return this.attempt('getDocumentExportVersion', async () =>
      mapDocumentExportVersionDetail(await this.client.getDocumentExportVersion(versionId))
    );
  }

  async updateDocumentExportVersion(
    versionId: string,
    patch: { name?: string | null; pinned?: boolean }
  ): Promise<Result<DocumentExportVersionDetailDTO, AppError>> {
    return this.attempt('updateDocumentExportVersion', async () =>
      mapDocumentExportVersionDetail(await this.client.updateDocumentExportVersion(versionId, patch))
    );
  }

  async getExportVersion(versionId: string): Promise<Result<ExportVersionDetailDTO, AppError>> {
    return this.attempt('getExportVersion', async () =>
      mapExportVersionDetail(await this.client.getExportVersion(versionId))
    );
  }

  async updateExportVersion(
    versionId: string,
    patch: { name?: string | null; pinned?: boolean }
  ): Promise<Result<ExportVersionDetailDTO, AppError>> {
    return this.attempt('updateExportVersion', async () =>
      mapExportVersionDetail(await this.client.updateExportVersion(versionId, patch))
    );
  }

  private async attempt<T>(method: string, run: () => Promise<T>): Promise<Result<T, AppError>> {
    try {
      return ok(await run());
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method } });
      return err(toAppError(e));
    }
  }

  async listPlaceholderImages(
    variantId: string,
    imageInputId: string
  ): Promise<Result<GalleryImageDTO[], AppError>> {
    try {
      const raw = await this.client.listPlaceholderImages(variantId, imageInputId);
      return ok(raw.map(mapGalleryImage));
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'listPlaceholderImages' } });
      return err(toAppError(e));
    }
  }

  async uploadPlaceholderImage(
    variantId: string,
    imageInputId: string,
    file: Blob,
    filename: string,
    directoryId?: string
  ): Promise<Result<GalleryImageDTO, AppError>> {
    try {
      const raw = await this.client.uploadPlaceholderImage(
        variantId,
        imageInputId,
        file,
        filename,
        directoryId
      );
      return ok(mapGalleryImage(raw));
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'uploadPlaceholderImage' } });
      return err(toAppError(e));
    }
  }

  /**
   * The project's font faces for the browser: exact Fabric family strings +
   * same-origin proxy URLs. Loaded once per session by `useWboostFonts` so
   * client-side text measurement wraps with the real glyph metrics.
   */
  async getProjectFonts(): Promise<Result<RichTextFontOptionDTO[], AppError>> {
    try {
      const raw = await this.rawProjectFonts();
      return ok(
        raw.map((font) => ({
          family: font.family,
          fontName: font.fontName,
          faceName: font.faceName,
          weight: font.weight,
          style: font.style,
          url: fontProxyPath(font.family),
        }))
      );
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'getProjectFonts' } });
      return err(toAppError(e));
    }
  }

  /**
   * Resolve + stream one font file for the same-origin font proxy
   * (`/api/social-export/font`). Fonts are a CORS-restricted resource type —
   * unlike images, the browser refuses cross-origin @font-face sources without
   * CORS headers, which the object store does not send. The raw store URL is
   * resolved from the project fonts endpoint (never exposed to the browser);
   * on older API deploys without that endpoint it falls back to scanning the
   * variants' richTextOptions.
   */
  async getFont(
    family: string
  ): Promise<Result<{ body: Uint8Array; contentType: string }, AppError>> {
    try {
      let fontUrl: string | null = null;

      try {
        const fonts = await this.rawProjectFonts();
        fontUrl = fonts.find((font) => font.family === family)?.url ?? null;
      } catch {
        // Older API without /projects/{id}/fonts — legacy path below.
      }

      if (!fontUrl) {
        const templates = await this.client.listTemplates();
        for (const template of templates) {
          for (const variant of template.variants) {
            fontUrl ??=
              variant.richTextOptions?.fonts.find((font) => font.family === family)?.url ?? null;
          }
        }
      }

      if (!fontUrl) {
        return err(new AppError('Písmo nebylo nalezeno', ErrorCode.NOT_FOUND, 404));
      }

      const res = await fetch(reachableStoreUrl(fontUrl, getWboostConfig().apiBase));
      if (!res.ok) {
        return err(
          new AppError(`Písmo se nepodařilo načíst (HTTP ${res.status})`, ErrorCode.NETWORK_ERROR, 502)
        );
      }

      const body = new Uint8Array(await res.arrayBuffer());
      const contentType = res.headers.get('content-type') ?? 'font/ttf';
      return ok({ body, contentType });
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'getFont' } });
      return err(toAppError(e));
    }
  }

  async getThumbnail(
    variantId: string
  ): Promise<Result<{ body: Uint8Array; contentType: string }, AppError>> {
    try {
      const result = await this.client.fetchThumbnail(variantId);
      return ok(result);
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'getThumbnail' } });
      return err(toAppError(e));
    }
  }
}

// --------------------------------------------------------------------------
// Singleton
// --------------------------------------------------------------------------

let instance: SocialExportService | null = null;

/** Return the process-level singleton. */
export function getSocialExportService(): SocialExportService {
  if (!instance) {
    instance = new SocialExportService();
  }
  return instance;
}
