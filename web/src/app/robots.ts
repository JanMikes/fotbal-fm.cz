import type { MetadataRoute } from 'next';

/**
 * /robots.txt — allow everything, no sitemap (the site has none). Without this route the
 * request fell into the `[slug]` catch-all and cost a CMS page query per cache miss.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
  };
}
