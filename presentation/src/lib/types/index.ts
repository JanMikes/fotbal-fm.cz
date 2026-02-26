export interface MediaImage {
  url: string;
  alternativeText: string | null;
  width: number;
  height: number;
}

export interface Category {
  documentId: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface NewsArticleType {
  documentId: string;
  name: string;
  slug: string;
}

export interface NewsArticleSummary {
  documentId: string;
  title: string;
  slug: string;
  description: string | null;
  mainPhoto: MediaImage | null;
  categories: Category[];
  newsArticleType: NewsArticleType | null;
  createdAt: string;
}

export interface NewsArticle extends NewsArticleSummary {
  video: string | null;
  gallery: MediaImage[];
  relatedNews: NewsArticleSummary[];
}

export interface Match {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  matchDate: string;
  matchTime: string;
  venue: string;
  round: number | null;
  competitionName: string;
  status: 'upcoming' | 'finished';
}

export interface Player {
  documentId: string;
  name: string;
  slug: string;
  type: 'hráč' | 'realizační tým';
  number: number | null;
  sortOrder: number;
  position: 'brankář' | 'obránce' | 'záložník' | 'útočník' | null;
  positionText: string | null;
  bio: string | null;
  photo: MediaImage | null;
  instagram: string | null;
  twitter: string | null;
  facebook: string | null;
  categories: Category[];
  facrId: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  isActive: boolean;
}
