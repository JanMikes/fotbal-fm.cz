export type {
  StrapiRawMedia,
  StrapiRawCategory,
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
  categories: import('@fotbal-fm/strapi-client').StrapiRawCategory[] | null;
  newsArticleType: StrapiRawNewsArticleType | null;
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
  createdAt: string;
  updatedAt: string;
}
