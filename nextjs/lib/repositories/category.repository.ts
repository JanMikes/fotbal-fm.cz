/**
 * Category repository.
 * Handles all category data operations.
 */

import { StrapiClient, getStrapiClient } from '@/lib/infrastructure/strapi';
import { Category } from '@/types/category';

const CONTENT_TYPE = 'categories';

/**
 * Repository for category operations
 */
export class CategoryRepository {
  constructor(private readonly client: StrapiClient = getStrapiClient()) {}

  /**
   * Find all categories sorted by sortOrder
   */
  async findAll(): Promise<Category[]> {
    const result = await this.client.findMany<StrapiRawCategory>(CONTENT_TYPE, {
      sort: ['sortOrder:asc'],
      pagination: { limit: 100 },
    });

    return result.data.map(mapCategory);
  }

  /**
   * Find a category by ID
   */
  async findById(id: string): Promise<Category | null> {
    const result = await this.client.findOne<StrapiRawCategory>(CONTENT_TYPE, id);
    return result ? mapCategory(result) : null;
  }
}

// =============================================================================
// Raw Strapi Types
// =============================================================================

interface StrapiRawCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// Mappers
// =============================================================================

function mapCategory(raw: StrapiRawCategory): Category {
  return {
    id: raw.documentId,
    name: raw.name,
    slug: raw.slug,
    sortOrder: raw.sortOrder,
  };
}
