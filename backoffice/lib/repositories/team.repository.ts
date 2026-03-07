/**
 * Team repository.
 * Handles data access operations for teams.
 */

import { StrapiClient, getStrapiClient } from '@/lib/infrastructure/strapi';

const CONTENT_TYPE = 'teams';

export interface Team {
  id: string; // documentId
  name: string;
}

interface StrapiRawTeam {
  id: number;
  documentId: string;
  name: string;
}

function mapTeam(raw: StrapiRawTeam): Team {
  return {
    id: raw.documentId,
    name: raw.name,
  };
}

export class TeamRepository {
  constructor(private readonly client: StrapiClient = getStrapiClient()) {}

  /**
   * Find all teams sorted by name
   */
  async findAll(): Promise<Team[]> {
    const result = await this.client.findMany<StrapiRawTeam>(CONTENT_TYPE, {
      sort: ['name:asc'],
      pagination: { limit: 500 },
    });

    return result.data.map(mapTeam);
  }

  /**
   * Find a team by exact name (case-insensitive via $eqi)
   */
  async findByName(name: string): Promise<Team | null> {
    const result = await this.client.findMany<StrapiRawTeam>(CONTENT_TYPE, {
      filters: { name: { $eqi: name } },
      pagination: { limit: 1 },
    });

    if (result.data.length === 0) {
      return null;
    }

    return mapTeam(result.data[0]);
  }

  /**
   * Create a new team
   */
  async create(name: string): Promise<Team> {
    const raw = await this.client.create<StrapiRawTeam>(CONTENT_TYPE, { name });
    return mapTeam(raw);
  }

  /**
   * Find an existing team by name, or create one if it doesn't exist.
   * Returns the team's documentId.
   */
  async findOrCreate(name: string): Promise<string> {
    const existing = await this.findByName(name);
    if (existing) {
      return existing.id;
    }
    const created = await this.create(name);
    return created.id;
  }
}
