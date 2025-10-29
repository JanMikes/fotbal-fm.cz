// Type definitions for Frýdek-Místek Football Website

export type Category = 'muzi' | 'dorostenci' | 'zaci' | 'pripravka';

export interface Match {
  id: string;
  date: string; // ISO 8601 format
  time: string; // HH:MM format
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  competition: string;
  round?: string;
  location?: string;
  isHome?: boolean; // true if Frýdek-Místek is home team
}

export interface MatchesData {
  lastMatch: Match | null;
  upcomingMatches: Match[];
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  photo?: string;
  dateOfBirth?: string;
  height?: number; // in cm
  weight?: number; // in kg
}

export interface Actuality {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string; // ISO 8601 format
  image?: string;
  category: Category;
  author?: string;
}

export interface TableRow {
  position: number;
  team: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  isHomeTeam?: boolean; // highlight Frýdek-Místek
}

export interface ResultsTable {
  competition: string;
  season: string;
  lastUpdated: string;
  rows: TableRow[];
}

export interface Partner {
  id: string;
  name: string;
  logo: string;
  website?: string;
  order: number;
}

export interface HeroSlide {
  id: string;
  type: 'match' | 'player' | 'news';
  title: string;
  subtitle?: string;
  image?: string;
  link?: string;
  data?: Match | Player | Actuality;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

export interface CategoryData {
  category: Category;
  matches: MatchesData;
  players: Player[];
  actualities: Actuality[];
  table: ResultsTable;
  partners: Partner[];
}

// Navigation types
export interface NavItem {
  label: string;
  href: string;
  category: Category;
}

// SEO Metadata types
export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string[];
  openGraph?: {
    title: string;
    description: string;
    image?: string;
    type: string;
  };
}
