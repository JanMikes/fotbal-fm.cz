import { StrapiImage, UserInfo } from './match-result';
import { TournamentMatch } from './tournament-match';

export type TournamentCategory = 'Žáci' | 'Dorost';

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  location?: string;
  dateFrom: string;
  dateTo?: string;
  category: TournamentCategory;
  photos: StrapiImage[];
  imagesUrl?: string;
  matches?: TournamentMatch[];
  authorId: number;
  author?: UserInfo;
  updatedBy?: UserInfo;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentFormData {
  name: string;
  description?: string;
  location?: string;
  dateFrom: string;
  dateTo?: string;
  category: TournamentCategory;
  photos?: FileList;
  imagesUrl?: string;
}

export interface CreateTournamentRequest {
  name: string;
  description?: string;
  location?: string;
  dateFrom: string;
  dateTo?: string;
  category: TournamentCategory;
  imagesUrl?: string;
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
      category: TournamentCategory;
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
      updatedBy?: {
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
      category: TournamentCategory;
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
      updatedBy?: {
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
