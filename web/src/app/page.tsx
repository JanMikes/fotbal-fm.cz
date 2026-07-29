import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCategoryGroups } from '@/lib/strapi/data';
import { SITE_DESCRIPTION } from '@/lib/seo';

export const metadata: Metadata = {
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
};

export default async function Home() {
  const categoryGroups = await getCategoryGroups();

  if (categoryGroups.length > 0) {
    redirect(`/kategorie/${categoryGroups[0].firstCategorySlug}`);
  }

  return (
    <main className="bg-surface-light min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">FK Frýdek-Místek</h1>
        <p className="text-primary/60">Zatím nejsou k dispozici žádné kategorie.</p>
      </div>
    </main>
  );
}
