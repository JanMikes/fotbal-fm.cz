import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PlayerDetail } from '@/components/sections';
import { Breadcrumb } from '@/components/ui';
import { getPlayerByCategoryAndSlug, getCategoryBySlug } from '@/lib/strapi/data';
import { toPublicUrl } from '@/lib/strapi/mappers/shared';
import { pageMetadata, toDescription } from '@/lib/seo';

interface PlayerPageProps {
  params: Promise<{ category: string; slug: string }>;
}

export async function generateMetadata({ params }: PlayerPageProps): Promise<Metadata> {
  const { category: categorySlug, slug } = await params;
  const [player, category] = await Promise.all([
    getPlayerByCategoryAndSlug(categorySlug, slug),
    getCategoryBySlug(categorySlug),
  ]);
  const path = `/kategorie/${categorySlug}/hrac/${slug}`;

  if (!player) {
    return pageMetadata({
      title: 'Stránka nenalezena',
      description: 'Požadovaný profil neexistuje nebo byl přesunut.',
      path,
      noIndex: true,
    });
  }

  const categoryName = category?.name ?? categorySlug;
  const isStaff = player.type === 'realizační tým';
  const role = isStaff
    ? player.positionText || 'člen realizačního týmu'
    : [player.positionText || player.position, player.number ? `číslo ${player.number}` : null]
        .filter(Boolean)
        .join(', ');

  const fallback = [
    `${player.name} —`,
    role ? `${role},` : null,
    `${categoryName} FK Frýdek-Místek.`,
    isStaff ? 'Profil člena realizačního týmu.' : 'Profil hráče, statistiky a odehrané zápasy.',
  ]
    .filter(Boolean)
    .join(' ');

  return pageMetadata({
    title: player.name,
    description: toDescription(player.bio, fallback),
    path,
    image: player.photo ? toPublicUrl(player.photo.url) : null,
    type: 'profile',
  });
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
      <div className="container mx-auto px-4 lg:px-8">
        <Breadcrumb items={[
          { label: category?.name ?? categorySlug, href: `/kategorie/${categorySlug}` },
          { label: player.name, href: `/kategorie/${categorySlug}/hrac/${slug}` },
        ]} />
      </div>
      <PlayerDetail player={player} />
    </>
  );
}
