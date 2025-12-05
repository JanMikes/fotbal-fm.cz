import { UserInfo } from './match-result';

export interface TournamentMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  tournamentId: number;
  authorId: number;
  author?: UserInfo;
  modifiedBy?: UserInfo;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentMatchFormData {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  tournament: number;
}

export interface CreateTournamentMatchRequest {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeGoalscorers?: string;
  awayGoalscorers?: string;
  tournament: number | string;
  author?: number;
}

export interface StrapiTournamentMatchResponse {
  data: {
    id: number;
    attributes: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      homeGoalscorers: string | null;
      awayGoalscorers: string | null;
      tournament: {
        data: {
          id: number;
        };
      };
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

export interface StrapiTournamentMatchesResponse {
  data: Array<{
    id: number;
    attributes: {
      homeTeam: string;
      awayTeam: string;
      homeScore: number;
      awayScore: number;
      homeGoalscorers: string | null;
      awayGoalscorers: string | null;
      tournament: {
        data: {
          id: number;
        };
      };
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
