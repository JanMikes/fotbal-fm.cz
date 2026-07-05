/**
 * News Article Service.
 * Handles business logic for creating news articles from the backoffice.
 */

import * as Sentry from '@sentry/nextjs';
import { NewsArticle, CreateNewsArticleRequest } from '@/types/news-article';
import { NewsArticleRepository, UploadResults } from '@/lib/repositories';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, ErrorCode } from '@/lib/core/errors';
import { getNewsArticleRepository } from '@/lib/di';
import { slugify } from '@/lib/news-article/slug';

export interface NewsArticleWithUploads {
  article: NewsArticle;
  uploadWarnings: string[];
}

function buildUploadWarnings(uploads: UploadResults): string[] {
  const warnings: string[] = [];

  if (uploads.gallery && !uploads.gallery.success) {
    warnings.push(uploads.gallery.error ?? 'Nepodařilo se nahrát fotografie');
  }

  return warnings;
}

export class NewsArticleService {
  constructor(private readonly repository: NewsArticleRepository) {}

  /**
   * Default instance backed by the service API token.
   */
  static default(): NewsArticleService {
    return new NewsArticleService(getNewsArticleRepository());
  }

  /**
   * Generate a unique slug from the title.
   * Deterministic: base slug, then -2, -3, ... when taken.
   */
  private async generateUniqueSlug(title: string): Promise<string> {
    const base = slugify(title) || 'aktualita';
    const existing = new Set(await this.repository.findSlugsStartingWith(base));

    if (!existing.has(base)) {
      return base;
    }

    let suffix = 2;
    while (existing.has(`${base}-${suffix}`)) {
      suffix++;
    }
    return `${base}-${suffix}`;
  }

  /**
   * Create a news article with an explicit unique slug and optional photo uploads.
   */
  async create(
    data: Omit<CreateNewsArticleRequest, 'slug'>,
    files: { gallery?: File[] }
  ): Promise<Result<NewsArticleWithUploads, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating news article',
        level: 'info',
        data: {
          title: data.title,
          categories: data.categories.length,
          galleryIds: data.galleryIds?.length ?? 0,
          hasNewPhotos: !!files.gallery?.length,
        },
      });

      const slug = await this.generateUniqueSlug(data.title);

      const { article, uploadResults } = await this.repository.createWithFiles(
        { ...data, slug },
        files
      );

      const uploadWarnings = buildUploadWarnings(uploadResults);

      if (uploadWarnings.length > 0) {
        Sentry.captureMessage('News article created with upload warnings', {
          level: 'warning',
          extra: {
            articleId: article.id,
            warnings: uploadWarnings,
          },
        });
      }

      return ok({ article, uploadWarnings });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'NewsArticleService', method: 'create' },
        extra: { dataKeys: Object.keys(data) },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při vytváření aktuality',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }
}
