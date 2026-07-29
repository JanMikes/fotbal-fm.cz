import type { Metadata } from 'next';
import { getAllMatchesByCategory, getCategoryBySlug } from '@/lib/strapi/data';
import { Breadcrumb } from '@/components/ui';
import MatchesPageContent from '@/components/sections/MatchesPageContent';
import { pageMetadata } from '@/lib/seo';

interface ZapasyPageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: ZapasyPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategoryBySlug(categorySlug);
  const name = category?.name ?? categorySlug;

  return pageMetadata({
    title: `Zápasy — ${name}`,
    description:
      `Kompletní program a výsledky zápasů kategorie ${name} FK Frýdek-Místek. ` +
      `Termíny, soupeři, hřiště i skóre odehraných utkání.`,
    path: `/kategorie/${categorySlug}/zapasy`,
  });
}

export default async function ZapasyPage({ params }: ZapasyPageProps) {
  const { category: categorySlug } = await params;
  const [matches, category] = await Promise.all([
    getAllMatchesByCategory(categorySlug),
    getCategoryBySlug(categorySlug),
  ]);

  return (
    <section className="pb-section">
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: category?.name ?? categorySlug, href: `/kategorie/${categorySlug}` },
          { label: 'Zápasy', href: `/kategorie/${categorySlug}/zapasy` },
        ]} />

        <h1 className="text-section text-primary uppercase accent-underline mb-12">
          Zápasy
        </h1>

        <MatchesPageContent matches={matches} />
      </div>
    </section>
  );
}
