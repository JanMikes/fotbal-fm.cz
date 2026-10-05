import type { Metadata } from 'next';
import { getAllNewsArticles, getNewsArticleTypes, getCategories } from '@/lib/strapi/data';
import { Breadcrumb, NewsCard } from '@/components/ui';
import NewsArticleTypeFilter from '@/components/ui/NewsArticleTypeFilter';
import Pagination from '@/components/ui/Pagination';
import { parsePageNumber } from '@/lib/pagination';
import { pickKnownSlugs } from '@/lib/query-params';
import { pageMetadata } from '@/lib/seo';

interface NovinkyPageProps {
  searchParams: Promise<{ stranka?: string | string[]; typ?: string | string[]; kategorie?: string | string[] }>;
}

const PAGE_SIZE = 12;

export const metadata: Metadata = pageMetadata({
  title: 'Novinky',
  description:
    'Všechny novinky FK Frýdek-Místek na jednom místě — reporty ze zápasů, rozhovory, ' +
    'informace o vstupenkách a permanentkách i dění v klubu. Filtrujte podle kategorie a typu.',
  path: '/novinky',
});

export default async function NovinkyPage({ searchParams }: NovinkyPageProps) {
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const currentPage = parsePageNumber(resolvedSearchParams.stranka);

  // `typ` / `kategorie` are reduced to existing types / categories before they reach the query.
  const [articleTypes, categories] = await Promise.all([getNewsArticleTypes(), getCategories()]);
  const typeSlugs = pickKnownSlugs(resolvedSearchParams.typ, articleTypes.map((t) => t.slug));
  const categorySlugs = pickKnownSlugs(resolvedSearchParams.kategorie, categories.map((c) => c.slug));

  const { articles, total } = await getAllNewsArticles(
    currentPage,
    PAGE_SIZE,
    typeSlugs.length > 0 ? typeSlugs : undefined,
    categorySlugs.length > 0 ? categorySlugs : undefined,
  );
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const paginationParams = new URLSearchParams();
  if (typeSlugs.length > 0) paginationParams.set('typ', typeSlugs.join(','));
  if (categorySlugs.length > 0) paginationParams.set('kategorie', categorySlugs.join(','));
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
