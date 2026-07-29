import type { Metadata } from 'next';
import { Breadcrumb } from '@/components/ui';
import KdyHrajemeContent, { type HomeAwayFilter } from '@/components/sections/KdyHrajemeContent';
import { getAvailableSeasons, getCategories, getClubMatches, type ClubMatchesResult } from '@/lib/strapi/data';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Kdy hrajeme',
  description:
    'Program zápasů všech kategorií FK Frýdek-Místek na jednom místě — filtrujte podle ' +
    'kategorie, domácích a venkovních zápasů i ročníku.',
  path: '/kdy-hrajeme',
});

const PAGE_SIZE = 20;

interface KdyHrajemePageProps {
  searchParams: Promise<{ kategorie?: string; zapasy?: string; rocnik?: string; strana?: string }>;
}

export default async function KdyHrajemePage({ searchParams }: KdyHrajemePageProps) {
  const params = await searchParams;
  const [categories, seasons] = await Promise.all([getCategories(), getAvailableSeasons()]);

  const categorySlug = categories.some((c) => c.slug === params.kategorie)
    ? params.kategorie
    : undefined;
  const homeAwayParam: HomeAwayFilter =
    params.zapasy === 'domaci' || params.zapasy === 'venkovni' ? params.zapasy : 'vse';
  const homeAway = homeAwayParam === 'domaci' ? 'home' as const
    : homeAwayParam === 'venkovni' ? 'away' as const
    : undefined;
  const page = Math.max(1, Number(params.strana) || 1);

  const requestedSeason = Number(params.rocnik);
  let season: number | null = seasons.includes(requestedSeason) ? requestedSeason : null;
  let result: ClubMatchesResult | null = null;

  if (season !== null) {
    result = await getClubMatches({ categorySlug, season, homeAway, page, pageSize: PAGE_SIZE });
  } else {
    // Default: the newest season that has matches for the current filter
    for (const s of seasons) {
      result = await getClubMatches({ categorySlug, season: s, homeAway, page, pageSize: PAGE_SIZE });
      season = s;
      if (result.total > 0) break;
    }
  }

  return (
    <section className="pb-section">
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: 'Kdy hrajeme', href: '/kdy-hrajeme' },
        ]} />

        <h1 className="text-section text-primary uppercase accent-underline mb-12">
          Kdy hrajeme
        </h1>

        <KdyHrajemeContent
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          seasons={seasons}
          activeCategory={categorySlug ?? null}
          activeHomeAway={homeAwayParam}
          activeSeason={season}
          matches={result?.matches ?? []}
          page={page}
          pageCount={result?.pageCount ?? 1}
          total={result?.total ?? 0}
        />
      </div>
    </section>
  );
}
