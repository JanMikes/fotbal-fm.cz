'use client';

import { RichText } from '@/components/dynamic/RichText';
import { Heading } from '@/components/dynamic/Heading';
import { Alert } from '@/components/dynamic/Alert';
import { LinksList } from '@/components/dynamic/LinksList';
import { Video } from '@/components/dynamic/Video';
import { FeatureCards } from '@/components/dynamic/FeatureCards';
import { BannerCards } from '@/components/dynamic/BannerCards';
import { Documents } from '@/components/dynamic/Documents';
import { PartnerLogos } from '@/components/dynamic/PartnerLogos';
import { StatsHighlights } from '@/components/dynamic/StatsHighlights';
import { Timeline } from '@/components/dynamic/Timeline';
import { SectionDivider } from '@/components/dynamic/SectionDivider';
import { Slider } from '@/components/dynamic/Slider';
import { GallerySlider } from '@/components/dynamic/GallerySlider';
import { PhotoGallery } from '@/components/dynamic/PhotoGallery';
import { ButtonGroup } from '@/components/dynamic/ButtonGroup';
import { ContactCards } from '@/components/dynamic/ContactCards';
import { AccordionSections } from '@/components/dynamic/AccordionSections';
import { Badges } from '@/components/dynamic/Badges';
import { ImageBlock } from '@/components/dynamic/ImageBlock';

import type {
  ComponentText,
  ComponentHeading,
  ComponentAlert,
  ComponentLinksList,
  ComponentVideo,
  ComponentFeatureCards,
  ComponentBannerCards,
  ComponentDocuments,
  ComponentPartnerLogos,
  ComponentStatsHighlights,
  ComponentTimeline,
  ComponentSectionDivider,
  ComponentSlider,
  ComponentGallerySlider,
  ComponentPhotoGallery,
  ComponentButtonGroup,
  ComponentContactCards,
  ComponentAccordionSections,
  ComponentBadges,
  ComponentImage,
} from '@/lib/types';

const mockImg = (path: string, alt: string, w: number, h: number) => ({
  url: `/mock/${path}`,
  alternativeText: alt,
  width: w,
  height: h,
});

// Mock data

const textData: ComponentText = {
  id: 1,
  __component: 'components.text',
  text: '<p>FK Frýdek-Místek je tradiční fotbalový klub s bohatou historií sahající do roku 1920. Klub hraje své domácí zápasy na stadionu Stovky, který pojme přes 5000 diváků.</p><p>Naším cílem je <strong>rozvíjet místní fotbalové talenty</strong> a poskytovat kvalitní sportovní zázemí pro hráče všech věkových kategorií.</p>',
};

const textWithHrAndBlockquote: ComponentText = {
  id: 100,
  __component: 'components.text',
  text: 'Úvodní odstavec před horizontální čárou.\n\n---\n\nOdstavec po horizontální čáře.\n\n> Toto je citace. Může obsahovat **tučný text** a *kurzívu*.\n> Pokračování citace na dalším řádku.\n\nNormální text po citaci.\n\n> Další citace s jedním řádkem.\n\n---\n\nZávěrečný odstavec po druhé horizontální čáře.',
};

const headingData: ComponentHeading = {
  id: 2,
  __component: 'components.heading',
  text: 'O klubu FK Frýdek-Místek',
  type: 'h2',
  anchor: 'o-klubu',
};

const headingH3: ComponentHeading = {
  id: 20,
  __component: 'components.heading',
  text: 'Nadpis úrovně H3',
  type: 'h3',
  anchor: null,
};

const alertInfo: ComponentAlert = {
  id: 3,
  __component: 'components.alert',
  type: 'info',
  title: 'Informace pro diváky',
  text: '<p>Vstupenky na domácí zápasy můžete zakoupit na pokladnách stadionu od 60 minut před výkopem.</p>',
};

const alertSuccess: ComponentAlert = {
  id: 4,
  __component: 'components.alert',
  type: 'success',
  title: 'Postup do vyšší soutěže!',
  text: '<p>Gratulujeme! Náš A-tým postoupil do Moravskoslezské fotbalové ligy.</p>',
};

