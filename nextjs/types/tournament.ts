import { StrapiImage, UserInfo, Match } from './match';
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
  dateFrom?: string;
  dateTo?: string;
  categories: Category[];
  photos: StrapiImage[];
  imagesUrl?: string;
  players?: TournamentPlayer[];
  matches?: Match[];
  authorId: number;
  author?: UserInfo;
  modifiedBy?: UserInfo;
  facrId?: string;
  code?: string;
  categoryLetter?: string;
  level?: number;
  group?: string;
  competitionType?: string;
  season?: number;
  organizingBody?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentFormData {
  name: string;
  description?: string;
  location?: string;
  dateFrom?: string;
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
  dateFrom?: string;
  dateTo?: string;
  categories: string[];
  imagesUrl?: string;
  players?: TournamentPlayer[];
  author?: number;
}
