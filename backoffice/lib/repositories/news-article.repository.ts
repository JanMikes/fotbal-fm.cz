/**
 * News article repository.
 * Handles all data access operations for news articles.
 */

import { NewsArticle, CreateNewsArticleRequest } from '@/types/news-article';
import { StrapiClient, StrapiRawNewsArticle, mapNewsArticle } from '@/lib/infrastructure/strapi';
import { UploadResults } from './base';
import { NotFoundError } from '@/lib/core/errors';

const CONTENT_TYPE = 'news-articles';
const STRAPI_REF = 'api::news-article.news-article';

const DEFAULT_POPULATE = {
  mainPhoto: true,
  gallery: true,
  files: true,
  categories: true,
  author: { fields: ['id', 'documentId', 'firstname', 'lastname', 'email'] },
};

export class NewsArticleRepository {
  constructor(private readonly client: StrapiClient) {}

  async findById(id: string): Promise<NewsArticle | null> {
    const raw = await this.client.findOne<StrapiRawNewsArticle>(
      CONTENT_TYPE,
      id,
      { populate: DEFAULT_POPULATE }
    );

    if (!raw) {
      return null;
    }

    return mapNewsArticle(raw);
  }

  /**
   * Find existing slugs starting with the given base.
   * Used to generate a unique slug deterministically.
   */
  async findSlugsStartingWith(base: string): Promise<string[]> {
    const result = await this.client.findMany<StrapiRawNewsArticle>(
      CONTENT_TYPE,
      {
        filters: { slug: { $startsWith: base } },
        fields: ['slug'],
        pagination: { pageSize: 200 },
      }
    );

    return result.data
      .map((a) => a.slug)
      .filter((s): s is string => Boolean(s));
  }

  async create(data: CreateNewsArticleRequest): Promise<NewsArticle> {
    const { categories, mainPhotoId, galleryIds, fileIds, author, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    if (categories && categories.length > 0) {
      strapiData.categories = {
        connect: categories,
      };
    }

    if (author) {
      strapiData.author = author;
    }

    // Reuse already-uploaded Strapi media (match images, tournament photos)
    // by referencing their numeric upload ids.
    if (mainPhotoId) {
      strapiData.mainPhoto = mainPhotoId;
    }
    if (galleryIds && galleryIds.length > 0) {
      strapiData.gallery = galleryIds;
    }
    if (fileIds && fileIds.length > 0) {
      strapiData.files = fileIds;
    }

    const created = await this.client.create<StrapiRawNewsArticle>(
      CONTENT_TYPE,
      strapiData
    );

    // Re-fetch with full populate since create response lacks relations
    const article = await this.findById(created.documentId);
    if (!article) {
      return mapNewsArticle(created);
    }
    return article;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(CONTENT_TYPE, id);
  }

  /**
   * Create an article and upload new gallery photos in one operation.
   * If the article has no main photo yet, the first uploaded photo becomes it.
   */
  async createWithFiles(
    data: CreateNewsArticleRequest,
    files: { gallery?: File[] }
  ): Promise<{ article: NewsArticle; uploadResults: UploadResults }> {
    const article = await this.create(data);
    const uploadResults: UploadResults = {};

    if (files.gallery && files.gallery.length > 0) {
      const entity = await this.client.findOne<StrapiRawNewsArticle>(CONTENT_TYPE, article.id);
      if (!entity) {
        throw new NotFoundError(`Aktualita s ID ${article.id} nebyla nalezena`);
      }

      const uploadResult = await this.client.uploadToEntity(
        files.gallery,
        STRAPI_REF,
        entity.id,
        'gallery'
      );
      uploadResults.gallery = {
        success: uploadResult.success,
        error: uploadResult.error,
      };

      // Promote the first uploaded photo to main photo when none was set
      if (
        uploadResult.success &&
        !data.mainPhotoId &&
        uploadResult.uploadedFiles &&
        uploadResult.uploadedFiles.length > 0
      ) {
        await this.client.update<StrapiRawNewsArticle>(CONTENT_TYPE, article.id, {
          mainPhoto: uploadResult.uploadedFiles[0].id,
        });
      }

      const updated = await this.findById(article.id);
      return { article: updated ?? article, uploadResults };
    }

    return { article, uploadResults };
  }
}