const alertWarning: ComponentAlert = {
  id: 5,
  __component: 'components.alert',
  type: 'warning',
  title: 'Změna termínu zápasu',
  text: '<p>Zápas proti FK Havířov byl přesunut na neděli 15. března v 15:00.</p>',
};

const alertError: ComponentAlert = {
  id: 6,
  __component: 'components.alert',
  type: 'error',
  title: 'Zápas zrušen',
  text: '<p>Kvůli nepříznivému počasí byl dnešní zápas zrušen. Náhradní termín bude oznámen.</p>',
};

const linksListData: ComponentLinksList = {
  id: 7,
  __component: 'components.links-list',
  links: [
    { text: 'Rozpis zápasů sezóna 2025/26', href: '/rozpis', external: false, disabled: false },
    { text: 'Pravidla vstupu na stadion', href: '/pravidla', external: false, disabled: false },
    { text: 'FAČR - registrace hráčů', href: 'https://facr.cz', external: true, disabled: false },
    { text: 'Přípravné zápasy (připravujeme)', href: '#', external: false, disabled: true },
  ],
  layout: 'Rows',
};

const linksListGrid: ComponentLinksList = {
  id: 8,
  __component: 'components.links-list',
  links: [
    { text: 'Muži A', href: '/kategorie/muzi-a', external: false, disabled: false },
    { text: 'Muži B', href: '/kategorie/muzi-b', external: false, disabled: false },
    { text: 'Dorost', href: '/kategorie/dorost', external: false, disabled: false },
    { text: 'Žáci', href: '/kategorie/zaci', external: false, disabled: false },
  ],
  layout: 'Grid',
};

const videoData: ComponentVideo = {
  id: 9,
  __component: 'components.video',
  youtube_id: 'dQw4w9WgXcQ',
  aspect_ratio: '16:9',
};

const featureCardsData: ComponentFeatureCards = {
  id: 10,
  __component: 'components.feature-cards',
  cards: [
    { icon_type: 'initials', icon: null, icon_text: null, title: 'Mládežnická akademie', description: 'Rozvíjíme talenty od přípravky po dorost. Kvalifikovaní trenéři a moderní tréningové metody.', link: { text: 'Více o akademii', href: '/akademie', external: false, disabled: false } },
    { icon_type: 'initials', icon: null, icon_text: null, title: 'Fanouškovský klub', description: 'Staň se členem fanouškovského klubu a získej slevy na vstupenky a merchandise.', link: { text: 'Přidej se', href: '/fanousci', external: false, disabled: false } },
    { icon_type: 'initials', icon: null, icon_text: null, title: 'Pronájem hřiště', description: 'Nabízíme pronájem tréninkového hřiště s umělým povrchem pro týmy i jednotlivce.', link: { text: 'Rezervace', href: '/pronajem', external: false, disabled: false } },
  ],
  columns: '3',
  card_clickable: false,
};

const bannerCardsData: ComponentBannerCards = {
  id: 11,
  __component: 'components.banner-cards',
  cards: [
    { icon_type: 'hidden', icon: null, icon_text: null, title: 'Sezóna 2025/26 začíná!', description: 'Permanentky v předprodeji se slevou 20%. Nepromeškejte ani jeden domácí zápas.', link: { text: 'Koupit permanentku', href: '/permanentky', external: false, disabled: false } },
    { icon_type: 'hidden', icon: null, icon_text: null, title: 'Letní kemp pro děti', description: 'Fotbalový kemp pro děti 6-14 let. Profesionální trenéři, moderní zázemí, spousta zábavy.', link: { text: 'Přihlásit dítě', href: '/kemp', external: false, disabled: false } },
  ],
};

