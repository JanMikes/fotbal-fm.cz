import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleDetail } from '@/components/sections';
import { getNewsArticleBySlug } from '@/lib/strapi/data';

interface ArticlePageProps {
  params: Promise<{ category: string; slug: string }>;
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
      images: article.mainPhoto ? [{ url: article.mainPhoto.url }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { category: categorySlug, slug } = await params;
  const article = await getNewsArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return <ArticleDetail article={article} categorySlug={categorySlug} />;
}
