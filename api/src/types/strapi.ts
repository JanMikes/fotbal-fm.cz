import type { StrapiRawMedia, StrapiRawCategory } from '@fotbal-fm/strapi-client';

export interface StrapiRawTeam {
  id: number;
  documentId: string;
  name: string;
  logo: StrapiRawMedia | null;
}

export interface StrapiRawTournament {
  id: number;
  documentId: string;
  name: string;
}

export interface StrapiRawEvent {
  id: number;
  documentId: string;
  name: string;
  eventType: 'nadcházející' | 'proběhlá';
  dateFrom: string;
  dateTo: string | null;
  eventTime: string | null;
  eventTimeTo: string | null;
  description: string | null;
  photos: StrapiRawMedia[] | null;
  categories: StrapiRawCategory[] | null;
}

export interface StrapiRawMatch {
  id: number;
  documentId: string;
  homeTeam: StrapiRawTeam | null;
  awayTeam: StrapiRawTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  matchTime: string | null;
  venue: string | null;
  round: number | null;
  competitionName: string | null;
  tournament: StrapiRawTournament | null;
  categories: StrapiRawCategory[] | null;
}

export interface StrapiRawStanding {
  id: number;
  documentId: string;
  position: number;
  team: StrapiRawTeam | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  tournament: StrapiRawTournament | null;
  categories: StrapiRawCategory[] | null;
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
  date: string;
  description: string | null;
  video: string | null;
  mainPhoto: StrapiRawMedia | null;
  gallery: StrapiRawMedia[] | null;
  categories: StrapiRawCategory[] | null;
  newsArticleTypes: StrapiRawNewsArticleType[] | null;
  relatedNews: StrapiRawNewsArticle[] | null;
  createdAt: string;
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
  dateOfBirth: string | null;
  nationality: string | null;
  isActive: boolean | null;
  categories: StrapiRawCategory[] | null;
}

export interface StrapiRawDynamicZoneComponent {
  id: number;
  __component: string;
  [key: string]: unknown;
}

export interface StrapiRawPartnerCategory {
  id: number;
  documentId: string;
  name: string;
  sortOrder: number;
}

export interface StrapiRawPartner {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  logo: StrapiRawMedia | null;
  description: string | null;
  sortOrder: number;
  show_on_web: boolean;
  show_on_api: boolean;
  partnerCategory: StrapiRawPartnerCategory | null;
  content: StrapiRawDynamicZoneComponent[];
  panel: StrapiRawDynamicZoneComponent[] | null;
}
