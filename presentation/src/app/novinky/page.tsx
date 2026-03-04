import { getAllNewsArticles } from '@/lib/strapi/data';
import { Breadcrumb, NewsCard } from '@/components/ui';
import Pagination from '@/components/ui/Pagination';
import { parsePageNumber } from '@/lib/pagination';

interface NovinkyPageProps {
  searchParams: Promise<{ stranka?: string }>;
}

const PAGE_SIZE = 12;

export default async function NovinkyPage({ searchParams }: NovinkyPageProps) {
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const currentPage = parsePageNumber(resolvedSearchParams.stranka);

  const { articles, total } = await getAllNewsArticles(currentPage, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-[112px]">
    <section className="pb-section">
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: 'Novinky', href: '/novinky' },
        ]} />

        <h1 className="text-section text-primary uppercase accent-underline mb-12">
          Novinky
        </h1>

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
                baseHref="/novinky"
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
