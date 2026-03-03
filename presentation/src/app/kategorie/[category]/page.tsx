import { Hero, Matches, Statistics, CategorySwitcher } from '@/components/sections';
import { NewsList, TeamSection } from '@/components/sections';
import {
  getAllMatchesByCategory,
  getCategoryGroupByCategorySlug,
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

  const [newsResult, players, upcoming, finished, standings, categoryWithHero, upcomingMatch, lastResult, allMatches, categoryGroup] =
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
      getCategoryGroupByCategorySlug(categorySlug),
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
        <div className="flex justify-center py-4 mt-28 lg:mt-32">
          {switcherElement}
        </div>
      )}
      <Matches upcomingMatches={upcoming} finishedMatches={finished} allMatches={allMatches} categorySlug={categorySlug} />
      <Statistics standings={standings} />
      <NewsList articles={newsResult.articles} categorySlug={categorySlug} />
      <TeamSection players={players} categorySlug={categorySlug} />
    </>
  );
}
