/**
 * WBoost Brand-Manuals API infrastructure barrel.
 * Re-exports the client, token manager, and raw types.
 */

export { WboostClient, getWboostClient } from './client';
export { WboostTokenManager, getWboostTokenManager } from './token-manager';
export type {
  WboostRawTemplate,
  WboostRawVariant,
  WboostRawInput,
  WboostTokenResponse,
} from './types';
