import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getNewsArticlesByCategory } from '@/lib/strapi/data';
import { NewsCard } from '@/components/ui';
import Pagination from '@/components/ui/Pagination';
import { parsePageNumber } from '@/lib/pagination';

interface NovinkyPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ stranka?: string }>;
}

const PAGE_SIZE = 12;

export default async function NovinkyPage({ params, searchParams }: NovinkyPageProps) {
  const { category: categorySlug } = await params;
  const resolvedSearchParams = await (searchParams ?? Promise.resolve({}));
  const currentPage = parsePageNumber(resolvedSearchParams.stranka);

  const { articles, total } = await getNewsArticlesByCategory(categorySlug, currentPage, PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <section className="py-section">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Back link */}
        <Link
          href={`/kategorie/${categorySlug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary/60 hover:text-accent transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpět na kategorii
        </Link>

        {/* Header */}
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
                  categorySlug={categorySlug}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                baseHref={`/kategorie/${categorySlug}/novinky`}
                paramName="stranka"
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
