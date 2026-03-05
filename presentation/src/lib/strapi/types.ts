export type {
  StrapiRawMedia,
  StrapiRawCategory,
  StrapiRawCategoryGroup,
  StrapiCollectionResponse,
  StrapiSingleResponse,
  StrapiQueryOptions,
} from '@fotbal-fm/strapi-client';

export interface StrapiRawNewsArticleType {
  id: number;
  documentId: string;
  name: string;
  slug: string;
}

export interface StrapiRawNewsArticle {
  id: number;
  documentId: string;
  title: string;
  slug: string | null;
  description: string | null;
  video: string | null;
  mainPhoto: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
  gallery: import('@fotbal-fm/strapi-client').StrapiRawMedia[] | null;
  files: import('@fotbal-fm/strapi-client').StrapiRawMedia[] | null;
  categories: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  newsArticleTypes: StrapiRawNewsArticleType[] | null;
  relatedNews: StrapiRawNewsArticle[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrapiRawPlayer {
  id: number;
  documentId: string;
  name: string;
  slug: string | null;
  type: 'hráč' | 'realizační tým';
  number: number | null;
  sortOrder: number;
  position: 'brankář' | 'obránce' | 'záložník' | 'útočník' | null;
  positionText: string | null;
  bio: string | null;
  photo: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  categories: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  facrId: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  facrUuid: string | null;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
}

// Navigation & Page types

export interface StrapiRawLink {
  id: number;
  page: { slug: string } | null;
  anchor: string | null;
  url: string | null;
  file: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
}

export interface StrapiRawTextLink extends StrapiRawLink {
  text: string | null;
  disabled: boolean;
}

export interface StrapiRawNavigation {
  id: number;
  documentId: string;
  title: string;
  link: StrapiRawLink | null;
  sortOrder: number;
}

export interface StrapiRawPageParent {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  parent: StrapiRawPageParent | null;
}

export interface StrapiRawPage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  meta_description: string | null;
  parent: StrapiRawPageParent | null;
  content: StrapiRawDynamicZoneComponent[];
  sidebar: StrapiRawDynamicZoneComponent[] | null;
}

export interface StrapiRawDynamicZoneComponent {
  id: number;
  __component: string;
  [key: string]: unknown;
}

export interface StrapiRawStanding {
  id: number;
  documentId: string;
  position: number;
  team: StrapiRawTeam | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  competitionCode: string;
  season: number;
  tournament: { id: number; documentId: string; name: string } | null;
  categories: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
}

export type StrapiRawCategoryWithHero = import('@fotbal-fm/strapi-client').StrapiRawCategory & {
  heroSlide1Image: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
  heroSlide2Image: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
  heroSlide3Image: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
  heroSlide3NewsArticle: StrapiRawNewsArticle | null;
  heroSlide3Title: string | null;
  heroSlide3Text: string | null;
  heroSlide3Link: string | null;
};

export interface StrapiRawFooterLinkSection {
  id: number;
  title: string;
  links: StrapiRawTextLink[];
  sortOrder: number;
}

export interface StrapiRawFooter {
  id: number;
  documentId: string;
  text: string | null;
  address: string | null;
  mail: string | null;
  phone: string | null;
  linkSections: StrapiRawFooterLinkSection[] | null;
  bottomLinks: StrapiRawTextLink[] | null;
}

export interface StrapiRawPartner {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  logo: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
  description: string | null;
  sortOrder: number;
  content: StrapiRawDynamicZoneComponent[];
  panel: StrapiRawDynamicZoneComponent[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrapiRawTeam {
  id: number;
  documentId: string;
  name: string;
  logo?: import('@fotbal-fm/strapi-client').StrapiRawMedia | null;
}

export interface StrapiRawMatch {
  id: number;
  documentId: string;
  homeTeam: StrapiRawTeam | null;
  awayTeam: StrapiRawTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  matchTime: string | null;
  venue: string | null;
  round: number | null;
  competitionName: string | null;
  competitionCode: string | null;
  season: number | null;
  period: string | null;
  organizingBody: string | null;
  facrId: string | null;
  tournament: {
    id: number;
    documentId: string;
    name: string;
  } | null;
  categories: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrapiRawStatValue {
  id: number;
  value: number;
  label: string;
}

export interface StrapiRawPlayerHighlight {
  id: number;
  documentId: string;
  title: string;
  player: StrapiRawPlayer | null;
  highlightStat: StrapiRawStatValue;
  stats: StrapiRawStatValue[] | null;
  categories: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  sortOrder: number;
}
