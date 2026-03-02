import type { Metadata } from 'next';
import { getPartners } from '@/lib/strapi/data';
import { PartnerCard } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Partneři | FK Frýdek-Místek',
};

export default async function PartneriPage() {
  const partners = await getPartners();

  return (
    <main className="bg-surface-light mt-28 lg:mt-32">
      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        <h1 className="text-3xl lg:text-4xl font-bold text-primary mb-8">Partneři</h1>
        {partners.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((partner) => (
              <PartnerCard key={partner.documentId} partner={partner} />
            ))}
          </div>
        ) : (
          <p className="text-primary/60">Žádní partneři zatím nebyli přidáni.</p>
        )}
      </div>
    </main>
  );
}
