import { afterEach, describe, expect, it } from 'vitest';
import { buildDeepLinkUrl, deepLinkBaseUrl, deepLinkBaseUrlProblem, isValidDeepLinkCode, normalizeDeepLinkCode } from '../lib/deep-link';

describe('deep-link code', () => {
  it('normalises typed codes', () => {
    expect(normalizeDeepLinkCode(' fotbal-fm ')).toBe('FOTBALFM');
  });

  it('reduces a pasted link to its code', () => {
    for (const raw of ['https://fotbal-fm.cz/a/fotbalfm', 'fotbal-fm.cz/a/FOTBALFM/', 'https://fotbal-fm.cz/a/FOTBALFM?utm=x#top', 'http://localhost:3001/a/fotbalfm']) {
      expect(normalizeDeepLinkCode(raw)).toBe('FOTBALFM');
    }
    expect(isValidDeepLinkCode(normalizeDeepLinkCode('https://fotbal-fm.cz/a/'))).toBe(false);
  });
});

describe('deep-link base URL', () => {
  const original = process.env.DEEP_LINK_BASE_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.DEEP_LINK_BASE_URL;
    else process.env.DEEP_LINK_BASE_URL = original;
  });

  it('accepts absolute http(s) URLs ending in /a', () => {
    expect(deepLinkBaseUrlProblem('https://fotbal-fm.cz/a')).toBeNull();
    expect(deepLinkBaseUrlProblem('http://localhost:3001/a/')).toBeNull();
  });

  it('rejects bases that would produce dead links', () => {
    expect(deepLinkBaseUrlProblem('https://fotbal-fm.cz')).toContain('/a');
    expect(deepLinkBaseUrlProblem('https://fotbal-fm.cz/app')).toContain('/a');
    expect(deepLinkBaseUrlProblem('fotbal-fm.cz/a')).toContain('absolute');
    expect(deepLinkBaseUrlProblem('ftp://fotbal-fm.cz/a')).toContain('http');
    expect(deepLinkBaseUrlProblem('https://fotbal-fm.cz/a?x=1')).toContain('?');
  });

  it('falls back to the default for an unusable base, and trims a trailing slash', () => {
    process.env.DEEP_LINK_BASE_URL = 'https://fotbal-fm.cz';
    expect(buildDeepLinkUrl('ABCD')).toBe('https://fotbal-fm.cz/a/ABCD');
    process.env.DEEP_LINK_BASE_URL = 'http://localhost:3001/a/';
    expect(deepLinkBaseUrl()).toBe('http://localhost:3001/a');
    delete process.env.DEEP_LINK_BASE_URL;
    expect(buildDeepLinkUrl('ABCD')).toBe('https://fotbal-fm.cz/a/ABCD');
  });
});
