// Types
export interface Team {
  name: string;
  logo?: string;
}

export interface Match {
  id: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore?: number;
  awayScore?: number;
  date: string;
  time: string;
  venue: string;
  round: number;
  status: 'upcoming' | 'live' | 'finished';
  competition: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content?: string;
  image: string;
  category: string;
  date: string;
  dateISO: string;
  readTime: number;
  author?: string;
}

export interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  image: string;
  nationality?: string;
  birthDate?: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
  };
}

export interface Staff {
  id: string;
  name: string;
  role: string;
  image: string;
  socialLinks?: {
    instagram?: string;
    twitter?: string;
  };
}

export interface HeroSlide {
  id: string;
  type: 'match' | 'news' | 'promo';
  image: string;
  title: string;
  subtitle?: string;
  description?: string;
  match?: Match;
  ctaText?: string;
  ctaLink?: string;
}

// Mock Data
export const matches: Match[] = [
  {
    id: '1',
    homeTeam: { name: 'FK Frýdek-Místek' },
    awayTeam: { name: 'FC Baník Ostrava B' },
    date: 'So 25. 1.',
    time: '15:00',
    venue: 'Městský stadion',
    round: 16,
    status: 'upcoming',
    competition: 'MSFL',
  },
  {
    id: '2',
    homeTeam: { name: 'SK Sigma Olomouc B' },
    awayTeam: { name: 'FK Frýdek-Místek' },
    date: 'So 1. 2.',
    time: '10:30',
    venue: 'Andrův stadion',
    round: 17,
    status: 'upcoming',
    competition: 'MSFL',
  },
  {
    id: '3',
    homeTeam: { name: 'FK Frýdek-Místek' },
    awayTeam: { name: 'MFK Vítkovice' },
    homeScore: 3,
    awayScore: 1,
    date: 'So 18. 1.',
    time: '15:00',
    venue: 'Městský stadion',
    round: 15,
    status: 'finished',
    competition: 'MSFL',
  },
  {
    id: '4',
    homeTeam: { name: 'SFC Opava' },
    awayTeam: { name: 'FK Frýdek-Místek' },
    homeScore: 2,
    awayScore: 2,
    date: 'So 11. 1.',
    time: '14:00',
    venue: 'Městský stadion Opava',
    round: 14,
    status: 'finished',
    competition: 'MSFL',
  },
  {
    id: '5',
    homeTeam: { name: 'FK Frýdek-Místek' },
    awayTeam: { name: 'FC Hlučín' },
    homeScore: 2,
    awayScore: 0,
    date: 'Ne 5. 1.',
    time: '15:00',
    venue: 'Městský stadion',
    round: 13,
    status: 'finished',
    competition: 'MSFL',
  },
];

export const news: NewsArticle[] = [
  {
    id: '1',
    title: 'Přestup roku: Jan Novák podepsal novou smlouvu s klubem do roku 2028',
    excerpt: 'Útočník Jan Novák prodloužil svou smlouvu s FK Frýdek-Místek o další tři roky. Jedná se o klíčového hráče, který v minulé sezóně vstřelil 15 branek.',
    image: '/news/news-1.jpg',
    category: 'Přestup',
    date: '24. ledna 2026',
    dateISO: '2026-01-24',
    readTime: 3,
  },
  {
    id: '2',
    title: 'Vítězství nad Vítkovicemi posunulo tým na třetí místo tabulky',
    excerpt: 'Sobotní výhra 3:1 nad MFK Vítkovice znamená třetí příčku v tabulce MSFL. Dva góly vstřelil Jan Novák, jeden přidal kapitán Petr Svoboda.',
    image: '/news/news-2.jpg',
    category: 'Zápas',
    date: '19. ledna 2026',
    dateISO: '2026-01-19',
    readTime: 4,
  },
  {
    id: '3',
    title: 'Zimní příprava: Soustředění v Turecku potvrzeno',
    excerpt: 'Tým absolvuje zimní soustředění v tureckém Beleku. Program zahrnuje čtyři přípravné zápasy a intenzivní tréninky.',
    image: '/news/news-3.jpg',
    category: 'Příprava',
    date: '15. ledna 2026',
    dateISO: '2026-01-15',
    readTime: 2,
  },
  {
    id: '4',
    title: 'Mládežnická akademie získala certifikaci UEFA',
    excerpt: 'Naše mládežnická akademie úspěšně prošla certifikací UEFA a stává se jednou z nejlépe hodnocených akademií v regionu.',
    image: '/news/news-4.jpg',
    category: 'Akademie',
    date: '12. ledna 2026',
    dateISO: '2026-01-12',
    readTime: 5,
  },
  {
    id: '5',
    title: 'Nový merchandising: Kolekce jaro/léto 2026',
    excerpt: 'Představujeme novou kolekci klubového oblečení. V nabídce najdete dresy, mikiny, čepice a další doplňky v klubových barvách.',
    image: '/news/news-5.jpg',
    category: 'Fanshop',
    date: '10. ledna 2026',
    dateISO: '2026-01-10',
    readTime: 2,
  },
  {
    id: '6',
    title: 'Rozhovor: Trenér Kowalski o cílech pro jarní část',
    excerpt: 'Hlavní trenér Marek Kowalski v exkluzivním rozhovoru prozrazuje plány na jarní část sezóny a hovoří o posílení kádru.',
    image: '/news/news-6.jpg',
    category: 'Rozhovor',
    date: '8. ledna 2026',
    dateISO: '2026-01-08',
    readTime: 6,
  },
];

