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
    cascading: ['news:*'],
  },
  'match': {
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
    cascading: ['matches:*', 'match:*'],
  },
  'team': {
    specific: () => [],
    collection: [],
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

function isPluginModel(model: string): boolean {
  return model.startsWith('plugin::');
}

export async function invalidateCache(
  payload: WebhookPayload,
): Promise<{ model: string; strategy: 'specific' | 'collection' | 'ignored' | 'full'; deleted: number }> {
  const model = normalizeModelName(payload.model);

  // Ignore Strapi plugin models (users-permissions, upload, etc.)
  if (isPluginModel(payload.model)) {
    console.log(`[Cache] Ignoring plugin model "${payload.model}"`);
    return { model, strategy: 'ignored', deleted: 0 };
  }

  const mapping = MODEL_CACHE_MAP[model];

  if (!mapping) {
    console.log(`[Cache] Unknown model "${model}", clearing all cache`);
    await cacheClearAll();
    return { model, strategy: 'full', deleted: -1 };
  }

  let totalDeleted = 0;

  // Step 1: Try specific key invalidation (for single-entry events with slug)
  const isSpecificEvent = ['entry.update', 'entry.publish', 'entry.unpublish'].includes(payload.event);
  if (isSpecificEvent && payload.entry) {
    const specificKeys = mapping.specific(payload.entry);
    if (specificKeys.length > 0) {
      for (const key of specificKeys) {
        totalDeleted += await cacheDelete(key);
      }
      console.log(`[Cache] Specific invalidation for ${model}: ${specificKeys.join(', ')}`);
    }
  }

  // Step 2: Always invalidate collection + cascading patterns
  // Even on specific events, lists that contain this entry need refreshing
  const allPatterns = [...mapping.collection, ...mapping.cascading];
  for (const pattern of allPatterns) {
    totalDeleted += await cacheDeletePattern(pattern);
  }

  const strategy = isSpecificEvent && payload.entry ? 'specific' : 'collection';
  console.log(`[Cache] ${strategy} invalidation for ${model}: deleted ${totalDeleted} keys`);
  return { model, strategy, deleted: totalDeleted };
}
