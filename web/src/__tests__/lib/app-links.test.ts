import { describe, it, expect } from 'vitest';
import {
  androidIntentUrl,
  appSchemeUrl,
  appStoreUrl,
  buildAppleAppSiteAssociation,
  buildAssetLinks,
  deepLinkCodeCandidates,
  deepLinkUrl,
  formatDeepLinkCode,
  normalizeDeepLinkCode,
  playStoreUrl,
} from '@/lib/app-links';

describe('deep link codes', () => {
  it('normalizes case, spaces and dashes', () => {
    expect(normalizeDeepLinkCode(' 7k3m-9pq2 ')).toBe('7K3M9PQ2');
  });

  it('offers the Crockford reading of I, L and O as a second candidate', () => {
    expect(deepLinkCodeCandidates('7k3m9pq2')).toEqual(['7K3M9PQ2']);
    expect(deepLinkCodeCandidates('7K3MOPQL')).toEqual(['7K3MOPQL', '7K3M0PQ1']);
    expect(deepLinkCodeCandidates('nope!')).toEqual([]);
    expect(deepLinkCodeCandidates('abc')).toEqual([]);
  });

  it('formats 8-character codes in two groups', () => {
    expect(formatDeepLinkCode('7K3M9PQ2')).toBe('7K3M-9PQ2');
    expect(formatDeepLinkCode('RODICEU12')).toBe('RODICEU12');
  });
});

describe('store and app URLs', () => {
  it('builds the public link on the site URL', () => {
    expect(deepLinkUrl('7K3M9PQ2')).toBe('https://www.fotbal-fm.cz/a/7K3M9PQ2');
  });

  it('points at the club app in both stores', () => {
    expect(appStoreUrl()).toBe('https://apps.apple.com/app/id6750488459');
    expect(playStoreUrl()).toBe('https://play.google.com/store/apps/details?id=com.wantoo.fkfm');
  });

  it('carries the code to Google Play as an install referrer', () => {
    expect(playStoreUrl('7K3M9PQ2')).toBe(
      'https://play.google.com/store/apps/details?id=com.wantoo.fkfm&referrer=deeplink%3D7K3M9PQ2',
    );
  });

  it('builds the custom-scheme and Android intent URLs with a Play Store fallback', () => {
    expect(appSchemeUrl('7K3M9PQ2')).toBe('fkfm://a/7K3M9PQ2');
    const intent = androidIntentUrl('7K3M9PQ2');
    expect(intent.startsWith('intent://a/7K3M9PQ2#Intent;scheme=fkfm;package=com.wantoo.fkfm;')).toBe(true);
    expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent(playStoreUrl('7K3M9PQ2'))};end`);
  });
});

describe('association files', () => {
  it('declares the /a/ path for the iOS app id', () => {
    expect(buildAppleAppSiteAssociation()).toEqual({
      applinks: {
        details: [
          {
            appIDs: ['9C729Z8P28.com.wantoo.fkfm'],
            components: [{ '/': '/a/*', comment: 'Deep links (audience categories, invitations)' }],
          },
        ],
      },
      webcredentials: { apps: ['9C729Z8P28.com.wantoo.fkfm'] },
    });
  });

  it('lists the Android package with both signing fingerprints', () => {
    const [entry] = buildAssetLinks();
    expect(entry.relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(entry.target.package_name).toBe('com.wantoo.fkfm');
    expect(entry.target.sha256_cert_fingerprints).toHaveLength(2);
    expect(entry.target.sha256_cert_fingerprints[0]).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
  });
});
