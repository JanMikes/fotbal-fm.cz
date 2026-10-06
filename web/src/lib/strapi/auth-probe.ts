import { config } from '@/lib/config';

/**
 * Every Strapi REST endpoint the site reads, directly or through populate. Test U1 derives the
 * same set from the queries and the Strapi schemas and fails if this list misses one.
 */
export const STRAPI_READ_ENDPOINTS = [
  'audience-categories',
  'categories',
  'category-groups',
  'deep-links',
  'footer',
  'forms',
  'matches',
  'navigations',
  'news-article-types',
  'news-articles',
  'pages',
  'partner-categories',
  'partners',
  'player-highlights',
  'players',
  'standings',
  'teams',
  'tournaments',
  'upload/files',
] as const;

const PROBE_TIMEOUT_MS = 5000;

/**
 * One row per probe. The upload plugin's content API ignores `pagination[...]` and would return the
 * whole media library (1,296 files, ~1.5 MB on prod) on every latch attempt; it takes `limit`
 * (D-V1/C-V4, verified on Strapi 5.39). A single type takes no query.
 */
export function probeQuery(endpoint: (typeof STRAPI_READ_ENDPOINTS)[number]): string {
  if (endpoint === 'footer') return '';
  if (endpoint === 'upload/files') return '?limit=1';
  return '?pagination[pageSize]=1';
}

export interface RejectedEndpoint {
  endpoint: string;
  status: 401 | 403;
}

/**
 * Asks Strapi for one row of every endpoint the site reads, with the site's API token, and
 * returns those that reject the token (401/403). Outages (network, timeouts, 5xx, an empty
 * single type's 404) are NOT reported: this check must never keep a container out of service
 * because Strapi is down, only because its credentials are wrong (lily D75, P0-V11).
 */
export async function findRejectedEndpoints(): Promise<RejectedEndpoint[]> {
  const headers: Record<string, string> = {};
  if (config.strapi.apiToken) headers.Authorization = `Bearer ${config.strapi.apiToken}`;
  const results = await Promise.all(
    STRAPI_READ_ENDPOINTS.map(async (endpoint): Promise<RejectedEndpoint | null> => {
      try {
        const res = await fetch(`${config.strapi.url}/api/${endpoint}${probeQuery(endpoint)}`, {
          headers,
          cache: 'no-store',
          signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
        });
        return res.status === 401 || res.status === 403 ? { endpoint, status: res.status } : null;
      } catch {
        return null; // Strapi unreachable or slow: not a credentials problem
      }
    }),
  );
  return results.filter((r): r is RejectedEndpoint => r !== null);
}
