/**
 * Social-export state service.
 *
 * Persists the export editor's state per (match, variant) so an accidental
 * refresh never loses work. Uses the shared API-token Strapi client (not the
 * user JWT) because the saved state is global — every backoffice user sees and
 * writes the same record; access control happens at the Next.js route level.
 */

import * as Sentry from '@sentry/nextjs';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, ErrorCode } from '@/lib/core/errors';
import { getStrapiClient } from '@/lib/infrastructure/strapi';
import { SocialExportStateRepository } from '@/lib/repositories/social-export-state.repository';
import type { SavedExportState, SavedExportStateDTO } from '@/lib/social-export/saved-state';

export class SocialExportStateService {
  constructor(private readonly repository: SocialExportStateRepository) {}

  async getForMatch(matchId: string): Promise<Result<SavedExportStateDTO[], AppError>> {
    try {
      const states = await this.repository.findByMatch(matchId);
      return ok(states);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'SocialExportStateService', method: 'getForMatch' },
        extra: { matchId },
      });
      if (error instanceof AppError) return err(error);
      return err(new AppError('Chyba při načítání uloženého stavu', ErrorCode.STRAPI_ERROR));
    }
  }

  async save(
    matchId: string,
    templateId: string,
    variantId: string,
    state: SavedExportState
  ): Promise<Result<SavedExportStateDTO, AppError>> {
    try {
      const saved = await this.repository.upsert(matchId, templateId, variantId, state);
      return ok(saved);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'SocialExportStateService', method: 'save' },
        extra: { matchId, variantId },
      });
      if (error instanceof AppError) return err(error);
      return err(new AppError('Chyba při ukládání stavu', ErrorCode.STRAPI_ERROR));
    }
  }
}

// --------------------------------------------------------------------------
// Singleton
// --------------------------------------------------------------------------

let instance: SocialExportStateService | null = null;

/** Return the process-level singleton. */
export function getSocialExportStateService(): SocialExportStateService {
  if (!instance) {
    instance = new SocialExportStateService(new SocialExportStateRepository(getStrapiClient()));
  }
  return instance;
}
