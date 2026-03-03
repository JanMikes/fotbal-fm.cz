import { Hero, Matches, Statistics } from '@/components/sections';
import { NewsList, TeamSection } from '@/components/sections';
import {
  getAllMatchesByCategory,
  getCategoryWithHeroBySlug,
  getFinishedMatches,
  getLastResult,
  getNewsArticlesByCategory,
  getPlayersByCategory,
  getStandingsByCategory,
  getUpcomingMatch,
  getUpcomingMatches,
} from '@/lib/strapi/data';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;

  const [newsResult, players, upcoming, finished, standings, categoryWithHero, upcomingMatch, lastResult, allMatches] =
    await Promise.all([
      getNewsArticlesByCategory(categorySlug, 1, 6),
      getPlayersByCategory(categorySlug),
      getUpcomingMatches(categorySlug),
      getFinishedMatches(categorySlug),
      getStandingsByCategory(categorySlug),
      getCategoryWithHeroBySlug(categorySlug),
      getUpcomingMatch(categorySlug),
      getLastResult(categorySlug),
      getAllMatchesByCategory(categorySlug),
    ]);

  const defaultHero = {
    heroSlide1Image: null,
    heroSlide2Image: null,
    heroSlide3Image: null,
    heroSlide3NewsArticle: null,
    heroSlide3Title: null,
    heroSlide3Text: null,
    heroSlide3Link: null,
  };

  return (
    <>
      <Hero
        upcomingMatch={upcomingMatch}
        lastResult={lastResult}
        heroData={categoryWithHero?.hero ?? defaultHero}
        categorySlug={categorySlug}
      />
      <Matches upcomingMatches={upcoming} finishedMatches={finished} allMatches={allMatches} categorySlug={categorySlug} />
      <Statistics standings={standings} />
      <NewsList articles={newsResult.articles} categorySlug={categorySlug} />
      <TeamSection players={players} categorySlug={categorySlug} />
    </>
  );
}
