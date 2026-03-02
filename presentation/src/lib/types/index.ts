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

export interface Standing {
  position: number;
  teamName: string;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  tournamentName: string | null;
}

export interface CategoryHeroData {
  heroSlide1Image: MediaImage | null;
  heroSlide2Image: MediaImage | null;
  heroSlide3Image: MediaImage | null;
  heroSlide3NewsArticle: {
    title: string;
    slug: string;
    description: string | null;
    mainPhoto: MediaImage | null;
  } | null;
  heroSlide3Title: string | null;
  heroSlide3Text: string | null;
  heroSlide3Link: string | null;
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
  tournamentName: string | null;
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

// Navigation

export interface NavigationItem {
  title: string;
  href: string;
  external: boolean;
}

// Pages & Dynamic Zones

export interface Page {
  documentId: string;
  title: string;
  slug: string;
  metaDescription: string | null;
  content: DynamicZoneComponent[];
  sidebar: DynamicZoneComponent[];
}

export interface ResolvedLink {
  href: string;
  external: boolean;
}

export interface ResolvedTextLink extends ResolvedLink {
  text: string;
  disabled: boolean;
}

// Dynamic Zone Component Types

export interface DynamicZoneBase {
  id: number;
  __component: string;
}

export interface ComponentText extends DynamicZoneBase {
  __component: 'components.text';
  text: string | null;
}

export interface ComponentHeading extends DynamicZoneBase {
  __component: 'components.heading';
  text: string | null;
  type: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  anchor: string | null;
}

export interface ComponentAlert extends DynamicZoneBase {
  __component: 'components.alert';
  type: 'info' | 'success' | 'warning' | 'error';
  title: string | null;
  text: string | null;
}

export interface ComponentLinksList extends DynamicZoneBase {
  __component: 'components.links-list';
  links: ResolvedTextLink[];
  layout: 'Grid' | 'Rows';
}

export interface ComponentVideo extends DynamicZoneBase {
  __component: 'components.video';
  youtube_id: string | null;
  aspect_ratio: '16:9' | '4:3' | '1:1';
}

export interface ComponentFeatureCards extends DynamicZoneBase {
  __component: 'components.feature-cards';
  cards: { title: string | null; description: string | null; link: ResolvedTextLink | null }[];
  columns: '2' | '3' | '4';
  card_clickable: boolean;
}

export interface ComponentBannerCards extends DynamicZoneBase {
  __component: 'components.banner-cards';
  cards: { title: string | null; description: string | null; link: ResolvedTextLink | null }[];
}

export interface ComponentDocuments extends DynamicZoneBase {
  __component: 'components.documents';
  documents: { name: string | null; file: MediaImage | null }[];
  columns: '1' | '2' | '3';
}

export interface ComponentPartnerLogos extends DynamicZoneBase {
  __component: 'components.partner-logos';
  partners: { name: string | null; logo: MediaImage | null; url: string | null }[];
  grayscale: boolean;
  columns: '2' | '3' | '4' | '5' | '6';
}

export interface ComponentStatsHighlights extends DynamicZoneBase {
  __component: 'components.stats-highlights';
  items: { number: string | null; title: string | null; description: string | null }[];
  columns: '2' | '3' | '4';
}

export interface ComponentTimeline extends DynamicZoneBase {
  __component: 'components.timeline';
  items: { number: string | null; title: string | null; description: string | null }[];
}

export interface ComponentSectionDivider extends DynamicZoneBase {
  __component: 'components.section-divider';
  spacing: 'S' | 'M' | 'L';
  style: 'solid' | 'dashed' | 'dotted';
}

export interface ComponentSlider extends DynamicZoneBase {
  __component: 'components.slider';
  slides: {
    title: string | null;
    description: string | null;
    link: ResolvedTextLink | null;
    image: MediaImage | null;
    background_image: MediaImage | null;
  }[];
  autoplay: boolean;
  autoplay_interval: number;
}

export interface ComponentGallerySlider extends DynamicZoneBase {
  __component: 'components.gallery-slider';
  photos: { image: MediaImage | null }[];
}

export interface ComponentPhotoGallery extends DynamicZoneBase {
  __component: 'components.photo-gallery';
  photos: { image: MediaImage | null }[];
  columns: '2' | '3' | '4';
}

export interface ComponentButtonGroup extends DynamicZoneBase {
  __component: 'components.button-group';
  buttons: {
    link: ResolvedTextLink | null;
    variant: 'Primary' | 'Secondary' | 'Outline' | 'Ghost';
    size: 'S' | 'M' | 'L';
  }[];
  alignment: 'L' | 'C' | 'R';
}

export interface ComponentContactCards extends DynamicZoneBase {
  __component: 'components.contact-cards';
  cards: {
    name: string;
    role: string | null;
    phone: string | null;
    email: string | null;
    photo: MediaImage | null;
  }[];
}

export interface ComponentAccordionSections extends DynamicZoneBase {
  __component: 'components.accordion-sections';
  sections: {
    title: string | null;
    description: string | null;
    default_open: boolean;
    files: { name: string | null; file: MediaImage | null }[];
    photos: { image: MediaImage | null }[];
  }[];
}

export interface ComponentPopup extends DynamicZoneBase {
  __component: 'components.popup';
  title: string | null;
  description: string | null;
  link: ResolvedTextLink | null;
  rememberDismissal: boolean;
}

export interface ComponentBadges extends DynamicZoneBase {
  __component: 'components.badges';
  badges: {
    label: string;
    variant: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'error';
    size: 'S' | 'M' | 'L';
  }[];
  alignment: 'L' | 'C' | 'R';
}

export interface ComponentImage extends DynamicZoneBase {
  __component: 'components.image';
  image: MediaImage | null;
}

export interface ComponentNewsArticles extends DynamicZoneBase {
  __component: 'components.news-articles';
  categories: Category[];
  limit: number;
  show_all_link: ResolvedTextLink | null;
}

export type DynamicZoneComponent =
  | ComponentText
  | ComponentHeading
  | ComponentAlert
  | ComponentLinksList
  | ComponentVideo
  | ComponentFeatureCards
  | ComponentBannerCards
  | ComponentDocuments
  | ComponentPartnerLogos
  | ComponentStatsHighlights
  | ComponentTimeline
  | ComponentSectionDivider
  | ComponentSlider
  | ComponentGallerySlider
  | ComponentPhotoGallery
  | ComponentButtonGroup
  | ComponentContactCards
  | ComponentAccordionSections
  | ComponentPopup
  | ComponentBadges
  | ComponentImage
  | ComponentNewsArticles;
