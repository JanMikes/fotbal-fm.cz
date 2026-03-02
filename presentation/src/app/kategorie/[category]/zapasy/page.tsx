import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllMatchesByCategory, getCategories } from '@/lib/strapi/data';
import MatchesPageContent from '@/components/sections/MatchesPageContent';

interface ZapasyPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ category: cat.slug }));
}

export default async function ZapasyPage({ params, searchParams }: ZapasyPageProps) {
  const { category: categorySlug } = await params;
  const { tab } = await searchParams;

  const matches = await getAllMatchesByCategory(categorySlug);

  const upcomingMatches = matches
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => a.rawMatchDate.localeCompare(b.rawMatchDate));

  const finishedMatches = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.rawMatchDate.localeCompare(a.rawMatchDate));

  const defaultTab = tab === 'finished' ? 'finished' as const : 'upcoming' as const;

  return (
    <section className="py-section">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Back link */}
        <Link
          href={`/kategorie/${categorySlug}`}
          className="inline-flex items-center gap-2 text-primary/60 hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Zpět na kategorii</span>
        </Link>

        {/* Header */}
        <h1 className="text-section text-primary uppercase accent-underline mb-12">
          Zápasy
        </h1>

        <MatchesPageContent
          upcomingMatches={upcomingMatches}
          finishedMatches={finishedMatches}
          defaultTab={defaultTab}
        />
      </div>
    </section>
  );
}
