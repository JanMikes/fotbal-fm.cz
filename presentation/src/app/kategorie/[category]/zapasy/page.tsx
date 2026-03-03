import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getAllMatchesByCategory } from '@/lib/strapi/data';
import MatchesPageContent from '@/components/sections/MatchesPageContent';

interface ZapasyPageProps {
  params: Promise<{ category: string }>;
}

export default async function ZapasyPage({ params }: ZapasyPageProps) {
  const { category: categorySlug } = await params;
  const matches = await getAllMatchesByCategory(categorySlug);

  return (
    <section className="py-section">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Back link */}
        <Link
          href={`/kategorie/${categorySlug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary/60 hover:text-accent transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Zpět na kategorii
        </Link>

        {/* Header */}
        <h1 className="text-section text-primary uppercase accent-underline mb-12">
          Zápasy
        </h1>

        <MatchesPageContent matches={matches} />
      </div>
    </section>
  );
}
