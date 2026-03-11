import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Image from 'next/image';
import { SidePanel } from '@/components/layout';
import { Breadcrumb } from '@/components/ui';
import { getPartnerBySlug } from '@/lib/strapi/data';
import { DynamicZone } from '@/components/strapi/DynamicZone';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getPartnerBySlug(slug);

  if (!partner) {
    return { title: 'Partner nenalezen | FK Frýdek-Místek' };
  }

  return {
    title: `${partner.name} | Partneři | FK Frýdek-Místek`,
    description: partner.description || undefined,
  };
}

export default async function PartnerDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const partner = await getPartnerBySlug(slug);

  if (!partner) {
    notFound();
  }

  const hasPanel = partner.panel && partner.panel.length > 0;

  return (
    <main className="bg-surface-light pt-[72px] lg:pt-[126px]">
      <div className="container mx-auto px-4 lg:px-8 pb-8 lg:pb-12">
        <Breadcrumb items={[
          { label: 'Partneři', href: '/partneri' },
          { label: partner.name, href: `/partner/${slug}` },
        ]} />
        <div className="flex items-center gap-6 mb-8">
          {partner.logo && (
            <Image
              src={partner.logo.url}
              alt={partner.name}
              width={partner.logo.width}
              height={partner.logo.height}
              className="max-w-28 max-h-20 lg:max-w-40 lg:max-h-24 w-auto h-auto shrink-0 object-contain"
            />
          )}
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-primary">{partner.name}</h1>
            {partner.description && (
              <p className="text-primary/60 mt-2">{partner.description}</p>
            )}
          </div>
        </div>
        {hasPanel ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <DynamicZone components={partner.content} />
            </div>
            <SidePanel>
              <DynamicZone components={partner.panel} sidebar />
            </SidePanel>
          </div>
        ) : (
          <div className="max-w-4xl space-y-6">
            <DynamicZone components={partner.content} />
          </div>
        )}
      </div>
    </main>
  );
}
