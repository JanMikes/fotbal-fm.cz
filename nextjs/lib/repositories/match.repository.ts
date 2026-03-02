/**
 * Match repository.
 * Handles all data access operations for matches.
 */

import { Match, CreateMatchRequest } from '@/types/match';
import { StrapiClient, StrapiRawMatch, mapMatch, mapMatches } from '@/lib/infrastructure/strapi';
import {
  Repository,
  RepositoryWithUploads,
  FindOptions,
  PaginatedResult,
  UploadResults,
  UserFilterOptions,
} from './base';
import { NotFoundError } from '@/lib/core/errors';

const CONTENT_TYPE = 'matches';
const STRAPI_REF = 'api::match.match';

/**
 * Default populate configuration for matches.
 * Explicitly includes author email for notification purposes.
 */
const DEFAULT_POPULATE = {
  categories: true,
  images: true,
  files: true,
  tournament: { fields: ['id', 'documentId', 'name'] },
  author: { fields: ['id', 'documentId', 'firstname', 'lastname', 'email'] },
  lastModifiedBy: { fields: ['id', 'documentId', 'firstname', 'lastname'] },
};

/**
 * Build Strapi query options from find options
 */
function buildQueryOptions(options?: UserFilterOptions) {
  const queryOptions: {
    populate?: typeof DEFAULT_POPULATE;
    sort?: string | string[];
    pagination?: { page?: number; pageSize?: number; limit?: number };
    filters?: Record<string, unknown>;
  } = {
    populate: DEFAULT_POPULATE,
  };

  if (options?.sort) {
    queryOptions.sort = options.sort;
  } else {
    queryOptions.sort = 'createdAt:desc';
  }

  if (options?.page || options?.pageSize) {
    queryOptions.pagination = {
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  if (options?.userId) {
    queryOptions.filters = {
      author: { id: { $eq: options.userId } },
    };
  }

  if (options?.filters) {
    queryOptions.filters = {
      ...queryOptions.filters,
      ...options.filters,
    };
  }

  return queryOptions;
}

export class MatchRepository implements RepositoryWithUploads<
  Match,
  CreateMatchRequest
> {
  constructor(private readonly client: StrapiClient) {}

  async findById(id: string, options?: FindOptions): Promise<Match | null> {
    const queryOptions = {
      populate: options?.populate ?? DEFAULT_POPULATE,
    };

    const raw = await this.client.findOne<StrapiRawMatch>(
      CONTENT_TYPE,
      id,
      queryOptions
    );

    if (!raw) {
      return null;
    }

    return mapMatch(raw);
  }

  async findAll(options?: UserFilterOptions): Promise<Match[]> {
    const queryOptions = buildQueryOptions(options);
    // Set high limit for "all" queries
    queryOptions.pagination = { limit: 100 };

    const result = await this.client.findMany<StrapiRawMatch>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapMatches(result.data);
  }

  async findPaginated(options?: UserFilterOptions): Promise<PaginatedResult<Match>> {
    const queryOptions = buildQueryOptions(options);

    const result = await this.client.findMany<StrapiRawMatch>(
      CONTENT_TYPE,
      queryOptions
    );

    return {
      data: mapMatches(result.data),
      pagination: result.pagination ?? {
        page: 1,
        pageSize: result.data.length,
        pageCount: 1,
        total: result.data.length,
      },
    };
  }

  async findByUser(userId: number, options?: FindOptions): Promise<Match[]> {
    return this.findAll({ ...options, userId });
  }

  async create(data: CreateMatchRequest): Promise<Match> {
    // Transform categories array to Strapi 5 relation format
    const { categories, tournament, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    if (categories && categories.length > 0) {
      strapiData.categories = {
        connect: categories,
      };
    }

    if (tournament) {
      strapiData.tournament = tournament;
    }

    const raw = await this.client.create<StrapiRawMatch>(
      CONTENT_TYPE,
      strapiData
    );

    return mapMatch(raw);
  }

  async update(id: string, data: Partial<CreateMatchRequest>): Promise<Match> {
    // Transform categories array to Strapi 5 relation format
    const { categories, tournament, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    if (categories !== undefined) {
      strapiData.categories = {
        set: categories,
      };
    }

    if (tournament !== undefined) {
      strapiData.tournament = tournament || null;
    }

    const raw = await this.client.update<StrapiRawMatch>(
      CONTENT_TYPE,
      id,
      strapiData
    );

    return mapMatch(raw);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(CONTENT_TYPE, id);
  }

  async uploadFiles(
    id: string,
    files: Record<string, File[]>
  ): Promise<UploadResults> {
    const results: UploadResults = {};

    // Get the numeric ID for upload (Strapi upload requires numeric ID)
    const entity = await this.client.findOne<StrapiRawMatch>(CONTENT_TYPE, id);
    if (!entity) {
      throw new NotFoundError(`Zápas s ID ${id} nebyl nalezen`);
    }
    const numericId = (entity as { id: number }).id;

    // Upload images
    if (files.images && files.images.length > 0) {
      const uploadResult = await this.client.uploadToEntity(
        files.images,
        STRAPI_REF,
        numericId,
        'images'
      );
      results.images = {
        success: uploadResult.success,
        error: uploadResult.error,
      };
    }

    // Upload files
    if (files.files && files.files.length > 0) {
      const uploadResult = await this.client.uploadToEntity(
        files.files,
        STRAPI_REF,
        numericId,
        'files'
      );
      results.files = {
        success: uploadResult.success,
        error: uploadResult.error,
      };
    }

    return results;
  }

  /**
   * Create a match with file uploads in one operation
   */
  async createWithFiles(
    data: CreateMatchRequest,
    files: { images?: File[]; files?: File[] }
  ): Promise<{ match: Match; uploadResults: UploadResults }> {
    const match = await this.create(data);

    const filesToUpload: Record<string, File[]> = {};
    if (files.images && files.images.length > 0) {
      filesToUpload.images = files.images;
    }
    if (files.files && files.files.length > 0) {
      filesToUpload.files = files.files;
    }

    let uploadResults: UploadResults = {};
    if (Object.keys(filesToUpload).length > 0) {
      uploadResults = await this.uploadFiles(match.id, filesToUpload);
    }

    const updated = await this.findById(match.id);

    return {
      match: updated ?? match,
      uploadResults,
    };
  }

  /**
   * Update a match with file uploads
   */
  async updateWithFiles(
    id: string,
    data: Partial<CreateMatchRequest>,
    files?: { images?: File[]; files?: File[] }
  ): Promise<{ match: Match; uploadResults: UploadResults }> {
    const match = await this.update(id, data);

    const filesToUpload: Record<string, File[]> = {};
    if (files?.images && files.images.length > 0) {
      filesToUpload.images = files.images;
    }
    if (files?.files && files.files.length > 0) {
      filesToUpload.files = files.files;
    }

    let uploadResults: UploadResults = {};
    if (Object.keys(filesToUpload).length > 0) {
      uploadResults = await this.uploadFiles(id, filesToUpload);
    }

    const updated = await this.findById(id);

    return {
      match: updated ?? match,
      uploadResults,
    };
  }
}
