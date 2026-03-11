import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/strapi.js', () => ({
  strapiGet: vi.fn(),
  strapiGetWithPagination: vi.fn(),
  strapiGetSingleEntry: vi.fn(),
  strapiPost: vi.fn(),
  strapiGetSingle: vi.fn(),
  strapiPut: vi.fn(),
  strapiDelete: vi.fn(),
}));

const { strapiGet } = await import('../../lib/strapi.js');
const { app } = await import('../../app.js');

const img = (id: number, name: string) => ({
  id,
  url: `/uploads/${name}.jpg`,
  alternativeText: name,
  width: 800,
  height: 600,
});

const mockPartners = {
  data: [
    {
      id: 1,
      documentId: 'partner-1',
      name: 'Hlavní sponzor s.r.o.',
      slug: 'hlavni-sponzor',
      logo: img(60, 'sponzor_logo'),
      description: 'Generální partner klubu od roku 2015.',
      sortOrder: 1,
      partnerCategory: { id: 1, documentId: 'pc-1', name: 'Generální partner', sortOrder: 1 },
      content: [],
      panel: null,
    },
    {
      id: 2,
      documentId: 'partner-2',
      name: 'Město Frýdek-Místek',
      slug: 'mesto-frydek-mistek',
      logo: null,
      description: null,
      sortOrder: 2,
      partnerCategory: null,
      content: [],
      panel: null,
    },
  ],
  meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 2 } },
};

