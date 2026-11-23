import { strapiGet, strapiPost, strapiPut } from './strapi.js';
import {
  AUDIENCE_CATEGORY_FIELDS,
  fetchUserAudienceCategories,
  listAudienceCategories,
  setUserAudienceCategories,
  type CurrentUser,
} from './audience.js';
import type { AppPlatform } from './platform.js';
import type { StrapiRawAudienceCategory, StrapiRawDeepLink } from '../types/strapi.js';

export type DeepLinkInvalidReason = 'not_found' | 'inactive' | 'expired';
export type ClaimSource = 'register' | 'login' | 'claim';

const MAX_CODE_INPUT_LENGTH = 32;

/**
 * The stored form of a code is uppercase without spaces/dashes. Generated codes never
 * contain I, L or O (Crockford base32), so a code typed from a printed page with those
 * letters most likely meant 1 / 1 / 0 — the second candidate covers that.
 */
export function candidateCodes(raw: string): string[] {
  const normalized = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!normalized || normalized.length > MAX_CODE_INPUT_LENGTH || !/^[0-9A-Z]+$/.test(normalized)) return [];
  const crockford = normalized.replace(/O/g, '0').replace(/[IL]/g, '1');
  return crockford === normalized ? [normalized] : [normalized, crockford];
}

const CUSTOM_CODE_PATTERN = /^[0-9A-Z]{4,16}$/;

/**
 * A code chosen by the caller, in the stored form — same rules as Strapi's admin form
 * (strapi/src/lib/deep-link.ts): a pasted link is reduced to its last path segment, then
 * uppercased without spaces/dashes. Returns null when it is not 4–16 letters A–Z / digits.
 */
