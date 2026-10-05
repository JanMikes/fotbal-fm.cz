/*
 * Cache tags. A tag is a generation counter in Redis (fotbalfm:v2:tagver). Every cached Strapi
 * read declares the tags of everything it filters on or populates; Strapi bumps the tags of every
 * content type it writes (strapi/src/cache-invalidation.ts, via the same type → tags map in
 * type-tags.json, of which strapi/src/cache-tags.json is a byte-identical copy — test U2b).
 * `media` is bumped by upload events, `all` by Strapi's boot and by manual "invalidate
 * everything" (`HINCRBY fotbalfm:v2:tagver all 1`); every read implicitly carries `all`.
 */

export const TAGS = {
  audienceCategory: 'audience-category',
  category: 'category',
  categoryGroup: 'category-group',
  deepLink: 'deep-link',
  footer: 'footer',
  form: 'form',
  match: 'match',
  navigation: 'navigation',
  newsArticle: 'news-article',
  newsArticleType: 'news-article-type',
  page: 'page',
  partner: 'partner',
  partnerCategory: 'partner-category',
  player: 'player',
  playerHighlight: 'player-highlight',
  standing: 'standing',
  team: 'team',
  tournament: 'tournament',
  media: 'media',
  all: 'all',
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];
