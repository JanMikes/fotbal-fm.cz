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
import type { WboostRawProjectFont } from '@/lib/infrastructure/wboost/types';
import {
  fontProxyPath,
  mapDocument,
  mapDocumentExportVersion,
  mapDocumentExportVersionDetail,
  mapExportVersion,
  mapExportVersionDetail,
  mapGalleryImage,
  mapTemplate,
} from './social-export.mappers';

export { mapGalleryImage } from './social-export.mappers';
import type {
  TemplateDTO,
  GalleryImageDTO,
  RenderInputValue,
  RenderImageValue,
  RichTextFontOptionDTO,
  GroupPlacements,
  ElementOffsets,
  RenderRows,
  DocumentExportVersionDetailDTO,
  ExportVersionDTO,
  ExportVersionDetailDTO,
  DocumentDTO,
  DocumentExportFormat,
  DocumentFillBody,
} from '@/lib/social-export/api-types';

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

function thumbnailsEnabledOrFalse(): boolean {
  try {
    return getWboostConfig().thumbnailsEnabled;
  } catch {
    return false;
  }
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
    format?: DocumentExportFormat,
    allowUnfilled = false
  ): Promise<Result<WboostRenderedFile, AppError>> {
    return this.attempt('renderDocument', () =>
      this.client.renderDocument(documentId, pageId, fill, format, allowUnfilled)
    );
  }

  /** `preview` = unrecorded WebP for the screen, `export` = the recorded PNG download. */
  async renderVariant(
    variantId: string,
    inputs: Record<string, RenderInputValue>,
    images: Record<string, RenderImageValue> | undefined,
    mode: RenderMode,
    shapeColors?: Record<string, string>,
    extras: { rows?: RenderRows; offsets?: ElementOffsets; allowUnfilled?: boolean } = {}
  ): Promise<Result<WboostRenderedFile, AppError>> {
    return this.attempt('renderVariant', () =>
      this.client.renderVariant(variantId, inputs, images, mode, shapeColors, extras)
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
      rows?: RenderRows;
      offsets?: Record<string, ElementOffsets>;
      allowUnfilled?: boolean;
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
