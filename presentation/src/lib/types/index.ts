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
}