const documentsData: ComponentDocuments = {
  id: 12,
  __component: 'components.documents',
  documents: [
    { name: 'Stanovy klubu FK Frýdek-Místek', file: mockImg('hero.jpg', 'PDF', 100, 100) },
    { name: 'Rozpočet sezóna 2025/26', file: mockImg('hero.jpg', 'XLS', 100, 100) },
    { name: 'Přihláška do mládežnické akademie', file: mockImg('hero.jpg', 'DOC', 100, 100) },
  ],
  columns: '3',
};

const partnerLogosData: ComponentPartnerLogos = {
  id: 13,
  __component: 'components.partner-logos',
  partners: [
    { name: 'Město Frýdek-Místek', logo: mockImg('logo-1.png', 'Město FM', 160, 80), url: 'https://frydekmistek.cz' },
    { name: 'Hyundai', logo: mockImg('logo-2.png', 'Hyundai', 160, 80), url: 'https://hyundai.cz' },
    { name: 'Třinecké železárny', logo: mockImg('logo-3.png', 'Třinecké železárny', 160, 80), url: null },
    { name: 'Beskyd Sport', logo: mockImg('logo-4.png', 'Beskyd Sport', 160, 80), url: null },
  ],
  grayscale: true,
  columns: '4',
};

const statsData: ComponentStatsHighlights = {
  id: 14,
  __component: 'components.stats-highlights',
  items: [
    { number: '100+', title: 'Let historie', description: 'Založeno v roce 1920' },
    { number: '250', title: 'Aktivních hráčů', description: 'Napříč všemi kategoriemi' },
    { number: '15', title: 'Týmů', description: 'Od přípravky po muže' },
    { number: '5000+', title: 'Kapacita stadionu', description: 'Stadion Stovky' },
  ],
  columns: '4',
};

const timelineData: ComponentTimeline = {
  id: 15,
  __component: 'components.timeline',
  collapsible: false,
  showPreview: true,
  style: 'style1',
  items: [
    { number: '1920', title: 'Založení klubu', description: 'FK Frýdek-Místek byl založen jako jeden z prvních fotbalových klubů v regionu.' },
    { number: '1965', title: 'Postup do 1. ligy', description: 'Historický úspěch - postup do nejvyšší soutěže.' },
    { number: '1998', title: 'Nový stadion', description: 'Otevření modernizovaného stadionu Stovky.' },
    { number: '2024', title: 'Mládežnická akademie', description: 'Spuštění nového programu rozvoje mládeže.' },
  ],
};

const dividerData: ComponentSectionDivider = {
  id: 16,
  __component: 'components.section-divider',
  spacing: 'M',
  style: 'solid',
};

const sliderData: ComponentSlider = {
  id: 17,
  __component: 'components.slider',
  slides: [
    { title: 'Domácí zápas: FK FM vs. Baník Ostrava B', description: '<p>Neděle 15. března 2026, 15:00</p>', link: { text: 'Koupit vstupenku', href: '/vstupenky', external: false, disabled: false }, image: mockImg('match.jpg', 'Zápas', 1200, 675), background_image: null },
    { title: 'Zimní příprava v plném proudu', description: '<p>Tým se připravuje na jarní část sezóny</p>', link: null, image: mockImg('training.jpg', 'Příprava', 1200, 675), background_image: null },
    { title: 'Nové dresy sezóna 2026', description: '<p>Představujeme novou kolekci dresů</p>', link: { text: 'Objednat', href: '/eshop', external: false, disabled: false }, image: mockImg('stadium.jpg', 'Dresy', 1200, 675), background_image: null },
  ],
  autoplay: true,
  autoplay_interval: 5000,
};

const gallerySliderData: ComponentGallerySlider = {
  id: 18,
  __component: 'components.gallery-slider',
  photos: [
    { image: mockImg('gallery-1.jpg', 'Foto 1', 600, 450) },
    { image: mockImg('gallery-2.jpg', 'Foto 2', 600, 450) },
    { image: mockImg('gallery-3.jpg', 'Foto 3', 600, 450) },
    { image: mockImg('gallery-4.jpg', 'Foto 4', 600, 450) },
    { image: mockImg('gallery-5.jpg', 'Foto 5', 600, 450) },
  ],
};

