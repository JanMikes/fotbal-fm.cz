import { cacheDeletePattern, cacheClearAll, cacheDelete } from './cache';

export interface WebhookPayload {
  event: string;
  model: string;
  entry?: {
    id?: number;
    documentId?: string;
    slug?: string;
    [key: string]: unknown;
  };
}

// Maps normalized model name → cache key patterns used in data.ts
// First pattern is for specific entry (uses slug/id), rest are collection-level
const MODEL_CACHE_MAP: Record<string, {
  specific: (entry: WebhookPayload['entry']) => string[];
  collection: string[];
  cascading: string[];
}> = {
  'category': {
    specific: (entry) => {
      const keys: string[] = [];
      if (entry?.slug) {
        keys.push(`category:${entry.slug}`);
        keys.push(`category-hero:${entry.slug}`);
      }
      return keys;
    },
    collection: ['categories:*', 'category:*', 'category-groups:*', 'category-hero:*'],
    // Category changes can affect queries filtered by category
    cascading: ['news:cat:*', 'matches:*', 'match:*', 'players:*', 'standings:*', 'player-highlights:*'],
  },
  'category-group': {
    specific: () => [],
    collection: ['category-groups:*'],
    cascading: [],
  },
  'news-article': {
    specific: (entry) => {
      const keys: string[] = [];
      if (entry?.slug) {
        keys.push(`news-article:${entry.slug}`);
      }
      return keys;
    },
    collection: ['news:*', 'news-article:*'],
    cascading: [],
  },
  'news-article-type': {
    specific: () => [],
    collection: ['news-article-types:*'],
    // Type changes can affect news article listings
    cascading: ['news:*'],
  },
  'match': {
    specific: () => [],
    collection: ['matches:*', 'match:*'],
    cascading: [],
  },
  'tournament-match': {
    specific: () => [],
    collection: ['matches:*', 'match:*'],
    cascading: [],
  },
  'player': {
    specific: () => [],
    collection: ['players:*'],
    cascading: [],
  },
  'standing': {
    specific: () => [],
    collection: ['standings:*'],
    cascading: [],
  },
  'navigation': {
    specific: () => [],
    collection: ['navigation:*'],
    cascading: [],
  },
  'footer': {
    specific: () => [],
    collection: ['footer:*'],
    cascading: [],
  },
  'page': {
    specific: (entry) => {
      const keys: string[] = [];
      if (entry?.slug) {
        keys.push(`page:${entry.slug}`);
      }
      return keys;
    },
    collection: ['page:*'],
    cascading: [],
  },
  'partner': {
    specific: (entry) => {
      const keys: string[] = [];
      if (entry?.slug) {
        keys.push(`partner:${entry.slug}`);
      }
      return keys;
    },
    collection: ['partners:*', 'partner:*'],
    cascading: [],
  },
  'player-highlight': {
    specific: () => [],
    collection: ['player-highlights:*'],
    cascading: [],
  },
  'tournament': {
    specific: () => [],
    collection: [],
    // Tournaments appear inside match data
    cascading: ['matches:*', 'match:*'],
  },
  'team-logo': {
    specific: () => [],
    collection: [],
    // Team logos appear in matches and standings
    cascading: ['matches:*', 'match:*', 'standings:*'],
  },
};

export function normalizeModelName(model: string): string {
  // Strapi 5 UID: "api::news-article.news-article" → "news-article"
  if (model.includes('::')) {
    const parts = model.split('::');
    if (parts.length === 2) {
      return parts[1].split('.')[0];
    }
  }
  return model;
}

export async function invalidateCache(
  payload: WebhookPayload,
): Promise<{ model: string; strategy: 'specific' | 'collection' | 'full'; deleted: number }> {
  const model = normalizeModelName(payload.model);
  const mapping = MODEL_CACHE_MAP[model];

  if (!mapping) {
    console.log(`[Cache] Unknown model "${model}", clearing all cache`);
    await cacheClearAll();
    return { model, strategy: 'full', deleted: -1 };
  }

  let totalDeleted = 0;
  let strategy: 'specific' | 'collection' | 'full' = 'specific';

  // Step 1: Try specific key invalidation (only for single-entry events)
  const isSpecificEvent = ['entry.update', 'entry.publish', 'entry.unpublish'].includes(payload.event);
  if (isSpecificEvent && payload.entry) {
    const specificKeys = mapping.specific(payload.entry);
    if (specificKeys.length > 0) {
      for (const key of specificKeys) {
        const ok = await cacheDelete(key);
        if (ok) totalDeleted++;
      }
      console.log(`[Cache] Specific invalidation for ${model}: deleted ${totalDeleted} keys (${specificKeys.join(', ')})`);

      // For updates, also invalidate collection listings that include this entry
      // because the entry might now appear differently in lists
      for (const pattern of mapping.collection) {
        const count = await cacheDeletePattern(pattern);
        totalDeleted += count;
      }

      // Also handle cascading patterns
      for (const pattern of mapping.cascading) {
        const count = await cacheDeletePattern(pattern);
        totalDeleted += count;
      }

      return { model, strategy: 'specific', deleted: totalDeleted };
    }
  }

  // Step 2: Collection-level invalidation (for create/delete or when no specific keys)
  strategy = 'collection';
  const allPatterns = [...mapping.collection, ...mapping.cascading];

  if (allPatterns.length === 0) {
    console.log(`[Cache] No patterns for model "${model}", nothing to invalidate`);
    return { model, strategy: 'collection', deleted: 0 };
  }

  for (const pattern of allPatterns) {
    const count = await cacheDeletePattern(pattern);
    totalDeleted += count;
  }

  console.log(`[Cache] Collection invalidation for ${model}: deleted ${totalDeleted} keys`);
  return { model, strategy, deleted: totalDeleted };
}
