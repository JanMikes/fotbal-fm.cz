import { notFound } from 'next/navigation';
import { getCategoryBySlug } from '@/lib/strapi/data';
import { isKnownCategorySlug } from '@/lib/route-guards';

interface CategoryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ category: string }>;
}

export default async function CategoryLayout({ children, params }: CategoryLayoutProps) {
  const { category: categorySlug } = await params;

  // Unknown slugs 404 from the cached category index, without a per-slug Strapi query.
  // The pages below check it too: Next renders the layout and the page concurrently.
  if (!(await isKnownCategorySlug(categorySlug))) {
    notFound();
  }

  const currentCategory = await getCategoryBySlug(categorySlug);

  if (!currentCategory) {
    notFound();
  }

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-[126px]">
      {children}
    </main>
  );
}
