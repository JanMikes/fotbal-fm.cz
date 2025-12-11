/**
 * Tournament match repository.
 * Handles all data access operations for tournament matches.
 */

import { TournamentMatch, CreateTournamentMatchRequest } from '@/types/tournament-match';
import { StrapiClient, StrapiRawTournamentMatch, mapTournamentMatch, mapTournamentMatches } from '@/lib/infrastructure/strapi';
import {
  Repository,
  FindOptions,
  PaginatedResult,
  UserFilterOptions,
} from './base';

const CONTENT_TYPE = 'tournament-matches';

/**
 * Build Strapi query options from find options
 */
function buildQueryOptions(options?: UserFilterOptions & { tournamentId?: number | string }) {
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
    queryOptions.sort = 'createdAt:asc';
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

  if (options?.tournamentId) {
    queryOptions.filters = {
      ...queryOptions.filters,
      tournament: { id: { $eq: options.tournamentId } },
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

export class TournamentMatchRepository implements Repository<
  TournamentMatch,
  CreateTournamentMatchRequest
> {
  constructor(private readonly client: StrapiClient) {}

  async findById(id: string, options?: FindOptions): Promise<TournamentMatch | null> {
    const queryOptions = {
      populate: options?.populate ?? '*',
    };

    const raw = await this.client.findOne<StrapiRawTournamentMatch>(
      CONTENT_TYPE,
      id,
      queryOptions
    );

    if (!raw) {
      return null;
    }

    return mapTournamentMatch(raw);
  }

  async findAll(options?: UserFilterOptions & { tournamentId?: number | string }): Promise<TournamentMatch[]> {
    const queryOptions = buildQueryOptions(options);
    queryOptions.pagination = { limit: 100 };

    const result = await this.client.findMany<StrapiRawTournamentMatch>(
      CONTENT_TYPE,
      queryOptions
    );

    return mapTournamentMatches(result.data);
  }

  async findPaginated(options?: UserFilterOptions & { tournamentId?: number | string }): Promise<PaginatedResult<TournamentMatch>> {
    const queryOptions = buildQueryOptions(options);

    const result = await this.client.findMany<StrapiRawTournamentMatch>(
      CONTENT_TYPE,
      queryOptions
    );

    return {
      data: mapTournamentMatches(result.data),
      pagination: result.pagination ?? {
        page: 1,
        pageSize: result.data.length,
        pageCount: 1,
        total: result.data.length,
      },
    };
  }

  /**
   * Find all matches for a specific tournament
   */
  async findByTournament(tournamentId: number | string, options?: FindOptions): Promise<TournamentMatch[]> {
    return this.findAll({ ...options, tournamentId });
  }

  async create(data: CreateTournamentMatchRequest): Promise<TournamentMatch> {
    const raw = await this.client.create<StrapiRawTournamentMatch>(
      CONTENT_TYPE,
      data as unknown as Record<string, unknown>
    );

    return mapTournamentMatch(raw);
  }

  async update(id: string, data: Partial<CreateTournamentMatchRequest>): Promise<TournamentMatch> {
    const raw = await this.client.update<StrapiRawTournamentMatch>(
      CONTENT_TYPE,
      id,
      data as unknown as Record<string, unknown>
    );

    return mapTournamentMatch(raw);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(CONTENT_TYPE, id);
  }
}
