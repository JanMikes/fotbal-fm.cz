import { Category } from './category';
import { StrapiImage, StrapiFile, UserInfo } from './match';

export interface NewsArticle {
  id: string;
  title: string;
  slug?: string;
  date: string;
  description?: string;
  video?: string;
  mainPhoto: StrapiImage | null;
  gallery: StrapiImage[];
  files: StrapiFile[];
  categories: Category[];
  author?: UserInfo;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNewsArticleRequest {
  title: string;
  slug?: string;
  date: string;
  description: string;
  video?: string;
  categories: string[];
  /** Existing Strapi upload file id to use as the main photo */
  mainPhotoId?: number;
  /** Existing Strapi upload file ids to attach to the gallery */
  galleryIds?: number[];
  /** Existing Strapi upload file ids to attach as documents */
  fileIds?: number[];
  author?: number;
}
