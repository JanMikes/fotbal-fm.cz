import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleDetail } from '@/components/sections';
import { Breadcrumb } from '@/components/ui';
import { getNewsArticleBySlug, getSidebarArticles } from '@/lib/strapi/data';
import { toPublicUrl } from '@/lib/strapi/mappers/shared';

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsArticleBySlug(slug);

  if (!article) {
    return { title: 'Článek nenalezen | FK Frýdek-Místek' };
  }

  const description = article.description
    ? article.description.replace(/<[^>]*>/g, '').slice(0, 160)
    : undefined;

  return {
    title: `${article.title} | FK Frýdek-Místek`,
    description,
    openGraph: {
      title: article.title,
      description,
      images: article.mainPhoto ? [{ url: toPublicUrl(article.mainPhoto.url) }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getNewsArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const categorySlug = article.categories[0]?.slug ?? '';
  const sidebarArticles = await getSidebarArticles(article, categorySlug || undefined);

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-[126px]">
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: 'Novinky', href: '/novinky' },
          { label: article.title, href: `/novinky/clanek/${slug}` },
        ]} />
      </div>
      <ArticleDetail article={article} categorySlug={categorySlug} sidebarArticles={sidebarArticles} />
    </main>
  );
}
