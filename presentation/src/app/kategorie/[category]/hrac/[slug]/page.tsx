import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PlayerDetail } from '@/components/sections';
import { getPlayerByCategoryAndSlug } from '@/lib/strapi/data';

interface PlayerPageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { category: categorySlug, slug } = await params;
  const player = await getPlayerByCategoryAndSlug(categorySlug, slug);

  if (!player) {
    return { title: 'Hráč nenalezen | FK Frýdek-Místek' };
  }

  return {
    title: `${player.name} | FK Frýdek-Místek`,
    description: player.bio || `Profil hráče ${player.name} - FK Frýdek-Místek`,
    openGraph: {
      title: player.name,
      images: player.photo ? [{ url: player.photo.url }] : undefined,
    },
  };
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { category: categorySlug, slug } = await params;
  const player = await getPlayerByCategoryAndSlug(categorySlug, slug);

  if (!player) {
    notFound();
  }

  return <PlayerDetail player={player} categorySlug={categorySlug} />;
}
