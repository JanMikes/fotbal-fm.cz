import type { Metadata } from 'next';
import HeroSlider from '@/components/sections/HeroSlider';
import MatchesSection from '@/components/sections/MatchesSection';
import PlayersGrid from '@/components/sections/PlayersGrid';
import ResultsTable from '@/components/sections/ResultsTable';
import ActualitiesSection from '@/components/sections/ActualitiesSection';
import PartnersSection from '@/components/sections/PartnersSection';
import { getCategoryData } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Přípravka | Frýdek-Místek Fotbal',
  description: 'Fotbalový tým přípravky FK Frýdek-Místek - zápasy, soupiska, výsledky a aktuality',
};

export default async function PripravkaPage() {
  const data = await getCategoryData('pripravka');
  const nextMatch = data.matches.upcomingMatches[0];

  return (
    <>
      <HeroSlider nextMatch={nextMatch} category="pripravka" />
      <MatchesSection matchesData={data.matches} />
      <PlayersGrid players={data.players} />
      <ResultsTable table={data.table} />
      <ActualitiesSection actualities={data.actualities} />
      <PartnersSection partners={data.partners} />
    </>
  );
}