const photoGalleryData: ComponentPhotoGallery = {
  id: 19,
  __component: 'components.photo-gallery',
  photos: [
    { image: mockImg('gallery-1.jpg', 'Galerie 1', 600, 450) },
    { image: mockImg('gallery-2.jpg', 'Galerie 2', 600, 450) },
    { image: mockImg('gallery-3.jpg', 'Galerie 3', 600, 450) },
    { image: mockImg('gallery-4.jpg', 'Galerie 4', 600, 450) },
    { image: mockImg('gallery-5.jpg', 'Galerie 5', 600, 450) },
    { image: mockImg('gallery-6.jpg', 'Galerie 6', 600, 450) },
  ],
  columns: '3',
};

const buttonGroupData: ComponentButtonGroup = {
  id: 21,
  __component: 'components.button-group',
  buttons: [
    { link: { text: 'Koupit vstupenky', href: '/vstupenky', external: false, disabled: false }, variant: 'Primary', size: 'M' },
    { link: { text: 'Rozpis zápasů', href: '/rozpis', external: false, disabled: false }, variant: 'Outline', size: 'M' },
    { link: { text: 'Kontakt', href: '/kontakt', external: false, disabled: false }, variant: 'Ghost', size: 'M' },
  ],
  alignment: 'L',
};

const contactCardsData: ComponentContactCards = {
  id: 22,
  __component: 'components.contact-cards',
  cards: [
    { name: 'Jan Novák', role: 'Prezident klubu', phone: '+420 777 123 456', email: 'novak@fkfm.cz', photo: mockImg('person-1.jpg', 'Jan Novák', 200, 200) },
    { name: 'Petr Svoboda', role: 'Hlavní trenér A-týmu', phone: '+420 777 234 567', email: 'svoboda@fkfm.cz', photo: mockImg('person-2.jpg', 'Petr Svoboda', 200, 200) },
    { name: 'Marie Dvořáková', role: 'Sekretariát', phone: '+420 777 345 678', email: 'dvorakova@fkfm.cz', photo: mockImg('person-3.jpg', 'Marie Dvořáková', 200, 200) },
  ],
};

const accordionData: ComponentAccordionSections = {
  id: 23,
  __component: 'components.accordion-sections',
  sections: [
    {
      title: 'Jak koupit vstupenky?',
      description: '<p>Vstupenky si můžete zakoupit přímo na pokladnách stadionu od 60 minut před výkopem, nebo online na našem webu v sekci <strong>Vstupenky</strong>.</p>',
      default_open: true,
      files: [],
      photos: [],
      contacts: [],
    },
    {
      title: 'Kde zaparkovat?',
      description: '<p>Parkování je k dispozici na parkovišti P1 (200 míst) a P2 (100 míst) v bezprostřední blízkosti stadionu. Parkování je zdarma pro držitele permanentek.</p>',
      default_open: false,
      files: [
        { name: 'Mapa parkování', file: mockImg('hero.jpg', 'Mapa', 100, 100) },
      ],
      photos: [],
      contacts: [],
    },
    {
      title: 'Pravidla vstupu na stadion',
      description: '<p>Na stadion je zakázáno vnášet skleněné nádoby, pyrotechniku a alkoholické nápoje. Vstup s domácími zvířaty není povolen.</p>',
      default_open: false,
      files: [],
      photos: [
        { image: mockImg('stadium.jpg', 'Stadion 1', 400, 300) },
        { image: mockImg('match.jpg', 'Stadion 2', 400, 300) },
      ],
      contacts: [
        { name: 'Jan Novák', role: 'Správce stadionu', phone: '+420 123 456 789', email: 'novak@example.com', photo: null },
      ],
    },
  ],
};

const badgesData: ComponentBadges = {
  id: 24,
  __component: 'components.badges',
  badges: [
    { label: 'MSFL', variant: 'primary', size: 'M' },
    { label: 'Sezóna 2025/26', variant: 'accent', size: 'M' },
    { label: 'Domácí', variant: 'success', size: 'M' },
    { label: 'Vyprodáno', variant: 'error', size: 'S' },
    { label: 'Nové', variant: 'warning', size: 'L' },
  ],
  alignment: 'L',
};

