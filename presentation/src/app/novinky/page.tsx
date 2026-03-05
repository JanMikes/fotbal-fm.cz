import { getAllNewsArticles, getNewsArticleTypes, getCategories } from '@/lib/strapi/data';
import { Breadcrumb, NewsCard } from '@/components/ui';
import NewsArticleTypeFilter from '@/components/ui/NewsArticleTypeFilter';
import Pagination from '@/components/ui/Pagination';
import { parsePageNumber } from '@/lib/pagination';

interface NovinkyPageProps {
  searchParams: Promise<{ stranka?: string; typ?: string; kategorie?: string }>;
}

const PAGE_SIZE = 12;

export default async function NovinkyPage({ searchParams }: NovinkyPageProps) {
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const currentPage = parsePageNumber(resolvedSearchParams.stranka);
  const typeSlug = resolvedSearchParams.typ;
  const categorySlug = resolvedSearchParams.kategorie;

  const [{ articles, total }, articleTypes, categories] = await Promise.all([
    getAllNewsArticles(currentPage, PAGE_SIZE, typeSlug, categorySlug),
    getNewsArticleTypes(),
    getCategories(),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const paginationParams = new URLSearchParams();
  if (typeSlug) paginationParams.set('typ', typeSlug);
  if (categorySlug) paginationParams.set('kategorie', categorySlug);
  const paginationQs = paginationParams.toString();
  const baseHref = paginationQs ? `/novinky?${paginationQs}` : '/novinky';

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-[126px]">
    <section className="pb-section">
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: 'Novinky', href: '/novinky' },
        ]} />

        <h1 className="text-section text-primary uppercase accent-underline mb-12">
          Novinky
        </h1>

        <NewsArticleTypeFilter types={articleTypes} categories={categories} />

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
                  categorySlug={article.categories[0]?.slug ?? ''}
                  hrefPrefix="/novinky"
                />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                baseHref={baseHref}
                paramName="stranka"
              />
            )}
          </>
        )}
      </div>
    </section>
    </main>
  );
}
