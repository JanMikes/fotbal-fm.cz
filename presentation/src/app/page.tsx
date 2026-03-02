import { redirect } from 'next/navigation';
import { getCategories } from '@/lib/strapi/data';

export default async function Home() {
  const categories = await getCategories();

  if (categories.length > 0) {
    redirect(`/kategorie/${categories[0].slug}`);
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
