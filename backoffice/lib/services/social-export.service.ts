/**
 * Social-export service.
 *
 * Mediates between API routes and the WBoost client. Converts raw WBoost types
 * to safe DTOs (no absolute object-store URLs reach the browser), and wraps all
 * results in the Result<T, AppError> monad so callers never have to try/catch.
 */

import * as Sentry from '@sentry/nextjs';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, toAppError } from '@/lib/core/errors';
import { getWboostConfig } from '@/lib/config';
import { getWboostClient, WboostClient } from '@/lib/infrastructure/wboost/client';
import type {
  WboostRawTemplate,
  WboostRawVariant,
  WboostRawInput,
  WboostRawImageInput,
  WboostRawGalleryImage,
} from '@/lib/infrastructure/wboost/types';
import type {
  TemplateDTO,
  TemplateVariantDTO,
  TemplateInputDTO,
  ImageInputDTO,
  GalleryImageDTO,
  RenderInputValue,
  RenderImageValue,
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
    frame: raw.frame,
    // Presigned store URL, loadable directly by the browser (not behind the
    // OAuth firewall, unlike the variant thumbnail endpoint).
    defaultImageUrl: raw.defaultImageUrl,
  };
}

/** Map a gallery image; the `url` is a presigned store URL passed through as-is. */
export function mapGalleryImage(raw: WboostRawGalleryImage): GalleryImageDTO {
  return {
    id: raw.id,
    url: raw.url,
    directoryId: raw.directoryId,
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
    thumbnailUrl,
    hasDefaultPreview: raw.previewImageUrl != null,
    inputs: raw.inputs.map(mapInput),
    imageInputs: (raw.imageInputs ?? []).map(mapImageInput),
  };
}

function mapTemplate(raw: WboostRawTemplate, thumbnailsEnabled: boolean): TemplateDTO {
  return {
    id: raw.id,
    name: raw.name,
    position: raw.position,
    categoryId: raw.categoryId,
    categoryName: raw.categoryName,
    variants: raw.variants.map((v) => mapVariant(v, thumbnailsEnabled)),
  };
}

// --------------------------------------------------------------------------
// Service
// --------------------------------------------------------------------------

export class SocialExportService {
  constructor(private readonly client: WboostClient = getWboostClient()) {}

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

  async renderVariant(
    variantId: string,
    inputs: Record<string, RenderInputValue>,
    images?: Record<string, RenderImageValue>
  ): Promise<Result<Uint8Array, AppError>> {
    try {
      const bytes = await this.client.renderVariant(variantId, inputs, images);
      return ok(bytes);
    } catch (e) {
      if (e instanceof AppError) return err(e);
      Sentry.captureException(e, { tags: { service: 'SocialExportService', method: 'renderVariant' } });
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
