import type { Context } from 'hono';
import { fetchUserAudienceCategories } from './audience.js';
import { candidateCodes, claimDeepLink, deepLinkValidity, findDeepLinkByCode, type ClaimSource } from './deep-links.js';
import { readPlatform } from './platform.js';
import { claimLimiter, resolveLimiter } from './deep-link-limits.js';
import { clientIp } from './rate-limit.js';
import { mapAudienceCategories, type AudienceCategory } from '../mappers/audience.js';

export interface StrapiAuthResult {
  jwt: string;
  user: { id: number; username: string; email: string } & Record<string, unknown>;
}

export interface DeepLinkClaimOutcome {
  code: string;
  claimed: boolean;
  alreadyClaimed: boolean;
  reason?: 'not_found' | 'inactive' | 'expired' | 'rate_limited' | 'error';
  addedAudienceCategories: AudienceCategory[];
  audienceCategories: AudienceCategory[];
}

export type EnrichedAuthResult = Omit<StrapiAuthResult, 'user'> & {
  user: StrapiAuthResult['user'] & { audienceCategories?: AudienceCategory[] };
  deepLink?: DeepLinkClaimOutcome;
};

/**
 * Login/register responses stay exactly what Strapi returns, plus two additive fields:
 * `user.audienceCategories` and — when the app passed `deepLinkCode` — a `deepLink`
 * outcome. A stale or unknown code never fails the login/registration itself.
 */
export async function enrichAuthResult(
  c: Context,
  result: StrapiAuthResult,
  options: { deepLinkCode?: string; source: ClaimSource },
): Promise<EnrichedAuthResult> {
  const { user } = result;
  let deepLink: DeepLinkClaimOutcome | undefined;
  let audienceCategories: AudienceCategory[] | undefined;

  if (options.deepLinkCode) {
    const code = candidateCodes(options.deepLinkCode)[0] ?? options.deepLinkCode.trim();
    const rejected = (reason: DeepLinkClaimOutcome['reason']): DeepLinkClaimOutcome =>
      ({ code, claimed: false, alreadyClaimed: false, reason, addedAudienceCategories: [], audienceCategories: [] });
    try {
      // Same budgets as the dedicated deep-link routes, so login/register cannot be used to probe codes.
      const link = resolveLimiter.check(clientIp(c)) ? await findDeepLinkByCode(options.deepLinkCode) : undefined;
      const reason = link === undefined ? 'rate_limited' : link ? deepLinkValidity(link) : 'not_found';

      if (!link || reason) {
        deepLink = rejected(reason ?? 'not_found');
      } else if (!claimLimiter.check(String(user.id))) {
        deepLink = rejected('rate_limited');
      } else {
        const claim = await claimDeepLink({ link, user, source: options.source, platform: readPlatform(c) });
        audienceCategories = mapAudienceCategories(claim.audienceCategories);
        deepLink = {
          code: link.code,
          claimed: true,
          alreadyClaimed: claim.alreadyClaimed,
          addedAudienceCategories: mapAudienceCategories(claim.added),
          audienceCategories,
        };
      }
    } catch (err) {
      console.error('[auth] deep link claim failed:', err);
      deepLink = rejected('error');
    }
  }

  if (!audienceCategories) {
    try {
      audienceCategories = mapAudienceCategories(await fetchUserAudienceCategories(user.id));
    } catch (err) {
      console.error('[auth] could not load audience categories:', err);
    }
  }

  return {
    ...result,
    user: { ...user, ...(audienceCategories ? { audienceCategories } : {}) },
    ...(deepLink ? { deepLink } : {}),
  };
}
