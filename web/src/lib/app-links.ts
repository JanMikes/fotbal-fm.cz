import { config } from '@/lib/config';
import { SITE_URL } from '@/lib/seo';

/**
 * Everything the website needs to hand a visitor over to the mobile app: store URLs,
 * the Android intent fallback, the custom-scheme URL and the two association files that
 * make https://fotbal-fm.cz/a/<code> open the app directly (Universal Links / App Links).
 *
 * Mirror of api/src/lib/deep-links.ts (code normalization) and strapi/src/lib/deep-link.ts
 * (code generation) — keep the three in step.
 */

export const DEEP_LINK_PATH_PREFIX = '/a/';

/** Uppercase, no spaces or dashes — the stored form of a code. */
export function normalizeDeepLinkCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function isValidDeepLinkCode(code: string): boolean {
  return /^[0-9A-Z]{4,16}$/.test(code);
}

/**
 * Lookup candidates for a typed code: the normalized form and, when it contains letters
 * the generator never uses (I, L, O), the Crockford reading of them (1, 1, 0).
 */
export function deepLinkCodeCandidates(raw: string): string[] {
  const normalized = normalizeDeepLinkCode(raw);
  if (!isValidDeepLinkCode(normalized)) return [];
  const crockford = normalized.replace(/O/g, '0').replace(/[IL]/g, '1');
  return crockford === normalized ? [normalized] : [normalized, crockford];
}

/** 7K3M9PQ2 → 7K3M-9PQ2, easier to read from a screen or a printed page. */
export function formatDeepLinkCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function deepLinkUrl(code: string): string {
  return `${SITE_URL}${DEEP_LINK_PATH_PREFIX}${code}`;
}

export function appStoreUrl(): string {
  return `https://apps.apple.com/app/id${config.mobileApp.iosAppStoreId}`;
}

/**
 * Google Play with an install referrer. After installation the app reads it through the
 * Play Install Referrer API and claims the code — deterministic deferred deep linking.
 */
export function playStoreUrl(code?: string): string {
  const base = `https://play.google.com/store/apps/details?id=${config.mobileApp.androidPackage}`;
  if (!code) return base;
  return `${base}&referrer=${encodeURIComponent(`deeplink=${code}`)}`;
}

/** fkfm://a/<code> — opens an installed app from a button tap when the OS did not already. */
export function appSchemeUrl(code: string): string {
  return `${config.mobileApp.urlScheme}://a/${code}`;
}

/**
 * Android intent URL: opens the app when installed, otherwise falls back to Google Play
 * (with the install referrer) instead of showing a "page not found".
 */
export function androidIntentUrl(code: string): string {
  const fallback = encodeURIComponent(playStoreUrl(code));
  return (
    `intent://a/${code}#Intent;scheme=${config.mobileApp.urlScheme};` +
    `package=${config.mobileApp.androidPackage};S.browser_fallback_url=${fallback};end`
  );
}

/** Served at /.well-known/apple-app-site-association (Universal Links + password autofill). */
export function buildAppleAppSiteAssociation() {
  const appId = config.mobileApp.iosAppId;
  return {
    applinks: {
      details: [
        {
          appIDs: [appId],
          components: [{ '/': `${DEEP_LINK_PATH_PREFIX}*`, comment: 'Deep links (audience categories, invitations)' }],
        },
      ],
    },
    webcredentials: { apps: [appId] },
  };
}

/** Served at /.well-known/assetlinks.json (Android App Links). */
export function buildAssetLinks() {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: config.mobileApp.androidPackage,
        sha256_cert_fingerprints: config.mobileApp.androidSha256Fingerprints,
      },
    },
  ];
}
