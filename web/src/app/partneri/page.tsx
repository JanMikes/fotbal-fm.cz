import type { Metadata } from 'next';
import { getPartners } from '@/lib/strapi/data';
import { Breadcrumb, PartnerCard } from '@/components/ui';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Partneři',
  description:
    'Partneři a sponzoři FK Frýdek-Místek. Firmy a instituce, které podporují fotbal ve ' +
    'Frýdku-Místku od mládežnických kategorií až po A-tým.',
  path: '/partneri',
});

export default async function PartneriPage() {
  const partners = await getPartners();

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-[126px]">
      <div className="container mx-auto px-4 lg:px-8 pb-8 lg:pb-12">
        <Breadcrumb items={[
          { label: 'Partneři', href: '/partneri' },
        ]} />
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
