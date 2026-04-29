import Link from 'next/link';
import { getAllNewsArticles } from '@/lib/strapi/data';
import { NewsCard } from '@/components/ui';
import type { ComponentNewsArticles } from '@/lib/types';

interface NewsArticlesProps {
  data: ComponentNewsArticles;
  sidebar?: boolean;
}

export async function NewsArticles({ data, sidebar }: NewsArticlesProps) {
  const categorySlugs = data.categories?.map((c) => c.slug).filter(Boolean) ?? [];
  const linkCategorySlug = categorySlugs[0];
  const { articles } = await getAllNewsArticles(
    1,
    data.limit || 6,
    data.newsArticleType?.slug,
    categorySlugs.length > 0 ? categorySlugs : undefined,
  );

  if (articles.length === 0) return null;

  return (
    <div>
      <div className={sidebar ? 'space-y-6' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'}>
        {articles.map((article) => (
          <NewsCard
            key={article.documentId}
            article={article}
            categorySlug={linkCategorySlug || article.categories?.[0]?.slug || ''}
          />
        ))}
      </div>
      {data.show_all_link && (
        <div className="mt-6 text-center">
          <Link
            href={data.show_all_link.href}
            className="inline-block px-6 py-2 bg-accent text-white font-medium rounded hover:bg-accent/90 transition-colors"
            {...(data.show_all_link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {data.show_all_link.text || 'Všechny novinky'}
          </Link>
        </div>
      )}
    </div>
  );
}