// Every single dynamic zone component type, one example each
const allComponents = [
  // 1. text
  {
    id: 1,
    __component: 'components.text',
    text: '<p>Popis partnera s <strong>formátováním</strong>.</p>',
  },
  // 2. heading
  {
    id: 2,
    __component: 'components.heading',
    text: 'Nadpis sekce',
    type: 'h3',
    anchor: 'nadpis-sekce',
  },
  // 3. alert
  {
    id: 3,
    __component: 'components.alert',
    type: 'warning',
    title: 'Upozornění',
    text: 'Toto je důležité upozornění.',
  },
  // 4. links-list (page link + external URL)
  {
    id: 4,
    __component: 'components.links-list',
    links: [
      { text: 'Interní stránka', disabled: false, page: { slug: 'o-nas' }, url: null, file: null, anchor: null },
      { text: 'Web partnera', disabled: false, page: null, url: 'https://partner.cz', file: null, anchor: null },
      { text: 'Stáhnout PDF', disabled: false, page: null, url: null, file: img(70, 'dokument'), anchor: null },
      { text: 'Sekce', disabled: true, page: null, url: null, file: null, anchor: 'kontakt' },
    ],
    layout: 'Grid',
  },
  // 5. video
  {
    id: 5,
    __component: 'components.video',
    youtube_id: 'dQw4w9WgXcQ',
    aspect_ratio: '4:3',
  },
  // 6. feature-cards
  {
    id: 6,
    __component: 'components.feature-cards',
    cards: [
      { title: 'Karta 1', description: 'Popis karty', link: { text: 'Více', disabled: false, page: { slug: 'detail' }, url: null, file: null, anchor: null } },
      { title: 'Karta 2', description: null, link: null },
    ],
    columns: '2',
    card_clickable: true,
  },
  // 7. banner-cards
  {
    id: 7,
    __component: 'components.banner-cards',
    cards: [
      { title: 'Banner', description: 'Popis banneru', link: { text: 'Odkaz', disabled: false, page: null, url: 'https://example.com', file: null, anchor: null } },
    ],
  },
  // 8. documents
  {
    id: 8,
    __component: 'components.documents',
    documents: [
      { name: 'Stanovy klubu', file: img(71, 'stanovy') },
      { name: 'Rozpočet', file: null },
    ],
    columns: '2',
  },
  // 9. partner-logos
  {
    id: 9,
    __component: 'components.partner-logos',
    partners: [
      { name: 'Nike', logo: img(72, 'nike_logo'), url: 'https://nike.com' },
      { name: 'Adidas', logo: null, url: null },
    ],
    grayscale: true,
    columns: '5',
  },
  // 10. stats-highlights
  {
    id: 10,
    __component: 'components.stats-highlights',
    items: [
      { number: '25', title: 'Let spolupráce', description: 'Od roku 2000' },
      { number: '1M', title: 'Kč ročně', description: null },
    ],
    columns: '3',
  },
  // 11. timeline
  {
    id: 11,
    __component: 'components.timeline',
    items: [
      { number: '2000', title: 'Zahájení spolupráce', description: 'První smlouva podepsána.' },
      { number: '2015', title: 'Generální partner', description: null },
    ],
  },
  // 12. section-divider
  {
    id: 12,
    __component: 'components.section-divider',
    spacing: 'L',
    style: 'dashed',
  },
  // 13. slider
  {
    id: 13,
    __component: 'components.slider',
    slides: [
      {
        title: 'Slide 1',
        description: 'Popis slidu',
        link: { text: 'Více', disabled: false, page: null, url: 'https://example.com/slide', file: null, anchor: null },
        image: img(73, 'slide_1'),
        background_image: img(74, 'slide_1_bg'),
      },
      {
        title: null,
        description: null,
        link: null,
        image: null,
        background_image: null,
      },
    ],
    autoplay: true,
    autoplay_interval: 3000,
  },
  // 14. gallery-slider
  {
    id: 14,
    __component: 'components.gallery-slider',
    photos: [
      { image: img(75, 'gallery_1') },
      { image: img(76, 'gallery_2') },
    ],
  },
  // 15. photo-gallery
  {
    id: 15,
    __component: 'components.photo-gallery',
    photos: [
      { image: img(77, 'photo_1') },
    ],
    columns: '4',
  },
  // 16. button-group
  {
    id: 16,
    __component: 'components.button-group',
    buttons: [
      { link: { text: 'Hlavní akce', disabled: false, page: { slug: 'akce' }, url: null, file: null, anchor: null }, variant: 'Primary', size: 'L' },
      { link: { text: 'Sekundární', disabled: false, page: null, url: 'https://ext.cz', file: null, anchor: null }, variant: 'Outline', size: 'M' },
    ],
    alignment: 'C',
  },
  // 17. contact-cards
  {
    id: 17,
    __component: 'components.contact-cards',
    cards: [
      { name: 'Jan Manažer', role: 'Ředitel', phone: '+420 123 456 789', email: 'jan@sponzor.cz', photo: img(62, 'jan_manazer') },
      { name: 'Eva Nová', role: null, phone: null, email: null, photo: null },
    ],
  },
  // 18. accordion-sections
  {
    id: 18,
    __component: 'components.accordion-sections',
    sections: [
      {
        title: 'Často kladené dotazy',
        description: '<p>Odpovědi na dotazy.</p>',
        default_open: true,
        files: [{ name: 'FAQ.pdf', file: img(78, 'faq') }],
        photos: [{ image: img(79, 'faq_photo') }],
      },
      {
        title: 'Prázdná sekce',
        description: null,
        default_open: false,
        files: [],
        photos: [],
      },
    ],
  },
  // 19. badges
  {
    id: 19,
    __component: 'components.badges',
    badges: [
      { label: 'Premium', variant: 'primary', size: 'L' },
      { label: 'Nový', variant: 'success', size: 'S' },
    ],
    alignment: 'R',
  },
  // 20. image
  {
    id: 20,
    __component: 'components.image',
    image: img(80, 'partner_photo'),
  },
  // 21. news-articles
  {
    id: 21,
    __component: 'components.news-articles',
    categories: [
      { id: 1, documentId: 'cat-1', name: 'A-tým', slug: 'a-tym', sortOrder: 1 },
    ],
    limit: 4,
  },
  // 22. unknown component (should be filtered out)
  {
    id: 99,
    __component: 'components.some-future-component',
    data: 'whatever',
  },
];

const mockPartnerAllComponents = {
  data: [
    {
      id: 1,
      documentId: 'partner-full',
      name: 'Test Partner',
      slug: 'test-partner',
      logo: img(60, 'logo'),
      description: 'Full test',
      sortOrder: 1,
      partnerCategory: null,
      content: allComponents,
      panel: [],
    },
  ],
  meta: {},
};

const url = (name: string) => `http://localhost:8080/uploads/${name}.jpg`;

describe('GET /api/v1/partners', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns partner list with logos', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockPartners);

    const res = await app.request('/api/v1/partners');
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data).toHaveLength(2);
    expect(json.data[0]).toEqual({
      documentId: 'partner-1',
      name: 'Hlavní sponzor s.r.o.',
      slug: 'hlavni-sponzor',
      logo: { url: url('sponzor_logo'), alternativeText: 'sponzor_logo', width: 800, height: 600 },
      description: '<p>Generální partner klubu od roku 2015.</p>\n',
      sortOrder: 1,
      partnerCategory: { name: 'Generální partner' },
    });
    expect(json.data[1].logo).toBeNull();
    expect(json.data[1].description).toBeNull();
    expect(json.data[1].partnerCategory).toBeNull();
  });
});

