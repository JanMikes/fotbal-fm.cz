import { Category } from './category';

export interface StrapiImage {
  id: number;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  width: number;
  height: number;
  formats: {
    thumbnail?: {
      url: string;
      width: number;
      height: number;
    };
    small?: {
      url: string;
      width: number;
      height: number;
    };
    medium?: {
      url: string;
      width: number;
      height: number;
    };
    large?: {
      url: string;
      width: number;
      height: number;
    };
  };
  url: string;
  previewUrl: string | null;
  provider: string;
  size: number;
  ext: string;
  mime: string;
  createdAt: string;
  updatedAt: string;
}

export interface StrapiFile {
  id: number;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  url: string;
  previewUrl: string | null;
  provider: string;
  size: number;
  ext: string;
  mime: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserInfo {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface TeamLogoInfo {
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo: TeamLogoInfo | null;
  awayTeamLogo: TeamLogoInfo | null;
  homeScore: number | null;
  awayScore: number | null;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  images: StrapiImage[];
  files: StrapiFile[];
  categories: Category[];
  matchDate: string;
  imagesUrl?: string;
  authorId: number;
  author?: UserInfo;
  modifiedBy?: UserInfo;
  facrId?: string;
  round?: number;
  venue?: string;
  matchTime?: string;
  competitionName?: string;
  competitionCode?: string;
  season?: number;
  period?: string;
  organizingBody?: string;
  tournamentId?: string;
  tournamentName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchFormData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  categoryIds: string[];
  matchDate: string;
  imagesUrl?: string;
  images?: FileList;
  files?: FileList;
  tournament?: string;
}

export interface CreateMatchRequest {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  categories: string[];
  matchDate: string;
  imagesUrl?: string;
  tournament?: string;
  author?: number;
}