const imageData: ComponentImage = {
  id: 25,
  __component: 'components.image',
  image: mockImg('hero.jpg', 'Stadion Stovky', 800, 400),
};

// Component section wrapper
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-16">
      <div className="mb-4 pb-2 border-b border-primary/10">
        <h2 className="text-lg font-bold text-primary/50 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="space-y-6">
        {children}
      </div>
    </section>
  );
}

export default function KomponentyContent() {
  return (
    <div className="max-w-4xl space-y-0">
      <Section title="components.heading">
        <Heading data={headingData} />
        <Heading data={headingH3} />
      </Section>

      <Section title="components.text">
        <RichText data={textData} />
      </Section>

      <Section title="components.text (hr + blockquote)">
        <RichText data={textWithHrAndBlockquote} />
      </Section>

      <Section title="components.alert">
        <Alert data={alertInfo} />
        <Alert data={alertSuccess} />
        <Alert data={alertWarning} />
        <Alert data={alertError} />
      </Section>

      <Section title="components.links-list (Rows)">
        <LinksList data={linksListData} />
      </Section>

      <Section title="components.links-list (Grid)">
        <LinksList data={linksListGrid} />
      </Section>

      <Section title="components.video">
        <Video data={videoData} />
      </Section>

      <Section title="components.feature-cards">
        <FeatureCards data={featureCardsData} />
      </Section>

      <Section title="components.banner-cards">
        <BannerCards data={bannerCardsData} />
      </Section>

      <Section title="components.documents">
        <Documents data={documentsData} />
      </Section>

      <Section title="components.partner-logos">
        <PartnerLogos data={partnerLogosData} />
      </Section>

      <Section title="components.stats-highlights">
        <StatsHighlights data={statsData} />
      </Section>

      <Section title="components.timeline (style1)">
        <Timeline data={timelineData} />
      </Section>

      <Section title="components.timeline (style1, collapsible)">
        <Timeline data={{ ...timelineData, id: 151, collapsible: true }} />
      </Section>

      <Section title="components.timeline (style2)">
        <Timeline data={{ ...timelineData, id: 152, style: 'style2' }} />
      </Section>

      <Section title="components.timeline (style2, collapsible)">
        <Timeline data={{ ...timelineData, id: 153, style: 'style2', collapsible: true }} />
      </Section>

      <Section title="components.section-divider">
        <SectionDivider data={dividerData} />
        <SectionDivider data={{ ...dividerData, id: 161, style: 'dashed' }} />
        <SectionDivider data={{ ...dividerData, id: 162, style: 'dotted' }} />
      </Section>

      <Section title="components.slider">
        <Slider data={sliderData} />
      </Section>

      <Section title="components.gallery-slider">
        <GallerySlider data={gallerySliderData} />
      </Section>

      <Section title="components.photo-gallery">
        <PhotoGallery data={photoGalleryData} />
      </Section>

      <Section title="components.button-group">
        <ButtonGroup data={buttonGroupData} />
        <ButtonGroup data={{ ...buttonGroupData, id: 211, alignment: 'C' }} />
        <ButtonGroup data={{ ...buttonGroupData, id: 212, alignment: 'R' }} />
      </Section>

      <Section title="components.contact-cards">
        <ContactCards data={contactCardsData} />
      </Section>

      <Section title="components.accordion-sections">
        <AccordionSections data={accordionData} />
      </Section>

      <Section title="components.badges">
        <Badges data={badgesData} />
      </Section>

      <Section title="components.image">
        <ImageBlock data={imageData} />
      </Section>

      <Section title="components.news-articles">
        <p className="text-sm text-primary/60 italic">
          This component requires server-side data fetching from Strapi and cannot be previewed with mock data in this client component.
          Create a page in Strapi with this component to test it.
        </p>
      </Section>
    </div>
  );
}
