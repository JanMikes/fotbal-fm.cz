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
import { NotFoundError, DuplicateError } from '@/lib/core/errors';
import { TeamRepository } from './team.repository';

const CONTENT_TYPE = 'matches';
const STRAPI_REF = 'api::match.match';

/**
 * Default populate configuration for matches.
 * Explicitly includes author email for notification purposes.
 */
const DEFAULT_POPULATE = {
  homeTeam: { fields: ['id', 'documentId', 'name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
  awayTeam: { fields: ['id', 'documentId', 'name'], populate: { logo: { fields: ['url', 'alternativeText', 'width', 'height'] } } },
  categories: true,
  images: true,
  files: true,
  tournament: { fields: ['id', 'documentId', 'name'] },
  author: { fields: ['id', 'documentId', 'firstname', 'lastname', 'email'] },
  lastModifiedBy: { fields: ['id', 'documentId', 'firstname', 'lastname'] },
};

/**
 * Minimal populate for summary/calendar views.
 * Only fetches team names, scores, date, and categories — no images, files, or author.
 */
const SUMMARY_POPULATE = {
  homeTeam: { fields: ['id', 'documentId', 'name'] },
  awayTeam: { fields: ['id', 'documentId', 'name'] },
  categories: { fields: ['id', 'documentId', 'name', 'slug', 'sortOrder'] },
  tournament: { fields: ['id', 'documentId', 'name'] },
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
  private readonly teamRepository: TeamRepository;

  constructor(private readonly client: StrapiClient) {
    this.teamRepository = new TeamRepository(client);
  }

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
    const allMatches: StrapiRawMatch[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      queryOptions.pagination = { page, pageSize };

      const result = await this.client.findMany<StrapiRawMatch>(
        CONTENT_TYPE,
        queryOptions
      );

      allMatches.push(...result.data);

      const total = result.pagination?.total ?? result.data.length;
      if (allMatches.length >= total || result.data.length < pageSize) {
        break;
      }
      page++;
    }

    return mapMatches(allMatches);
  }

  /**
   * Find matches with minimal populate for dashboard/calendar views.
   */
  async findAllSummary(options?: { limit?: number; filters?: Record<string, unknown> }): Promise<Match[]> {
    const allMatches: StrapiRawMatch[] = [];
    let page = 1;
    const pageSize = 100;

    // Fetch all pages for calendar completeness
    while (true) {
      const result = await this.client.findMany<StrapiRawMatch>(
        CONTENT_TYPE,
        {
          populate: SUMMARY_POPULATE,
          sort: 'matchDate:desc',
          pagination: { page, pageSize },
          filters: options?.filters,
        }
      );

      allMatches.push(...result.data);

      const total = result.pagination?.total ?? result.data.length;
      if (allMatches.length >= total || result.data.length < pageSize) {
        break;
      }
      page++;
    }

    return mapMatches(allMatches);
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
    const { categories, tournament, homeTeam, awayTeam, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    // Resolve team names to documentIds (find or create)
    let homeTeamId: string | undefined;
    let awayTeamId: string | undefined;
    if (homeTeam) {
      homeTeamId = await this.teamRepository.findOrCreate(homeTeam);
      strapiData.homeTeam = homeTeamId;
    }
    if (awayTeam) {
      awayTeamId = await this.teamRepository.findOrCreate(awayTeam);
      strapiData.awayTeam = awayTeamId;
    }

    // Check for duplicate match (same teams + date)
    if (homeTeamId && awayTeamId && data.matchDate) {
      const existing = await this.client.findMany<StrapiRawMatch>(
        CONTENT_TYPE,
        {
          filters: {
            homeTeam: { documentId: { $eq: homeTeamId } },
            awayTeam: { documentId: { $eq: awayTeamId } },
            matchDate: { $eq: data.matchDate },
          },
          pagination: { pageSize: 1 },
        }
      );
      if (existing.data.length > 0) {
        throw new DuplicateError(
          'Zápas s těmito týmy a datem již existuje. Pokud chcete upravit existující zápas, použijte tlačítko "Upravit".'
        );
      }
    }

    if (categories && categories.length > 0) {
      strapiData.categories = {
        connect: categories,
      };
    }

    if (tournament) {
      strapiData.tournament = tournament;
    }

    const created = await this.client.create<StrapiRawMatch>(
      CONTENT_TYPE,
      strapiData
    );

    // Re-fetch with full populate since create response lacks relations
    const match = await this.findById(created.documentId);
    if (!match) {
      return mapMatch(created);
    }
    return match;
  }

  async update(id: string, data: Partial<CreateMatchRequest>): Promise<Match> {
    // Transform categories array to Strapi 5 relation format
    const { categories, tournament, homeTeam, awayTeam, ...rest } = data;
    const strapiData: Record<string, unknown> = { ...rest };

    // Resolve team names to documentIds (find or create)
    if (homeTeam !== undefined) {
      if (homeTeam) {
        const homeTeamId = await this.teamRepository.findOrCreate(homeTeam);
        strapiData.homeTeam = homeTeamId;
      } else {
        strapiData.homeTeam = null;
      }
    }
    if (awayTeam !== undefined) {
      if (awayTeam) {
        const awayTeamId = await this.teamRepository.findOrCreate(awayTeam);
        strapiData.awayTeam = awayTeamId;
      } else {
        strapiData.awayTeam = null;
      }
    }

    if (categories !== undefined) {
      strapiData.categories = {
        set: categories,
      };
    }

    if (tournament !== undefined) {
      strapiData.tournament = tournament || null;
    }

    await this.client.update<StrapiRawMatch>(
      CONTENT_TYPE,
      id,
      strapiData
    );

    // Re-fetch with full populate since update response lacks relations
    const match = await this.findById(id);
    if (!match) {
      throw new NotFoundError(`Zápas s ID ${id} nebyl nalezen po aktualizaci`);
    }
    return match;
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
      // Re-fetch only if files were uploaded
      const updated = await this.findById(match.id);
      return { match: updated ?? match, uploadResults };
    }

    return {
      match,
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
      // Re-fetch only if files were uploaded (to get updated file relations)
      const updated = await this.findById(id);
      return { match: updated ?? match, uploadResults };
    }

    return {
      match,
      uploadResults,
    };
  }
}
