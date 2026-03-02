import { Hero, Matches, Statistics } from '@/components/sections';
import { NewsList, TeamSection } from '@/components/sections';
import { getCategories, getMatchesByCategory, getNewsArticlesByCategory, getPlayersByCategory } from '@/lib/strapi/data';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ category: cat.slug }));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params;

  const [newsResult, players, matches] = await Promise.all([
    getNewsArticlesByCategory(categorySlug, 1, 6),
    getPlayersByCategory(categorySlug),
    getMatchesByCategory(categorySlug),
  ]);

  return (
    <>
      <Hero />
      <Matches matches={matches} />
      <Statistics />
      <NewsList articles={newsResult.articles} categorySlug={categorySlug} />
      <TeamSection players={players} categorySlug={categorySlug} />
    </>
  );
}