// Athletic male portraits for players
export const players: Player[] = [
  {
    id: '1',
    name: 'Tomáš Procházka',
    number: 1,
    position: 'Brankář',
    image: '/players/player-1.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#' },
  },
  {
    id: '2',
    name: 'Martin Veselý',
    number: 2,
    position: 'Obránce',
    image: '/players/player-2.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#', twitter: '#' },
  },
  {
    id: '3',
    name: 'Lukáš Horák',
    number: 4,
    position: 'Obránce',
    image: '/players/player-3.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#' },
  },
  {
    id: '4',
    name: 'Pavel Němec',
    number: 5,
    position: 'Obránce',
    image: '/players/player-4.jpg',
    nationality: 'CZ',
  },
  {
    id: '5',
    name: 'Jakub Krejčí',
    number: 6,
    position: 'Záložník',
    image: '/players/player-5.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#', twitter: '#' },
  },
  {
    id: '6',
    name: 'Ondřej Marek',
    number: 8,
    position: 'Záložník',
    image: '/players/player-6.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#' },
  },
  {
    id: '7',
    name: 'Jan Novák',
    number: 10,
    position: 'Útočník',
    image: '/players/player-7.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#', twitter: '#' },
  },
  {
    id: '8',
    name: 'Petr Svoboda',
    number: 11,
    position: 'Útočník',
    image: '/players/player-8.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#' },
  },
  {
    id: '9',
    name: 'Adam Fiala',
    number: 14,
    position: 'Záložník',
    image: '/players/player-9.jpg',
    nationality: 'CZ',
  },
  {
    id: '10',
    name: 'Filip Bureš',
    number: 17,
    position: 'Záložník',
    image: '/players/player-10.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#' },
  },
  {
    id: '11',
    name: 'Vojtěch Urban',
    number: 19,
    position: 'Obránce',
    image: '/players/player-11.jpg',
    nationality: 'CZ',
  },
  {
    id: '12',
    name: 'Daniel Růžička',
    number: 21,
    position: 'Brankář',
    image: '/players/player-12.jpg',
    nationality: 'CZ',
  },
  {
    id: '13',
    name: 'Marek Polák',
    number: 23,
    position: 'Útočník',
    image: '/players/player-13.jpg',
    nationality: 'CZ',
    socialLinks: { instagram: '#' },
  },
  {
    id: '14',
    name: 'Štěpán Vlček',
    number: 7,
    position: 'Záložník',
    image: '/players/player-14.jpg',
    nationality: 'SK',
    socialLinks: { instagram: '#', twitter: '#' },
  },
  {
    id: '15',
    name: 'Radek Šimek',
    number: 3,
    position: 'Obránce',
    image: '/players/player-15.jpg',
    nationality: 'CZ',
  },
];

export const staff: Staff[] = [
  {
    id: '1',
    name: 'Marek Kowalski',
    role: 'Hlavní trenér',
    image: '/staff/staff-1.jpg',
  },
  {
    id: '2',
    name: 'Josef Novotný',
    role: 'Asistent trenéra',
    image: '/staff/staff-2.jpg',
  },
  {
    id: '3',
    name: 'Petr Dvořák',
    role: 'Trenér brankářů',
    image: '/staff/staff-3.jpg',
  },
  {
    id: '4',
    name: 'MUDr. Jan Malý',
    role: 'Týmový lékař',
    image: '/staff/staff-4.jpg',
  },
  {
    id: '5',
    name: 'Tomáš Konečný',
    role: 'Fyzioterapeut',
    image: '/staff/staff-5.jpg',
  },
];

export const heroSlides: HeroSlide[] = [
  {
    id: '1',
    type: 'match',
    image: '/hero/hero-1.jpg',
    title: 'Další domácí zápas',
    subtitle: 'MSFL • 16. kolo',
    match: matches[0],
    ctaText: 'Koupit vstupenky',
    ctaLink: '/vstupenky',
  },
  {
    id: '2',
    type: 'news',
    image: '/hero/hero-2.jpg',
    title: 'Jan Novák prodloužil smlouvu',
    subtitle: 'Klíčový útočník zůstává do roku 2028',
    ctaText: 'Číst více',
    ctaLink: '/novinky/1',
  },
  {
    id: '3',
    type: 'promo',
    image: '/hero/hero-3.jpg',
    title: 'Staň se členem fanklubu',
    subtitle: 'Získej exkluzivní výhody a slevy',
    description: 'Přidej se k naší fotbalové rodině a podpoř svůj tým.',
    ctaText: 'Registrovat se',
    ctaLink: '/fanklub',
  },
  {
    id: '4',
    type: 'news',
    image: '/hero/hero-4.jpg',
    title: 'Vítězství 3:1 nad Vítkovicemi',
    subtitle: 'Posun na třetí místo tabulky',
    ctaText: 'Záznam zápasu',
    ctaLink: '/zapasy/3',
  },
];

export const sponsors = [
  { name: 'Generální partner', logo: '/sponsors/partner1.svg' },
  { name: 'Hlavní partner', logo: '/sponsors/partner2.svg' },
  { name: 'Partner', logo: '/sponsors/partner3.svg' },
  { name: 'Partner', logo: '/sponsors/partner4.svg' },
];
