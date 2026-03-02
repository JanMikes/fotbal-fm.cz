import { Hero, Matches, Statistics } from '@/components/sections';
import { NewsList, TeamSection } from '@/components/sections';
import {
  getCategories,
  getCategoryWithHeroBySlug,
  getLastResult,
  getMatchesByCategory,
  getNewsArticlesByCategory,
  getPlayersByCategory,
  getStandingsByCategory,
  getUpcomingMatch,
} from '@/lib/strapi/data';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ category: cat.slug }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;

  const [newsResult, players, matches, standings, categoryWithHero, upcomingMatch, lastResult] =
    await Promise.all([
      getNewsArticlesByCategory(categorySlug, 1, 6),
      getPlayersByCategory(categorySlug),
      getMatchesByCategory(categorySlug),
      getStandingsByCategory(categorySlug),
      getCategoryWithHeroBySlug(categorySlug),
      getUpcomingMatch(categorySlug),
      getLastResult(categorySlug),
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
      <Matches matches={matches} />
      <Statistics standings={standings} />
      <NewsList articles={newsResult.articles} categorySlug={categorySlug} />
      <TeamSection players={players} categorySlug={categorySlug} />
    </>
  );
}
