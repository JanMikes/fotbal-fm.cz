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

export interface MatchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
  images: StrapiImage[];
  authorId: number;
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
  images?: FileList;
}

export interface CreateMatchResultRequest {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  matchReport?: string;
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
      images: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      author: {
        data: {
          id: number;
        };
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
      images: {
        data: Array<{
          id: number;
          attributes: StrapiImage;
        }>;
      };
      author: {
        data: {
          id: number;
        };
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
