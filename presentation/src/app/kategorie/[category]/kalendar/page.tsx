import Link from 'next/link';
import { ArrowLeft, Calendar } from 'lucide-react';
import { MatchCard } from '@/components/ui';
import { getAllMatchesByCategory, getCategories } from '@/lib/strapi/data';

interface CalendarPageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((cat) => ({ category: cat.slug }));
}

export default async function CalendarPage({ params }: CalendarPageProps) {
  const { category: categorySlug } = await params;
  const matches = await getAllMatchesByCategory(categorySlug);

  const upcomingMatches = matches
    .filter((m) => m.status === 'upcoming')
    .sort((a, b) => a.rawMatchDate.localeCompare(b.rawMatchDate));

  const finishedMatches = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.rawMatchDate.localeCompare(a.rawMatchDate));

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
          Kalendář zápasů
        </h1>

        {/* Upcoming Matches */}
        {upcomingMatches.length > 0 && (
          <div className="mb-16">
            <h2 className="text-lg font-semibold text-primary uppercase tracking-wide mb-6">
              Nadcházející zápasy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {/* Finished Matches */}
        {finishedMatches.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-primary uppercase tracking-wide mb-6">
              Odehrané zápasy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {finishedMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {upcomingMatches.length === 0 && finishedMatches.length === 0 && (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-primary/20 mx-auto mb-4" />
            <p className="text-primary/60">Žádné zápasy k zobrazení</p>
          </div>
        )}
      </div>
    </section>
  );
}
