export {
  cached,
  hasEntry,
  bumpTags,
  entryKey,
  cacheMode,
  softTtlMs,
  TAGVER,
  TAGTS,
  TRANSPORT,
  ENTRY_PREFIX,
  FOREGROUND_BUDGET_MS,
  FAILURE_MEMO_MS,
  NO_REDIS_MEMO_MS,
  __resetSwrState,
  __swrStateSize,
} from './swr';
export type { CachedOptions } from './swr';
export { UpstreamError, isUpstreamError, UpstreamAuthError, isUpstreamAuthError } from './errors';
export { TAGS } from './tags';
export type { Tag } from './tags';
export { metrics, setMetricsSink } from './metrics';
export type { MetricsSink, CacheResult } from './metrics';
export { getRedisClient, closeRedisClient, REDIS_CLIENT_OPTIONS } from './redis';
