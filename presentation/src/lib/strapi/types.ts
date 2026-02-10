export interface StrapiRawMedia {
  id: number;
  documentId: string;
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
  formats: Record<string, unknown> | null;
}

export interface StrapiRawCategory {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  sortOrder: number;
}

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
  mainPhoto: StrapiRawMedia | null;
  gallery: StrapiRawMedia[] | null;
  categories: StrapiRawCategory[] | null;
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
  photo: StrapiRawMedia | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  categories: StrapiRawCategory[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrapiCollectionResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiSingleResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface StrapiQueryOptions {
  populate?: string | string[] | Record<string, unknown>;
  filters?: Record<string, unknown>;
  sort?: string | string[];
  pagination?: {
    page?: number;
    pageSize?: number;
    limit?: number;
  };
  fields?: string[];
}
