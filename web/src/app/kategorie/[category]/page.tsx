import type { Metadata } from 'next';
import { Hero, Matches, Statistics, CategorySwitcher } from '@/components/sections';
import { NewsList, TeamSection } from '@/components/sections';
import { pageMetadata } from '@/lib/seo';
import {
  getAllMatchesByCategory,
  getCategoryBySlug,
  getCategoryGroupByCategorySlug,
  getCategoryWithHeroBySlug,
  getFinishedMatches,
  getLastResult,
  getNewsArticlesByCategory,
  getPlayerHighlightsByCategory,
  getPlayersByCategory,
  getStandingsByCategory,
  getUpcomingMatch,
  getUpcomingMatches,
} from '@/lib/strapi/data';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);
  const name = category?.name ?? categorySlug;

  return pageMetadata({
    title: name,
    description:
      `${name} FK Frýdek-Místek (Válcovny, Lipina) — soupiska hráčů a realizačního týmu, ` +
      `program zápasů, výsledky, tabulka soutěže a novinky kategorie.`,
    path: `/kategorie/${categorySlug}`,
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;

  const [newsResult, players, upcoming, finished, standings, categoryWithHero, upcomingMatch, lastResult, allMatches, categoryGroup, playerHighlights] =
    await Promise.all([
      getNewsArticlesByCategory(categorySlug, 1, 5),
      getPlayersByCategory(categorySlug),
      getUpcomingMatches(categorySlug),
      getFinishedMatches(categorySlug),
      getStandingsByCategory(categorySlug),
      getCategoryWithHeroBySlug(categorySlug),
      getUpcomingMatch(categorySlug),
      getLastResult(categorySlug),
      getAllMatchesByCategory(categorySlug),
      getCategoryGroupByCategorySlug(categorySlug),
      getPlayerHighlightsByCategory(categorySlug),
    ]);

  const defaultHero = {
    staticHeroSlideImage: null,
    heroSlide1Image: null,
    heroSlide2Image: null,
    heroSlide3Image: null,
    heroSlide3NewsArticle: null,
    heroSlide3Title: null,
    heroSlide3Text: null,
    heroSlide3Link: null,
  };

  const heroData = categoryWithHero?.hero ?? defaultHero;
  const showSwitcher = categoryGroup && categoryGroup.categories.length > 1;
  const switcherElement = showSwitcher ? <CategorySwitcher categories={categoryGroup.categories} /> : null;
  const heroHasSlides = !!(upcomingMatch || lastResult || heroData.heroSlide3NewsArticle || (heroData.heroSlide3Title && heroData.heroSlide3Text));

  return (
    <>
      <Hero
        upcomingMatch={upcomingMatch}
        lastResult={lastResult}
        heroData={heroData}
        categorySlug={categorySlug}
        categorySwitcher={heroHasSlides ? switcherElement : undefined}
      />
      {!heroHasSlides && switcherElement && (
        <div className="fixed bottom-[15px] right-[15px] z-50">
          {switcherElement}
        </div>
      )}
      <Matches upcomingMatches={upcoming} finishedMatches={finished} allMatches={allMatches} categorySlug={categorySlug} />
      <Statistics standings={standings} playerHighlights={playerHighlights} playerCount={players.filter(p => p.type === 'hráč' && p.isActive).length} />
      <NewsList articles={newsResult.articles} categorySlug={categorySlug} />
      <TeamSection players={players} categorySlug={categorySlug} categoryName={categoryWithHero?.category.name ?? categorySlug} />
    </>
  );
}
