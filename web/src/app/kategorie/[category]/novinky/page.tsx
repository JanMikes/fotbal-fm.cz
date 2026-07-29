import type { Metadata } from 'next';
import { getNewsArticlesByCategory, getCategoryBySlug, getNewsArticleTypes } from '@/lib/strapi/data';
import { Breadcrumb, NewsCard } from '@/components/ui';
import NewsArticleTypeFilter from '@/components/ui/NewsArticleTypeFilter';
import Pagination from '@/components/ui/Pagination';
import { parsePageNumber } from '@/lib/pagination';
import { pageMetadata } from '@/lib/seo';

interface NovinkyPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ stranka?: string; typ?: string }>;
}

const PAGE_SIZE = 12;

export async function generateMetadata({ params }: NovinkyPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);
  const name = category?.name ?? categorySlug;

  return pageMetadata({
    title: `Novinky — ${name}`,
    description:
      `Aktuality kategorie ${name} FK Frýdek-Místek — reporty ze zápasů, rozhovory, ` +
      `pozvánky na utkání a dění kolem týmu.`,
    path: `/kategorie/${categorySlug}/novinky`,
  });
}

export default async function NovinkyPage({ params, searchParams }: NovinkyPageProps) {
  const { category: categorySlug } = await params;
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const currentPage = parsePageNumber(resolvedSearchParams.stranka);
  const typeSlugs = resolvedSearchParams.typ?.split(',').filter(Boolean) ?? [];

  const [{ articles, total }, category, articleTypes] = await Promise.all([
    getNewsArticlesByCategory(categorySlug, currentPage, PAGE_SIZE, typeSlugs.length > 0 ? typeSlugs : undefined),
    getCategoryBySlug(categorySlug),
    getNewsArticleTypes(),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section className="pb-section">
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: category?.name ?? categorySlug, href: `/kategorie/${categorySlug}` },
          { label: 'Novinky', href: `/kategorie/${categorySlug}/novinky` },
        ]} />

        <h1 className="text-section text-primary uppercase accent-underline mb-12">
          Novinky
        </h1>

        <NewsArticleTypeFilter types={articleTypes} />

        {articles.length === 0 ? (
          <p className="text-body-lg text-primary/60">
            Zatím zde nejsou žádné novinky.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles.map((article) => (
                <NewsCard
                  key={article.documentId}
                  article={article}
                  categorySlug={categorySlug}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                baseHref={typeSlugs.length > 0 ? `/kategorie/${categorySlug}/novinky?typ=${typeSlugs.join(',')}` : `/kategorie/${categorySlug}/novinky`}
                paramName="stranka"
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