export function normalizeRequestedCode(raw: string): string | null {
  let value = raw.trim();
  if (value.includes('/')) {
    const path = value.split(/[?#]/)[0].replace(/\/+$/, '');
    value = path.slice(path.lastIndexOf('/') + 1);
  }
  const code = value.toUpperCase().replace(/[\s-]/g, '');
  return CUSTOM_CODE_PATTERN.test(code) ? code : null;
}

export function deepLinkValidity(link: StrapiRawDeepLink, now: Date = new Date()): DeepLinkInvalidReason | null {
  if (link.active === false) return 'inactive';
  if (link.expiresAt && new Date(link.expiresAt).getTime() <= now.getTime()) return 'expired';
  return null;
}

const deepLinkPopulate = { audienceCategories: { fields: AUDIENCE_CATEGORY_FIELDS } };

export async function findDeepLinkByCode(raw: string): Promise<StrapiRawDeepLink | null> {
  for (const code of candidateCodes(raw)) {
    const result = await strapiGet<StrapiRawDeepLink>('/deep-links', {
      filters: { code: { $eq: code } },
      populate: deepLinkPopulate,
      pagination: { pageSize: 1 },
    });
    const link = result?.data?.[0];
    if (link) return link;
  }
  return null;
}

export interface ClaimInput {
  link: StrapiRawDeepLink;
  user: CurrentUser;
  source: ClaimSource;
  platform: AppPlatform;
}

export interface ClaimResult {
  alreadyClaimed: boolean;
  added: StrapiRawAudienceCategory[];
  audienceCategories: StrapiRawAudienceCategory[];
}

function formatClaimLabel(user: CurrentUser, at: Date): string {
  const stamp = at.toISOString().slice(0, 16).replace('T', ' ');
  return `${user.username} · ${stamp}`;
}

/**
 * First claim of a link by a user: adds the link's categories to the account (union — the
 * user's other categories are untouched) and records the claim. Any later claim of the same
 * link by the same user is a no-op — it does not re-add a category the user has since
 * removed on purpose — and only reports the current state with alreadyClaimed = true.
 */
export async function claimDeepLink({ link, user, source, platform }: ClaimInput): Promise<ClaimResult> {
  const current = await fetchUserAudienceCategories(user.id);

  const existing = await strapiGet<{ id: number }>('/deep-link-claims', {
    filters: { deepLink: { id: { $eq: link.id } }, user: { id: { $eq: user.id } } },
    pagination: { pageSize: 1 },
  });
  if ((existing?.data?.length ?? 0) > 0) {
    return { alreadyClaimed: true, added: [], audienceCategories: current };
  }

  const currentIds = new Set(current.map((c) => c.id));
  const added = (link.audienceCategories ?? []).filter((c) => !currentIds.has(c.id));
  if (added.length > 0) {
    await setUserAudienceCategories(user.id, [...currentIds, ...added.map((c) => c.id)]);
  }

  await strapiPost('/deep-link-claims', {
    data: {
      label: formatClaimLabel(user, new Date()),
      deepLink: link.documentId,
      user: user.id,
      source,
      platform,
    },
  });
  await strapiPut(`/deep-links/${link.documentId}`, {
    data: { claimsCount: (link.claimsCount ?? 0) + 1 },
  });

  return { alreadyClaimed: false, added, audienceCategories: [...current, ...added] };
}

export class DeepLinkCategoryError extends Error {
  constructor(
    public readonly kind: 'unknown' | 'not_selectable',
    public readonly slug: string,
  ) {
    super(kind === 'unknown' ? `Neznámá skupina: ${slug}` : `Skupinu nelze sdílet pozvánkou: ${slug}`);
  }
}

export class DeepLinkCodeError extends Error {
  constructor(public readonly kind: 'invalid' | 'taken', public readonly code: string) {
    super(
      kind === 'invalid'
        ? 'Kód odkazu smí obsahovat jen písmena A–Z a číslice (4–16 znaků).'
        : `Kód odkazu "${code}" už používá jiný odkaz.`,
    );
  }
}

function idsKey(categories: Array<{ id: number }> | null | undefined): string {
  return (categories ?? [])
    .map((c) => c.id)
    .sort((a, b) => a - b)
    .join(',');
}

export interface CreateDeepLinkInput {
  user: CurrentUser;
  /** Slugs to put on the link; omitted = the inviter's own selectable categories. */
  audienceCategorySlugs?: string[];
  name?: string;
  /** Own code (or a pasted link); omitted / blank = generated by Strapi. */
  code?: string;
}

/**
 * "Invite a friend": a link owned by the calling user. Only selectable categories may be
 * spread this way. An identical active link by the same user is reused, so tapping the
 * share button twice hands out the same URL instead of minting a new code each time.
 */
export async function createDeepLinkForUser({ user, audienceCategorySlugs, name, code: rawCode }: CreateDeepLinkInput): Promise<StrapiRawDeepLink> {
  let chosen: StrapiRawAudienceCategory[];

  if (audienceCategorySlugs === undefined) {
    const mine = await fetchUserAudienceCategories(user.id);
    chosen = mine.filter((c) => c.selectable !== false);
  } else {
    const all = await listAudienceCategories();
    const bySlug = new Map(all.map((c) => [c.slug, c]));
    chosen = [];
    for (const slug of new Set(audienceCategorySlugs)) {
      const category = bySlug.get(slug);
      if (!category) throw new DeepLinkCategoryError('unknown', slug);
      if (category.selectable === false) throw new DeepLinkCategoryError('not_selectable', slug);
      chosen.push(category);
    }
  }

  const wanted = idsKey(chosen);
  const existing = await strapiGet<StrapiRawDeepLink>('/deep-links', {
    filters: { createdByUser: { id: { $eq: user.id } }, active: { $eq: true } },
    populate: deepLinkPopulate,
    sort: 'createdAt:desc',
    pagination: { pageSize: 100 },
  });
  let code: string | undefined;
  if (rawCode !== undefined && rawCode.trim() !== '') {
    const normalized = normalizeRequestedCode(rawCode);
    if (!normalized) throw new DeepLinkCodeError('invalid', rawCode.trim());
    code = normalized;
  }

  // Same request again (double tap, retry) → the same link. With a chosen code, only that code counts.
  const reusable = (existing?.data ?? []).find(
    (link) =>
      deepLinkValidity(link) === null &&
      idsKey(link.audienceCategories) === wanted &&
      (code === undefined || link.code === code),
  );
  if (reusable) return reusable;

  if (code !== undefined) {
    const taken = await strapiGet<StrapiRawDeepLink>('/deep-links', {
      filters: { code: { $eq: code } },
      fields: ['code'],
      pagination: { pageSize: 1 },
    });
    if (taken?.data?.length) throw new DeepLinkCodeError('taken', code);
  }

  const trimmedName = name?.trim();
  const created = await strapiPost<{ data: StrapiRawDeepLink }>(
    '/deep-links?populate[audienceCategories][fields][0]=name&populate[audienceCategories][fields][1]=slug&populate[audienceCategories][fields][2]=description&populate[audienceCategories][fields][3]=sortOrder&populate[audienceCategories][fields][4]=selectable',
    {
      data: {
        name: trimmedName || `Pozvánka od ${user.username}`,
        audienceCategories: chosen.map((c) => c.id),
        createdByUser: user.id,
        active: true,
        ...(code !== undefined && { code }),
      },
    },
  );
  return created.data;
}
