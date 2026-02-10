import { notFound } from 'next/navigation';
import { Header } from '@/components/layout';
import { getCategories, getCategoryBySlug } from '@/lib/strapi/data';

interface CategoryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ category: string }>;
}

export default async function CategoryLayout({ children, params }: CategoryLayoutProps) {
  const { category: categorySlug } = await params;

  const [categories, currentCategory] = await Promise.all([
    getCategories(),
    getCategoryBySlug(categorySlug),
  ]);

  if (!currentCategory) {
    notFound();
  }

  return (
    <>
      <Header categories={categories} activeCategorySlug={categorySlug} />
      <main className="bg-surface-light mt-28 lg:mt-32">
        {children}
      </main>
    </>
  );
}
