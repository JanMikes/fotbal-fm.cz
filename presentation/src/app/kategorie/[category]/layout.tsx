import { notFound } from 'next/navigation';
import { getCategoryBySlug } from '@/lib/strapi/data';

interface CategoryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ category: string }>;
}

export default async function CategoryLayout({ children, params }: CategoryLayoutProps) {
  const { category: categorySlug } = await params;

  const currentCategory = await getCategoryBySlug(categorySlug);

  if (!currentCategory) {
    notFound();
  }

  return (
    <main className="bg-surface-light mt-28 lg:mt-32">
      {children}
    </main>
  );
}