describe('GET /api/v1/partners/:slug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 for non-existent partner', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce({ data: [], meta: {} });

    const res = await app.request('/api/v1/partners/nonexistent');
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Partner not found');
  });

  it('maps all dynamic zone component types', async () => {
    vi.mocked(strapiGet).mockResolvedValueOnce(mockPartnerAllComponents);

    const res = await app.request('/api/v1/partners/test-partner');
    expect(res.status).toBe(200);

    const json = await res.json();
    const content = json.data.content;

    // Unknown component filtered out: 22 input -> 21 output
    expect(content).toHaveLength(21);

    // 1. text
    const text = content.find((c: any) => c.__component === 'components.text');
    expect(text).toEqual({
      id: 1,
      __component: 'components.text',
      text: '<p>Popis partnera s <strong>formátováním</strong>.</p>',
    });

    // 2. heading
    const heading = content.find((c: any) => c.__component === 'components.heading');
    expect(heading).toEqual({
      id: 2,
      __component: 'components.heading',
      text: 'Nadpis sekce',
      type: 'h3',
      anchor: 'nadpis-sekce',
    });

    // 3. alert
    const alert = content.find((c: any) => c.__component === 'components.alert');
    expect(alert).toEqual({
      id: 3,
      __component: 'components.alert',
      type: 'warning',
      title: 'Upozornění',
      text: '<p>Toto je důležité upozornění.</p>\n',
    });

    // 4. links-list (4 link types: page, external url, file, anchor)
    const linksList = content.find((c: any) => c.__component === 'components.links-list');
    expect(linksList.layout).toBe('Grid');
    expect(linksList.links).toHaveLength(4);
    expect(linksList.links[0]).toEqual({ href: '/o-nas', external: false, text: 'Interní stránka', disabled: false });
    expect(linksList.links[1]).toEqual({ href: 'https://partner.cz', external: true, text: 'Web partnera', disabled: false });
    expect(linksList.links[2]).toEqual({ href: url('dokument'), external: true, text: 'Stáhnout PDF', disabled: false });
    expect(linksList.links[3]).toEqual({ href: '#kontakt', external: false, text: 'Sekce', disabled: true });

    // 5. video
    const video = content.find((c: any) => c.__component === 'components.video');
    expect(video).toEqual({
      id: 5,
      __component: 'components.video',
      youtube_id: 'dQw4w9WgXcQ',
      aspect_ratio: '4:3',
    });

    // 6. feature-cards
    const featureCards = content.find((c: any) => c.__component === 'components.feature-cards');
    expect(featureCards.columns).toBe('2');
    expect(featureCards.card_clickable).toBe(true);
    expect(featureCards.cards).toHaveLength(2);
    expect(featureCards.cards[0].title).toBe('Karta 1');
    expect(featureCards.cards[0].description).toBe('<p>Popis karty</p>\n');
    expect(featureCards.cards[0].link).toEqual({ href: '/detail', external: false, text: 'Více', disabled: false });
    expect(featureCards.cards[1].link).toBeNull();

    // 7. banner-cards
    const bannerCards = content.find((c: any) => c.__component === 'components.banner-cards');
    expect(bannerCards.cards).toHaveLength(1);
    expect(bannerCards.cards[0].title).toBe('Banner');
    expect(bannerCards.cards[0].description).toBe('<p>Popis banneru</p>\n');
    expect(bannerCards.cards[0].link.href).toBe('https://example.com');
    expect(bannerCards.cards[0].link.external).toBe(true);

    // 8. documents
    const docs = content.find((c: any) => c.__component === 'components.documents');
    expect(docs.columns).toBe('2');
    expect(docs.documents).toHaveLength(2);
    expect(docs.documents[0].name).toBe('Stanovy klubu');
    expect(docs.documents[0].file.url).toBe(url('stanovy'));
    expect(docs.documents[1].file).toBeNull();

    // 9. partner-logos
    const partnerLogos = content.find((c: any) => c.__component === 'components.partner-logos');
    expect(partnerLogos.grayscale).toBe(true);
    expect(partnerLogos.columns).toBe('5');
    expect(partnerLogos.partners).toHaveLength(2);
    expect(partnerLogos.partners[0]).toEqual({ name: 'Nike', logo: { url: url('nike_logo'), alternativeText: 'nike_logo', width: 800, height: 600 }, url: 'https://nike.com' });
    expect(partnerLogos.partners[1].logo).toBeNull();

    // 10. stats-highlights
    const stats = content.find((c: any) => c.__component === 'components.stats-highlights');
    expect(stats.columns).toBe('3');
    expect(stats.items).toHaveLength(2);
    expect(stats.items[0]).toEqual({ number: '25', title: 'Let spolupráce', description: 'Od roku 2000' });
    expect(stats.items[1].description).toBeNull();

    // 11. timeline
    const timeline = content.find((c: any) => c.__component === 'components.timeline');
    expect(timeline.items).toHaveLength(2);
    expect(timeline.items[0]).toEqual({ number: '2000', title: 'Zahájení spolupráce', description: 'První smlouva podepsána.' });

    // 12. section-divider
    const divider = content.find((c: any) => c.__component === 'components.section-divider');
    expect(divider).toEqual({ id: 12, __component: 'components.section-divider', spacing: 'L', style: 'dashed' });

    // 13. slider
    const slider = content.find((c: any) => c.__component === 'components.slider');
    expect(slider.autoplay).toBe(true);
    expect(slider.autoplay_interval).toBe(3000);
    expect(slider.slides).toHaveLength(2);
    expect(slider.slides[0].image.url).toBe(url('slide_1'));
    expect(slider.slides[0].background_image.url).toBe(url('slide_1_bg'));
    expect(slider.slides[0].link.href).toBe('https://example.com/slide');
    expect(slider.slides[1].image).toBeNull();
    expect(slider.slides[1].link).toBeNull();

    // 14. gallery-slider
    const gallerySlider = content.find((c: any) => c.__component === 'components.gallery-slider');
    expect(gallerySlider.photos).toHaveLength(2);
    expect(gallerySlider.photos[0].image.url).toBe(url('gallery_1'));

    // 15. photo-gallery
    const photoGallery = content.find((c: any) => c.__component === 'components.photo-gallery');
    expect(photoGallery.columns).toBe('4');
    expect(photoGallery.photos).toHaveLength(1);
    expect(photoGallery.photos[0].image.url).toBe(url('photo_1'));

    // 16. button-group
    const buttonGroup = content.find((c: any) => c.__component === 'components.button-group');
    expect(buttonGroup.alignment).toBe('C');
    expect(buttonGroup.buttons).toHaveLength(2);
    expect(buttonGroup.buttons[0]).toEqual({ link: { href: '/akce', external: false, text: 'Hlavní akce', disabled: false }, variant: 'Primary', size: 'L' });
    expect(buttonGroup.buttons[1].link.external).toBe(true);

    // 17. contact-cards
    const contactCards = content.find((c: any) => c.__component === 'components.contact-cards');
    expect(contactCards.cards).toHaveLength(2);
    expect(contactCards.cards[0]).toEqual({
      name: 'Jan Manažer', role: 'Ředitel', phone: '+420 123 456 789', email: 'jan@sponzor.cz',
      photo: { url: url('jan_manazer'), alternativeText: 'jan_manazer', width: 800, height: 600 },
    });
    expect(contactCards.cards[1].photo).toBeNull();
    expect(contactCards.cards[1].role).toBeNull();

    // 18. accordion-sections
    const accordion = content.find((c: any) => c.__component === 'components.accordion-sections');
    expect(accordion.sections).toHaveLength(2);
    expect(accordion.sections[0].title).toBe('Často kladené dotazy');
    expect(accordion.sections[0].default_open).toBe(true);
    expect(accordion.sections[0].files[0].file.url).toBe(url('faq'));
    expect(accordion.sections[0].photos[0].image.url).toBe(url('faq_photo'));
    expect(accordion.sections[1].files).toEqual([]);
    expect(accordion.sections[1].photos).toEqual([]);

    // 19. badges
    const badges = content.find((c: any) => c.__component === 'components.badges');
    expect(badges.alignment).toBe('R');
    expect(badges.badges).toHaveLength(2);
    expect(badges.badges[0]).toEqual({ label: 'Premium', variant: 'primary', size: 'L' });
    expect(badges.badges[1]).toEqual({ label: 'Nový', variant: 'success', size: 'S' });

    // 20. image
    const image = content.find((c: any) => c.__component === 'components.image');
    expect(image.image.url).toBe(url('partner_photo'));

    // 21. news-articles
    const newsArticles = content.find((c: any) => c.__component === 'components.news-articles');
    expect(newsArticles.limit).toBe(4);
    expect(newsArticles.categories).toEqual([{ documentId: 'cat-1', name: 'A-tým', slug: 'a-tym' }]);
  });
});
