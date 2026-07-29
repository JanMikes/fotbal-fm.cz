import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleDetail } from '@/components/sections';
import { Breadcrumb } from '@/components/ui';
import { getNewsArticleBySlug, getCategoryBySlug, getSidebarArticles } from '@/lib/strapi/data';
import { toPublicUrl } from '@/lib/strapi/mappers/shared';
import { pageMetadata, toDescription } from '@/lib/seo';

interface ArticlePageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { category: categorySlug, slug } = await params;
  const [article, category] = await Promise.all([
    getNewsArticleBySlug(slug),
    getCategoryBySlug(categorySlug),
  ]);
  const path = `/kategorie/${categorySlug}/clanek/${slug}`;

  if (!article) {
    return pageMetadata({
      title: 'Stránka nenalezena',
      description: 'Požadovaný článek neexistuje nebo byl přesunut.',
      path,
      noIndex: true,
    });
  }

  const categoryName = category?.name ?? categorySlug;

  return pageMetadata({
    title: article.title,
    description: toDescription(
      article.description,
      `${article.title} — novinky kategorie ${categoryName} FK Frýdek-Místek.`,
    ),
    path,
    image: article.mainPhoto ? toPublicUrl(article.mainPhoto.url) : null,
    type: 'article',
  });
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

  const sidebarArticles = await getSidebarArticles(article, categorySlug);

  return (
    <>
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: category?.name ?? categorySlug, href: `/kategorie/${categorySlug}` },
          { label: 'Novinky', href: `/kategorie/${categorySlug}/novinky` },
          { label: article.title, href: `/kategorie/${categorySlug}/clanek/${slug}` },
        ]} />
      </div>
      <ArticleDetail article={article} categorySlug={categorySlug} sidebarArticles={sidebarArticles} />
    </>
  );
}
