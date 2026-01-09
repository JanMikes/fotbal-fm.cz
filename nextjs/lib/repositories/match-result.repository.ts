/**
 * Match result repository.
 * Handles all data access operations for match results.
 */

import { MatchResult, CreateMatchResultRequest } from '@/types/match-result';
import { StrapiClient, StrapiRawMatchResult, mapMatchResult, mapMatchResults } from '@/lib/infrastructure/strapi';
import {
  Repository,
  RepositoryWithUploads,
  FindOptions,
  PaginatedResult,
  UploadResults,
  UserFilterOptions,
} from './base';
import { NotFoundError } from '@/lib/core/errors';

const CONTENT_TYPE = 'match-results';
const STRAPI_REF = 'api::match-result.match-result';

/**
 * Default populate configuration for match results.
 * Explicitly includes author email for notification purposes.
 */
const DEFAULT_POPULATE = {
  categories: true,
  images: true,
  files: true,
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

export class MatchResultRepository implements RepositoryWithUploads<
  MatchResult,
  CreateMatchResultRequest
> {
  constructor(private readonly client: StrapiClient) {}

  async findById(id: string, options?: FindOptions): Promise<MatchResult | null> {
    const queryOptions = {
      populate: options?.populate ?? DEFAULT_POPULATE,
    };

    const raw = await this.client.findOne<StrapiRawMatchResult>(
      CONTENT_TYPE,
      id,
      queryOptions
    );

    if (!raw) {
      return null;
    }

    return mapMatchResult(raw);
  }

  async findAll(options?: UserFilterOptions): Promise<MatchResult[]> {
    const queryOptions = buildQueryOptions(options);
    // Set high limit for "all" queries
    queryOptions.pagination = { limit: 100 };

    const result = await this.client.findMany<StrapiRawMatchResult>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapMatchResults(result.data);
  }

  async findPaginated(options?: UserFilterOptions): Promise<PaginatedResult<MatchResult>> {
    const queryOptions = buildQueryOptions(options);

    const result = await this.client.findMany<StrapiRawMatchResult>(
      CONTENT_TYPE,
      queryOptions
    );

    return {
      data: mapMatchResults(result.data),
      pagination: result.pagination ?? {
        page: 1,
        pageSize: result.data.length,
        pageCount: 1,
        total: result.data.length,
      },
    };
  }

  async findByUser(userId: number, options?: FindOptions): Promise<MatchResult[]> {
    return this.findAll({ ...options, userId });
  }

  async create(data: CreateMatchResultRequest): Promise<MatchResult> {
    // Transform categories array to Strapi 5 relation format
    // Using shorthand syntax: connect: ['documentId1', 'documentId2']
    const { categories, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    if (categories && categories.length > 0) {
      strapiData.categories = {
        connect: categories,
      };
    }

    const raw = await this.client.create<StrapiRawMatchResult>(
      CONTENT_TYPE,
      strapiData
    );

    return mapMatchResult(raw);
  }

  async update(id: string, data: Partial<CreateMatchResultRequest>): Promise<MatchResult> {
    // Transform categories array to Strapi 5 relation format
    // Using shorthand syntax: set: ['documentId1', 'documentId2']
    const { categories, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    if (categories !== undefined) {
      strapiData.categories = {
        set: categories,
      };
    }

    const raw = await this.client.update<StrapiRawMatchResult>(
      CONTENT_TYPE,
      id,
      strapiData
    );

    return mapMatchResult(raw);
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
    const entity = await this.client.findOne<StrapiRawMatchResult>(CONTENT_TYPE, id);
    if (!entity) {
      throw new NotFoundError(`Výsledek zápasu s ID ${id} nebyl nalezen`);
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
   * Create a match result with file uploads in one operation
   * Files are uploaded after creation, with partial success handling
   */
  async createWithFiles(
    data: CreateMatchResultRequest,
    files: { images?: File[]; files?: File[] }
  ): Promise<{ matchResult: MatchResult; uploadResults: UploadResults }> {
    // Create the match result first
    const matchResult = await this.create(data);

    // Upload files (non-blocking, with error tracking)
    const filesToUpload: Record<string, File[]> = {};
    if (files.images && files.images.length > 0) {
      filesToUpload.images = files.images;
    }
    if (files.files && files.files.length > 0) {
      filesToUpload.files = files.files;
    }

    let uploadResults: UploadResults = {};
    if (Object.keys(filesToUpload).length > 0) {
      uploadResults = await this.uploadFiles(matchResult.id, filesToUpload);
    }

    // Refetch to get updated data with uploaded files
    const updated = await this.findById(matchResult.id);

    return {
      matchResult: updated ?? matchResult,
      uploadResults,
    };
  }

  /**
   * Update a match result with file uploads
   */
  async updateWithFiles(
    id: string,
    data: Partial<CreateMatchResultRequest>,
    files?: { images?: File[]; files?: File[] }
  ): Promise<{ matchResult: MatchResult; uploadResults: UploadResults }> {
    // Update the match result
    const matchResult = await this.update(id, data);

    // Upload new files if provided
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

    // Refetch to get updated data
    const updated = await this.findById(id);

    return {
      matchResult: updated ?? matchResult,
      uploadResults,
    };
  }
}
