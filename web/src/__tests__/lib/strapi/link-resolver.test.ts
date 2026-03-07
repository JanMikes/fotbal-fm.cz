import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
  },
}));

import { resolveLink, resolveTextLink } from '@/lib/strapi/link-resolver';

describe('resolveLink', () => {
  it('returns null for null input', () => {
    expect(resolveLink(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(resolveLink(undefined)).toBeNull();
  });

  it('resolves page slug link', () => {
    const result = resolveLink({
      id: 1,
      page: { slug: 'o-klubu' },
      anchor: null,
      url: null,
      file: null,
    });
    expect(result).toEqual({ href: '/o-klubu', external: false });
  });

  it('resolves page slug with anchor', () => {
    const result = resolveLink({
      id: 1,
      page: { slug: 'o-klubu' },
      anchor: 'historie',
      url: null,
      file: null,
    });
    expect(result).toEqual({ href: '/o-klubu#historie', external: false });
  });

  it('resolves external URL', () => {
    const result = resolveLink({
      id: 1,
      page: null,
      anchor: null,
      url: 'https://facr.cz',
      file: null,
    });
    expect(result).toEqual({ href: 'https://facr.cz', external: true });
  });

  it('resolves internal URL as non-external', () => {
    const result = resolveLink({
      id: 1,
      page: null,
      anchor: null,
      url: '/kontakt',
      file: null,
    });
    expect(result).toEqual({ href: '/kontakt', external: false });
  });

  it('resolves file URL with uploads transform', () => {
    const result = resolveLink({
      id: 1,
      page: null,
      anchor: null,
      url: null,
      file: { url: '/uploads/doc.pdf', alternativeText: null, width: 0, height: 0, name: 'doc.pdf' },
    });
    expect(result).toEqual({ href: 'http://uploads.test/uploads/doc.pdf', external: false });
  });

  it('resolves anchor-only link', () => {
    const result = resolveLink({
      id: 1,
      page: null,
      anchor: 'sekce',
      url: null,
      file: null,
    });
    expect(result).toEqual({ href: '#sekce', external: false });
  });

  it('returns null when no link target', () => {
    const result = resolveLink({
      id: 1,
      page: null,
      anchor: null,
      url: null,
      file: null,
    });
    expect(result).toBeNull();
  });

  it('prioritizes page over url', () => {
    const result = resolveLink({
      id: 1,
      page: { slug: 'stranka' },
      anchor: null,
      url: 'https://external.com',
      file: null,
    });
    expect(result).toEqual({ href: '/stranka', external: false });
  });

  it('prioritizes url over file', () => {
    const result = resolveLink({
      id: 1,
      page: null,
      anchor: null,
      url: '/internal',
      file: { url: '/uploads/file.pdf', alternativeText: null, width: 0, height: 0, name: 'file.pdf' },
    });
    expect(result).toEqual({ href: '/internal', external: false });
  });
});

describe('resolveTextLink', () => {
  it('returns null for null input', () => {
    expect(resolveTextLink(null)).toBeNull();
  });

  it('returns null when no link target resolved', () => {
    const result = resolveTextLink({
      id: 1,
      text: 'Some text',
      page: null,
      anchor: null,
      url: null,
      file: null,
      disabled: false,
    });
    expect(result).toBeNull();
  });

  it('resolves text link with page', () => {
    const result = resolveTextLink({
      id: 1,
      text: 'O klubu',
      page: { slug: 'o-klubu' },
      anchor: null,
      url: null,
      file: null,
      disabled: false,
    });
    expect(result).toEqual({
      href: '/o-klubu',
      external: false,
      text: 'O klubu',
      disabled: false,
    });
  });

  it('resolves disabled text link', () => {
    const result = resolveTextLink({
      id: 1,
      text: 'Disabled link',
      page: null,
      anchor: null,
      url: '/somewhere',
      file: null,
      disabled: true,
    });
    expect(result).toEqual({
      href: '/somewhere',
      external: false,
      text: 'Disabled link',
      disabled: true,
    });
  });

  it('uses empty string when text is null', () => {
    const result = resolveTextLink({
      id: 1,
      text: null,
      page: { slug: 'test' },
      anchor: null,
      url: null,
      file: null,
      disabled: false,
    });
    expect(result?.text).toBe('');
  });

  it('defaults disabled to false when undefined', () => {
    const result = resolveTextLink({
      id: 1,
      text: 'Link',
      page: { slug: 'test' },
      anchor: null,
      url: null,
      file: null,
      disabled: undefined as unknown as boolean,
    });
    expect(result?.disabled).toBe(false);
  });
});
