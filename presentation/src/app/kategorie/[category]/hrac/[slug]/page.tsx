import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PlayerDetail } from '@/components/sections';
import { Breadcrumb } from '@/components/ui';
import { getPlayerByCategoryAndSlug, getCategoryBySlug } from '@/lib/strapi/data';

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
  const [player, category] = await Promise.all([
    getPlayerByCategoryAndSlug(categorySlug, slug),
    getCategoryBySlug(categorySlug),
  ]);

  if (!player) {
    notFound();
  }

  return (
    <>
      <div className="container mx-auto px-4 lg:px-8 pt-6">
        <Breadcrumb items={[
          { label: category?.name ?? categorySlug, href: `/kategorie/${categorySlug}` },
          { label: player.name, href: `/kategorie/${categorySlug}/hrac/${slug}` },
        ]} />
      </div>
      <PlayerDetail player={player} />
    </>
  );
}
