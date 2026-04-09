'use client';

import { SidePanel } from '@/components/layout';
import { DynamicZone } from '@/components/strapi/DynamicZone';
import type {
  DynamicZoneComponent,
  ComponentText,
  ComponentHeading,
  ComponentAlert,
  ComponentLinksList,
  ComponentContactCards,
  ComponentDocuments,
  ComponentBadges,
  ComponentButtonGroup,
} from '@/lib/types';

const mockImg = (path: string, alt: string, w: number, h: number) => ({
  url: `/mock/${path}`,
  alternativeText: alt,
  width: w,
  height: h,
});

// Main content
const mainContent: DynamicZoneComponent[] = [
  {
    id: 100,
    __component: 'components.heading',
    text: 'O klubu FK Frýdek-Místek',
    type: 'h2',
    anchor: 'o-klubu',
  } as ComponentHeading,
  {
    id: 101,
    __component: 'components.text',
    text: '<p>FK Frýdek-Místek je tradiční fotbalový klub s bohatou historií sahající do roku 1920. Klub hraje své domácí zápasy na stadionu Stovky, který pojme přes 5000 diváků.</p><p>Naším cílem je <strong>rozvíjet místní fotbalové talenty</strong> a poskytovat kvalitní sportovní zázemí pro hráče všech věkových kategorií. Klub se zaměřuje na výchovu mládeže a postupný rozvoj všech svých družstev.</p><p>V posledních letech prošel klub významnou modernizací zázemí. Byly zrekonstruovány šatny, tréninkové plochy a doplněno moderní vybavení pro hráče i realizační tým.</p>',
  } as ComponentText,
  {
    id: 102,
    __component: 'components.alert',
    type: 'info',
    title: 'Sezóna 2025/26',
    text: '<p>Nová sezóna začíná v srpnu. Permanentky jsou v předprodeji se slevou 20%.</p>',
  } as ComponentAlert,
  {
    id: 103,
    __component: 'components.heading',
    text: 'Historie klubu',
    type: 'h3',
    anchor: 'historie',
  } as ComponentHeading,
  {
    id: 104,
    __component: 'components.text',
    text: '<p>Klub byl založen v roce 1920 jako jeden z prvních fotbalových klubů v regionu. Za více než sto let své existence prošel mnoha vzestupy i pády, ale vždy zůstal věrný svým hodnotám - fair play, rozvoji mládeže a spojení s místní komunitou.</p><p>Historickým milníkem byl postup do první ligy v roce 1965, kdy klub poprvé okusil nejvyšší soutěž. V roce 1998 byl otevřen modernizovaný stadion Stovky, který dodnes slouží jako domovský stánek klubu.</p>',
  } as ComponentText,
  {
    id: 105,
    __component: 'components.documents',
    documents: [
      { name: 'Stanovy klubu', file: mockImg('hero.jpg', 'PDF', 100, 100) },
      { name: 'Výroční zpráva 2024/25', file: mockImg('hero.jpg', 'PDF', 100, 100) },
    ],
    columns: '2',
  } as ComponentDocuments,
];

// Sidebar content
const sidebarContent: DynamicZoneComponent[] = [
  {
    id: 200,
    __component: 'components.heading',
    text: 'Kontakty',
    type: 'h3',
    anchor: null,
  } as ComponentHeading,
  {
    id: 201,
    __component: 'components.contact-cards',
    cards: [
      { name: 'Jan Novák', role: 'Sekretariát', phone: '+420 777 123 456', email: 'info@fkfm.cz', photo: mockImg('person-1.jpg', 'Jan Novák', 100, 100), style: 'style-1' },
    ],
  } as ComponentContactCards,
  {
    id: 202,
    __component: 'components.heading',
    text: 'Rychlé odkazy',
    type: 'h3',
    anchor: null,
  } as ComponentHeading,
  {
    id: 203,
    __component: 'components.links-list',
    links: [
      { text: 'Rozpis zápasů', href: '/rozpis', external: false, disabled: false },
      { text: 'Výsledky', href: '/vysledky', external: false, disabled: false },
      { text: 'Tabulka soutěže', href: '/tabulka', external: false, disabled: false },
      { text: 'FAČR', href: 'https://facr.cz', external: true, disabled: false },
    ],
    layout: 'Rows',
  } as ComponentLinksList,
  {
    id: 204,
    __component: 'components.badges',
    badges: [
      { label: 'MSFL', variant: 'primary', size: 'M' },
      { label: 'Sezóna 2025/26', variant: 'accent', size: 'S' },
    ],
    alignment: 'L',
  } as ComponentBadges,
  {
    id: 205,
    __component: 'components.button-group',
    buttons: [
      { link: { text: 'Koupit permanentku', href: '/permanentky', external: false, disabled: false }, variant: 'Primary', size: 'M' },
    ],
    alignment: 'L',
  } as ComponentButtonGroup,
];

export default function SidebarShowcase() {
  return (
    <section>
      <div className="mb-6 pb-2 border-b border-primary/10">
        <h2 className="text-lg font-bold text-primary/50 uppercase tracking-wider">
          Stránka s postranním panelem (sidebar)
        </h2>
        <p className="text-sm text-primary/40 mt-1">
          Grid 2/3 + 1/3 na desktopu, stacked na mobilu. Sidebar je sticky.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <DynamicZone components={mainContent} />
        </div>
        <SidePanel>
          <DynamicZone components={sidebarContent} sidebar />
        </SidePanel>
      </div>
    </section>
  );
}
