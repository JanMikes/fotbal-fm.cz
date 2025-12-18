/**
 * Tournament repository.
 * Handles all data access operations for tournaments.
 */

import { Tournament, CreateTournamentRequest } from '@/types/tournament';
import { StrapiClient, StrapiRawTournament, mapTournament, mapTournaments } from '@/lib/infrastructure/strapi';
import {
  RepositoryWithUploads,
  FindOptions,
  PaginatedResult,
  UploadResults,
  UserFilterOptions,
} from './base';
import { NotFoundError } from '@/lib/core/errors';

const CONTENT_TYPE = 'tournaments';
const STRAPI_REF = 'api::tournament.tournament';

/**
 * Build Strapi query options from find options
 */
function buildQueryOptions(options?: UserFilterOptions) {
  const queryOptions: {
    populate?: string;
    sort?: string | string[];
    pagination?: { page?: number; pageSize?: number; limit?: number };
    filters?: Record<string, unknown>;
  } = {
    populate: '*',
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

export class TournamentRepository implements RepositoryWithUploads<
  Tournament,
  CreateTournamentRequest
> {
  constructor(private readonly client: StrapiClient) {}

  async findById(id: string, options?: FindOptions): Promise<Tournament | null> {
    const queryOptions = {
      populate: options?.populate ?? '*',
    };

    const raw = await this.client.findOne<StrapiRawTournament>(
      CONTENT_TYPE,
      id,
      queryOptions
    );

    if (!raw) {
      return null;
    }

    return mapTournament(raw);
  }

  async findAll(options?: UserFilterOptions): Promise<Tournament[]> {
    const queryOptions = buildQueryOptions(options);
    queryOptions.pagination = { limit: 100 };

    const result = await this.client.findMany<StrapiRawTournament>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapTournaments(result.data);
  }

  async findPaginated(options?: UserFilterOptions): Promise<PaginatedResult<Tournament>> {
    const queryOptions = buildQueryOptions(options);

    const result = await this.client.findMany<StrapiRawTournament>(
      CONTENT_TYPE,
      queryOptions
    );

    return {
      data: mapTournaments(result.data),
      pagination: result.pagination ?? {
        page: 1,
        pageSize: result.data.length,
        pageCount: 1,
        total: result.data.length,
      },
    };
  }

  async findByUser(userId: number, options?: FindOptions): Promise<Tournament[]> {
    return this.findAll({ ...options, userId });
  }

  /**
   * Find all tournaments sorted by date (for dropdowns)
   */
  async findAllForDropdown(): Promise<Tournament[]> {
    const queryOptions = {
      sort: 'dateFrom:desc',
      pagination: { limit: 100 },
    };

    const result = await this.client.findMany<StrapiRawTournament>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapTournaments(result.data);
  }

  async create(data: CreateTournamentRequest): Promise<Tournament> {
    // Transform categories array to Strapi 5 relation format
    // Using shorthand syntax: connect: ['documentId1', 'documentId2']
    const { categories, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    if (categories && categories.length > 0) {
      strapiData.categories = {
        connect: categories,
      };
    }

    const raw = await this.client.create<StrapiRawTournament>(
      CONTENT_TYPE,
      strapiData
    );

    return mapTournament(raw);
  }

  async update(id: string, data: Partial<CreateTournamentRequest>): Promise<Tournament> {
    // Transform categories array to Strapi 5 relation format
    // Using shorthand syntax: set: ['documentId1', 'documentId2']
    const { categories, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    if (categories !== undefined) {
      strapiData.categories = {
        set: categories,
      };
    }

    const raw = await this.client.update<StrapiRawTournament>(
      CONTENT_TYPE,
      id,
      strapiData
    );

    return mapTournament(raw);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(CONTENT_TYPE, id);
  }

  async uploadFiles(
    id: string,
    files: Record<string, File[]>
  ): Promise<UploadResults> {
    const results: UploadResults = {};

    const entity = await this.client.findOne<StrapiRawTournament>(CONTENT_TYPE, id);
    if (!entity) {
      throw new NotFoundError(`Turnaj s ID ${id} nebyl nalezen`);
    }
    const numericId = (entity as { id: number }).id;

    // Upload photos
    if (files.photos && files.photos.length > 0) {
      const uploadResult = await this.client.uploadToEntity(
        files.photos,
        STRAPI_REF,
        numericId,
        'photos'
      );
      results.photos = {
        success: uploadResult.success,
        error: uploadResult.error,
      };
    }

    return results;
  }

  async createWithFiles(
    data: CreateTournamentRequest,
    files: { photos?: File[] }
  ): Promise<{ tournament: Tournament; uploadResults: UploadResults }> {
    const tournament = await this.create(data);

    const filesToUpload: Record<string, File[]> = {};
    if (files.photos && files.photos.length > 0) {
      filesToUpload.photos = files.photos;
    }

    let uploadResults: UploadResults = {};
    if (Object.keys(filesToUpload).length > 0) {
      uploadResults = await this.uploadFiles(tournament.id, filesToUpload);
    }

    const updated = await this.findById(tournament.id);

    return {
      tournament: updated ?? tournament,
      uploadResults,
    };
  }

  async updateWithFiles(
    id: string,
    data: Partial<CreateTournamentRequest>,
    files?: { photos?: File[] }
  ): Promise<{ tournament: Tournament; uploadResults: UploadResults }> {
    const tournament = await this.update(id, data);

    const filesToUpload: Record<string, File[]> = {};
    if (files?.photos && files.photos.length > 0) {
      filesToUpload.photos = files.photos;
    }

    let uploadResults: UploadResults = {};
    if (Object.keys(filesToUpload).length > 0) {
      uploadResults = await this.uploadFiles(id, filesToUpload);
    }

    const updated = await this.findById(id);

    return {
      tournament: updated ?? tournament,
      uploadResults,
    };
  }
}
