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

export type MatchResultCategory =
  | 'Muži A'
  | 'Muži B'
  | 'Dorost U16'
  | 'Dorost U17'
  | 'Dorost U18'
  | 'Dorost U19'
  | 'Žáci U12'
  | 'Žáci U13'
  | 'Žáci U14'
  | 'Žáci U15'
  | 'Přípravka U8'
  | 'Přípravka U9'
  | 'Přípravka U10'
  | 'Přípravka U11'
  | 'Školička'
  | 'Ženy A'
  | 'Žákyně Mladší'
  | 'Žákyně Starší'
  | 'Žákyně Přípravka';

export interface UserInfo {
  id: number;
  firstName: string;
  lastName: string;
}

export interface MatchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  images: StrapiImage[];
  files: StrapiFile[];
  category: MatchResultCategory;
  matchDate: string;
  imagesUrl?: string;
  authorId: number;
  author?: UserInfo;
  modifiedBy?: UserInfo;
  createdAt: string;
  updatedAt: string;
}

export interface MatchResultFormData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  category: MatchResultCategory;
  matchDate: string;
  imagesUrl?: string;
  images?: FileList;
  files?: FileList;
}

export interface CreateMatchResultRequest {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  category: MatchResultCategory;
  matchDate: string;
  imagesUrl?: string;
  author?: number;
}

export interface StrapiMatchResultResponse {
  data: {
    id: number;
    attributes: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      homeGoalscorers: string | null;
      awayGoalscorers: string | null;
      matchReport: string | null;
      category: MatchResultCategory;
      matchDate: string;
      imagesUrl: string | null;
      images: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      files: {
        data: Array<{
          id: number;
          attributes: StrapiFile;
        }>;
      };
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      lastModifiedBy?: {
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

export interface StrapiMatchResultsResponse {
  data: Array<{
    id: number;
    attributes: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      homeGoalscorers: string | null;
      awayGoalscorers: string | null;
      matchReport: string | null;
      category: MatchResultCategory;
      matchDate: string;
      imagesUrl: string | null;
      images: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      files: {
        data: Array<{
          id: number;
          attributes: StrapiFile;
        }>;
      };
      author: {
        data: {
          id: number;
          firstname?: string;
          lastname?: string;
        };
      };
      lastModifiedBy?: {
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
