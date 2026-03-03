import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleDetail } from '@/components/sections';
import { Breadcrumb } from '@/components/ui';
import { getNewsArticleBySlug, getCategoryBySlug } from '@/lib/strapi/data';

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
  const [article, category] = await Promise.all([
    getNewsArticleBySlug(slug),
    getCategoryBySlug(categorySlug),
  ]);

  if (!article) {
    notFound();
  }

  return (
    <>
      <div className="container mx-auto px-4 lg:px-8 pt-6">
        <Breadcrumb items={[
          { label: category?.name ?? categorySlug, href: `/kategorie/${categorySlug}` },
          { label: 'Novinky', href: `/kategorie/${categorySlug}/novinky` },
          { label: article.title, href: `/kategorie/${categorySlug}/clanek/${slug}` },
        ]} />
      </div>
      <ArticleDetail article={article} categorySlug={categorySlug} />
    </>
  );
}
