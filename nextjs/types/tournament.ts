import { StrapiImage, UserInfo } from './match-result';
import { TournamentMatch } from './tournament-match';
import { Category } from './category';

export interface TournamentPlayer {
  id?: number;
  title: string;
  playerName: string;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  location?: string;
  dateFrom: string;
  dateTo?: string;
  categories: Category[];
  photos: StrapiImage[];
  imagesUrl?: string;
  players?: TournamentPlayer[];
  matches?: TournamentMatch[];
  authorId: number;
  author?: UserInfo;
  modifiedBy?: UserInfo;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentFormData {
  name: string;
  description?: string;
  location?: string;
  dateFrom: string;
  dateTo?: string;
  categoryIds: string[];
  photos?: FileList;
  imagesUrl?: string;
  players?: TournamentPlayer[];
}

export interface CreateTournamentRequest {
  name: string;
  description?: string;
  location?: string;
  dateFrom: string;
  dateTo?: string;
  categories: string[];
  imagesUrl?: string;
  players?: TournamentPlayer[];
  author?: number;
}

export interface StrapiTournamentResponse {
  data: {
    id: number;
    attributes: {
      name: string;
      description: string | null;
      location: string | null;
      dateFrom: string;
      dateTo: string | null;
      categories: {
        data: Array<{
          id: number;
          documentId: string;
          name: string;
          slug: string;
          sortOrder: number;
        }>;
      };
      photos: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      imagesUrl: string | null;
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      modifiedBy?: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        } | null;
      };
      createdAt: string;
      updatedAt: string;
    };
  };
}

export interface StrapiTournamentsResponse {
  data: Array<{
    id: number;
    attributes: {
      name: string;
      description: string | null;
      location: string | null;
      dateFrom: string;
      dateTo: string | null;
      categories: {
        data: Array<{
          id: number;
          documentId: string;
          name: string;
          slug: string;
          sortOrder: number;
        }>;
      };
      photos: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      imagesUrl: string | null;
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      modifiedBy?: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        } | null;
      };
      createdAt: string;
      updatedAt: string;
    };
  }>;
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}
