/**
 * Social-export state repository.
 * Data access for the saved editor state of social exports — one record per
 * (match, variant) pair, shared globally (not per user).
 */

import { StrapiClient } from '@/lib/infrastructure/strapi';
import type { SavedExportState, SavedExportStateDTO } from '@/lib/social-export/saved-state';

const CONTENT_TYPE = 'social-export-states';

interface StrapiRawSocialExportState {
  id: number;
  documentId: string;
  matchId: string;
  templateId: string;
  variantId: string;
  state: SavedExportState;
  updatedAt: string;
}

function mapRecord(raw: StrapiRawSocialExportState): SavedExportStateDTO {
  return {
    variantId: raw.variantId,
    templateId: raw.templateId,
    state: raw.state,
    updatedAt: raw.updatedAt,
  };
}

export class SocialExportStateRepository {
  constructor(private readonly client: StrapiClient) {}

  /** All saved states for a match, newest first, deduped to one per variant. */
  async findByMatch(matchId: string): Promise<SavedExportStateDTO[]> {
    const result = await this.client.findMany<StrapiRawSocialExportState>(CONTENT_TYPE, {
      filters: { matchId: { $eq: matchId } },
      sort: 'updatedAt:desc',
      pagination: { limit: 100 },
    });

    // Two concurrent first saves can race into duplicate records for the same
    // variant — reads keep only the newest one, so the race stays harmless.
    const byVariant = new Map<string, SavedExportStateDTO>();
    for (const raw of result.data) {
      if (!byVariant.has(raw.variantId)) {
        byVariant.set(raw.variantId, mapRecord(raw));
      }
    }
    return Array.from(byVariant.values());
  }

  /** Create or overwrite the saved state for a (match, variant) pair. */
  async upsert(
    matchId: string,
    templateId: string,
    variantId: string,
    state: SavedExportState
  ): Promise<SavedExportStateDTO> {
    const existing = await this.client.findMany<StrapiRawSocialExportState>(CONTENT_TYPE, {
      filters: { matchId: { $eq: matchId }, variantId: { $eq: variantId } },
      sort: 'updatedAt:desc',
      pagination: { limit: 1 },
    });

    const current = existing.data[0];
    if (current) {
      const raw = await this.client.update<StrapiRawSocialExportState>(
        CONTENT_TYPE,
        current.documentId,
        { state, templateId }
      );
      return mapRecord(raw);
    }

    const raw = await this.client.create<StrapiRawSocialExportState>(CONTENT_TYPE, {
      matchId,
      templateId,
      variantId,
      state,
    });
    return mapRecord(raw);
  }
}
