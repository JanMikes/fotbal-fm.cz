import { getNewsArticlesByCategory, getCategoryBySlug, getNewsArticleTypes } from '@/lib/strapi/data';
import { Breadcrumb, NewsCard } from '@/components/ui';
import NewsArticleTypeFilter from '@/components/ui/NewsArticleTypeFilter';
import Pagination from '@/components/ui/Pagination';
import { parsePageNumber } from '@/lib/pagination';

interface NovinkyPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ stranka?: string; typ?: string }>;
}

const PAGE_SIZE = 12;

export default async function NovinkyPage({ params, searchParams }: NovinkyPageProps) {
  const { category: categorySlug } = await params;
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const currentPage = parsePageNumber(resolvedSearchParams.stranka);
  const typeSlug = resolvedSearchParams.typ;

  const [{ articles, total }, category, articleTypes] = await Promise.all([
    getNewsArticlesByCategory(categorySlug, currentPage, PAGE_SIZE, typeSlug),
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
                baseHref={typeSlug ? `/kategorie/${categorySlug}/novinky?typ=${typeSlug}` : `/kategorie/${categorySlug}/novinky`}
                paramName="stranka"
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
