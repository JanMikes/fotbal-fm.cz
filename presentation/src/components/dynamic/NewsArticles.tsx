import Link from 'next/link';
import { getNewsArticlesByCategory } from '@/lib/strapi/data';
import { NewsCard } from '@/components/ui';
import type { ComponentNewsArticles } from '@/lib/types';

interface NewsArticlesProps {
  data: ComponentNewsArticles;
}

export async function NewsArticles({ data }: NewsArticlesProps) {
  const categorySlug = data.categories?.[0]?.slug;
  const { articles } = await getNewsArticlesByCategory(
    categorySlug,
    1,
    data.limit || 6,
    data.newsArticleType?.slug,
  );

  if (articles.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <NewsCard
            key={article.documentId}
            article={article}
            categorySlug={categorySlug || article.categories?.[0]?.slug || ''}
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
