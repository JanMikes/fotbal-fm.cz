import { describe, it, expect } from 'vitest';
import { pageMetadata, toDescription, SITE_NAME } from '@/lib/seo';

describe('toDescription', () => {
  it('falls back when the source is empty', () => {
    expect(toDescription(null, 'fallback')).toBe('fallback');
    expect(toDescription('   ', 'fallback')).toBe('fallback');
    expect(toDescription('<p> </p>', 'fallback')).toBe('fallback');
  });

  it('strips HTML and collapses whitespace', () => {
    expect(toDescription('<p>Zápas   skončil</p>\n<b>výhrou</b>', 'x')).toBe('Zápas skončil výhrou');
  });

  it('strips markdown emphasis, headings and links', () => {
    expect(toDescription('## **Výhra** v [derby](https://example.com)', 'x')).toBe('Výhra v derby');
    expect(toDescription('![foto](/uploads/a.jpg) Text', 'x')).toBe('Text');
  });

  it('keeps short text untouched', () => {
    const short = 'Krátký popis zápasu.';
    expect(toDescription(short, 'x')).toBe(short);
  });

  it('cuts long text at a word boundary under the SERP limit', () => {
    const long = 'slovo '.repeat(60);
    const result = toDescription(long, 'x');

    expect(result.length).toBeLessThanOrEqual(161);
    expect(result.endsWith('…')).toBe(true);
    expect(result).not.toContain('slov…');
  });

  it('trims trailing punctuation before the ellipsis', () => {
    const long = `${'a'.repeat(150)} konec, dalsi slova navic pro presah limitu`;
    expect(toDescription(long, 'x')).not.toContain(',…');
  });
});

describe('pageMetadata', () => {
  it('suffixes the title and mirrors the description into OG and Twitter', () => {
    const meta = pageMetadata({ title: 'Novinky', description: 'Popis', path: '/novinky' });

    expect(meta.title).toBe(`Novinky | ${SITE_NAME}`);
    expect(meta.description).toBe('Popis');
    expect(meta.alternates?.canonical).toBe('/novinky');
    expect(meta.openGraph?.title).toBe(`Novinky | ${SITE_NAME}`);
    expect(meta.openGraph?.description).toBe('Popis');
    expect(meta.twitter?.description).toBe('Popis');
  });

  it('omits images when none is given and includes them when it is', () => {
    const without = pageMetadata({ title: 'A', description: 'B', path: '/a' });
    const withImage = pageMetadata({ title: 'A', description: 'B', path: '/a', image: 'https://cdn/x.jpg' });

    expect(without.openGraph).not.toHaveProperty('images');
    expect(withImage.openGraph?.images).toEqual([{ url: 'https://cdn/x.jpg' }]);
  });

  it('emits noindex only when asked', () => {
    expect(pageMetadata({ title: 'A', description: 'B', path: '/a' }).robots).toBeUndefined();
    expect(pageMetadata({ title: 'A', description: 'B', path: '/a', noIndex: true }).robots)
      .toEqual({ index: false, follow: false });
  });
});
