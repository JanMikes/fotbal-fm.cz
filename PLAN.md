# Frýdek-Místek Football Website (fotbal-fm.cz)

## Project Overview
Modern, responsive website for Frýdek-Místek football club with multiple team categories, built with the latest web technologies.

## Tech Stack
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **CMS**: Prepared for Strapi integration
- **SEO**: Server-side rendering (SSR)

## Brand & Colors
- **Team Name**: Frýdek-Místek
- **Domain**: fotbal-fm.cz
- **Language**: Czech
- **Primary Color**: #031b44 (deep blue)
- **Secondary Color**: #0099d4 (bright blue)
- **Accent Color**: #ffffff (white)

## Navigation Structure
- **Muži** (Men's team)
- **Dorostenci** (Youth team)
- **Žáci** (Junior team)
- **Přípravka** (Mini team)
- **Social Links**: Instagram, Facebook

## Page Structure
All category pages share the same structure with different data:

### 1. Hero Section
- Interactive slider with multiple slides
- Next match information
- Player highlights
- Smooth transitions and animations

### 2. Matches Section
- Last match result (score, teams, date)
- Upcoming matches list
- Date, time, teams (with logo placeholders)
- Round/competition information

### 3. Soupiska hráčů (Player Cards)
- Grid layout of player cards
- Player photo, name, number, position
- Hover effects and animations
- Responsive grid (mobile to desktop)

### 4. Results Table
- Competition standings
- Position, team name, matches played
- Points, goals for/against
- Highlight home team row

### 5. Actualities (News Section)
- News cards with image, title, excerpt
- Publication date
- Link to actuality detail page
- Latest news first

### 6. Partners Section
- Grid of partner logos
- Clean, minimal design
- Responsive logo sizing

## Footer
**Contact Information**:
- Address: Horní 3276, 738 01 Frýdek-Míste, Česko
- Phone: +420 608 713 021
- Email: radomir.myska@seznam.cz

## Project Structure
```
mfkfm/
├── app/
│   ├── layout.tsx                      # Root layout with nav & footer
│   ├── page.tsx                        # Home page (redirects to /muzi)
│   ├── globals.css                     # Global styles
│   ├── muzi/
│   │   └── page.tsx                    # Men's team page
│   ├── dorostenci/
│   │   └── page.tsx                    # Youth team page
│   ├── zaci/
│   │   └── page.tsx                    # Junior team page
│   ├── pripravka/
│   │   └── page.tsx                    # Mini team page
│   └── [category]/
│       └── aktuality/
│           └── [id]/
│               └── page.tsx            # Actuality detail page
├── components/
│   ├── layout/
│   │   ├── Header.tsx                  # Site header
│   │   ├── Navigation.tsx              # Main navigation
│   │   └── Footer.tsx                  # Site footer
│   ├── sections/
│   │   ├── HeroSlider.tsx              # Hero section with slider
│   │   ├── MatchesSection.tsx          # Matches display
│   │   ├── PlayersGrid.tsx             # Player cards grid
│   │   ├── ResultsTable.tsx            # Competition table
│   │   ├── ActualitiesSection.tsx      # News section
│   │   └── PartnersSection.tsx         # Partners logos
│   └── ui/
│       ├── MatchCard.tsx               # Single match card
│       ├── PlayerCard.tsx              # Single player card
│       └── ActualityCard.tsx           # Single news card
├── data/
│   ├── muzi/
│   │   ├── matches.json                # Matches data
│   │   ├── actualities.json            # News data
│   │   └── players.json                # Players data
│   ├── dorostenci/
│   │   ├── matches.json
│   │   ├── actualities.json
│   │   └── players.json
│   ├── zaci/
│   │   ├── matches.json
│   │   ├── actualities.json
│   │   └── players.json
│   └── pripravka/
│       ├── matches.json
│       ├── actualities.json
│       └── players.json
├── types/
│   └── index.ts                        # TypeScript interfaces
├── lib/
│   └── data.ts                         # Data fetching functions (Strapi-ready)
└── public/
    └── images/
        ├── placeholders/                # Team logo placeholders
        └── partners/                    # Partner logos
```

## Data Structures

### Match Interface
```typescript
interface Match {
  id: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  competition: string;
  round?: string;
  location?: string;
}
```

### Player Interface
```typescript
interface Player {
  id: string;
  name: string;
  number: number;
  position: string;
  photo?: string;
}
```

### Actuality Interface
```typescript
interface Actuality {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  image?: string;
  category: string;
}
```

## Data Architecture (Strapi-Ready)
Currently using static JSON files in `/data` directory. Structure is designed for easy migration to Strapi CMS:
- Each category has separate data files
- Data fetching abstracted in `/lib/data.ts`
- Server Components fetch data at build/request time
- Easy to swap JSON imports for Strapi API calls

## Design Features

### Responsive Design
- **Mobile-first approach**
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Fluid typography and spacing
- Touch-friendly interactive elements
- Optimized images for all screen sizes

### Animations & Interactions
- Smooth page transitions
- Scroll-triggered animations (fade-in, slide-up)
- Hover effects on cards and buttons
- Interactive hero slider
- Loading states for data fetching

### Visual Design
- Modern, clean aesthetic
- Team color scheme throughout
- Glass morphism effects for depth
- Gradient backgrounds
- Proper contrast for readability
- Consistent spacing and rhythm

### Typography
- Primary font: Inter or Poppins
- Clear hierarchy (h1, h2, h3, body)
- Responsive font sizes
- Proper line heights and letter spacing

## SEO Optimization

### Meta Tags
- Dynamic page titles per category
- Meta descriptions
- Open Graph tags for social sharing
- Twitter Card tags
- Canonical URLs

### Structured Data (Schema.org)
- SportsTeam schema
- SportsEvent schema for matches
- Organization schema
- BreadcrumbList navigation

### Performance
- Server-side rendering (SSR)
- Image optimization (Next.js Image component)
- Code splitting
- Lazy loading
- Lighthouse score target: 90+

## Development Workflow

### Phase 1: Setup & Structure ✅
- Initialize Next.js project
- Configure Tailwind CSS
- Install dependencies
- Create project structure

### Phase 2: Layout & Navigation
- Build Header component
- Build Navigation component
- Build Footer component
- Make responsive

### Phase 3: Core Components
- Hero Slider
- Match Cards
- Player Cards
- Results Table
- Actuality Cards
- Partners Section

### Phase 4: Pages
- Category pages (muzi, dorostenci, zaci, pripravka)
- Actuality detail page
- 404 page

### Phase 5: Data
- Create JSON data files for all categories
- Implement data fetching functions
- Test with realistic data

### Phase 6: Polish
- Add animations
- Optimize performance
- Test responsiveness
- SEO implementation
- Accessibility audit

## Future Enhancements
- Strapi CMS integration
- Live match scores
- Player statistics
- Photo gallery
- Video highlights
- Fan zone / comments
- Newsletter subscription
- Match ticket booking

## Browser Support
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android)

## Deployment
- Platform: Vercel (recommended) or Netlify
- CI/CD: Automatic deployments from Git
- Environment: Production, Staging
- Custom domain: fotbal-fm.cz

---

**Project Start Date**: October 29, 2025
**Team**: Frýdek-Místek Football Club
**Built with**: Next.js, TypeScript, Tailwind CSS
