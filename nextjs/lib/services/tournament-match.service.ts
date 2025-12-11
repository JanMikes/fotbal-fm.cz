/**
 * Tournament Match Service.
 * Handles business logic for tournament match operations.
 */

import * as Sentry from '@sentry/nextjs';
import { TournamentMatch, CreateTournamentMatchRequest } from '@/types/tournament-match';
import { TournamentMatchRepository } from '@/lib/repositories';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, NotFoundError, ErrorCode } from '@/lib/core/errors';
import { createUserTournamentMatchRepository } from '@/lib/di';

export class TournamentMatchService {
  constructor(private readonly repository: TournamentMatchRepository) {}

  /**
   * Create a service instance authenticated with user's JWT
   */
  static forUser(jwt: string): TournamentMatchService {
    return new TournamentMatchService(createUserTournamentMatchRepository(jwt));
  }

  /**
   * Get a tournament match by ID
   */
  async getById(id: string): Promise<Result<TournamentMatch, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting tournament match by ID',
        level: 'info',
        data: { id },
      });

      const match = await this.repository.findById(id);

      if (!match) {
        return err(new NotFoundError(`Zápas turnaje s ID ${id} nebyl nalezen`));
      }

      return ok(match);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'getById' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání zápasu turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all matches for a tournament
   */
  async getByTournament(tournamentId: number | string): Promise<Result<TournamentMatch[], AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Getting matches for tournament',
        level: 'info',
        data: { tournamentId },
      });

      const matches = await this.repository.findByTournament(tournamentId);
      return ok(matches);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'getByTournament' },
        extra: { tournamentId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání zápasů turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get all tournament matches with optional filters
   */
  async getAll(options?: { tournamentId?: number | string }): Promise<Result<TournamentMatch[], AppError>> {
    try {
      const matches = await this.repository.findAll(options);
      return ok(matches);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'getAll' },
        extra: options,
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání zápasů turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Create a new tournament match
   */
  async create(data: CreateTournamentMatchRequest): Promise<Result<TournamentMatch, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating tournament match',
        level: 'info',
        data: {
          homeTeam: data.homeTeam,
          awayTeam: data.awayTeam,
          tournamentId: data.tournament,
        },
      });

      const match = await this.repository.create(data);
      return ok(match);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'create' },
        extra: { dataKeys: Object.keys(data) },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při vytváření zápasu turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Create multiple tournament matches in batch
   */
  async createMany(matches: CreateTournamentMatchRequest[]): Promise<Result<TournamentMatch[], AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Creating multiple tournament matches',
        level: 'info',
        data: { count: matches.length },
      });

      const createdMatches: TournamentMatch[] = [];

      for (const matchData of matches) {
        const match = await this.repository.create(matchData);
        createdMatches.push(match);
      }

      return ok(createdMatches);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'createMany' },
        extra: { count: matches.length },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při vytváření zápasů turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Update an existing tournament match
   */
  async update(
    id: string,
    data: Partial<CreateTournamentMatchRequest>
  ): Promise<Result<TournamentMatch, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Updating tournament match',
        level: 'info',
        data: {
          id,
          updatedFields: Object.keys(data),
        },
      });

      const match = await this.repository.update(id, data);
      return ok(match);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'update' },
        extra: { id, dataKeys: Object.keys(data) },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při aktualizaci zápasu turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Delete a tournament match
   */
  async delete(id: string): Promise<Result<void, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Deleting tournament match',
        level: 'info',
        data: { id },
      });

      await this.repository.delete(id);
      return ok(undefined);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'delete' },
        extra: { id },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při mazání zápasu turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Delete all matches for a tournament
   */
  async deleteByTournament(tournamentId: number | string): Promise<Result<number, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'service',
        message: 'Deleting all matches for tournament',
        level: 'info',
        data: { tournamentId },
      });

      const matches = await this.repository.findByTournament(tournamentId);

      for (const match of matches) {
        await this.repository.delete(match.id);
      }

      return ok(matches.length);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'TournamentMatchService', method: 'deleteByTournament' },
        extra: { tournamentId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při mazání zápasů turnaje',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }
}
