import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/config', () => ({
  config: {
    strapi: { url: 'http://strapi:1337', apiToken: 'test-token' },
    publicUploadsUrl: 'http://uploads.test',
    internalUploadsUrl: 'http://uploads.test',
  },
}));

import { mapPage } from '@/lib/strapi/mappers/page';
import type { StrapiRawPage } from '@/lib/strapi/types';

describe('mapPage', () => {
  it('maps basic page fields', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'O klubu',
      slug: 'o-klubu',
      meta_description: 'Popis stránky',
      parent: null,
      content: [],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.documentId).toBe('page-1');
    expect(result.title).toBe('O klubu');
    expect(result.slug).toBe('o-klubu');
    expect(result.metaDescription).toBe('Popis stránky');
    expect(result.breadcrumbs).toEqual([{ label: 'O klubu', href: '/o-klubu' }]);
    expect(result.content).toEqual([]);
    expect(result.sidebar).toEqual([]);
  });

  it('builds breadcrumbs from parent chain', () => {
    const raw: StrapiRawPage = {
      id: 3,
      documentId: 'page-3',
      title: 'Kontakty',
      slug: 'kontakty',
      meta_description: null,
      parent: {
        id: 2,
        documentId: 'page-2',
        title: 'O klubu',
        slug: 'o-klubu',
        parent: {
          id: 1,
          documentId: 'page-1',
          title: 'Klub',
          slug: 'klub',
          parent: null,
        },
      },
      content: [],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.breadcrumbs).toEqual([
      { label: 'Klub', href: '/klub' },
      { label: 'O klubu', href: '/o-klubu' },
      { label: 'Kontakty', href: '/kontakty' },
    ]);
  });

  it('maps null meta_description to null', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [],
      sidebar: null,
    };

    expect(mapPage(raw).metaDescription).toBeNull();
  });

  it('maps text component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 10,
          __component: 'components.text',
          text: '<p>Hello</p>',
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].__component).toBe('components.text');
    expect((result.content[0] as { text: string | null }).text).toBe('<p>Hello</p>');
  });

  it('maps heading component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 20,
          __component: 'components.heading',
          text: 'Title',
          type: 'h2',
          anchor: 'section',
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(1);
    const heading = result.content[0] as { text: string; type: string; anchor: string };
    expect(heading.__component).toBe('components.heading');
    expect(heading.text).toBe('Title');
    expect(heading.type).toBe('h2');
    expect(heading.anchor).toBe('section');
  });

  it('maps alert component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 30,
          __component: 'components.alert',
          type: 'warning',
          title: 'Pozor',
          text: '<p>Warning text</p>',
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(1);
    const alert = result.content[0] as { type: string; title: string; text: string };
    expect(alert.__component).toBe('components.alert');
    expect(alert.type).toBe('warning');
    expect(alert.title).toBe('Pozor');
  });

  it('maps feature-cards component with nested links', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 40,
          __component: 'components.feature-cards',
          cards: [
            {
              title: 'Card 1',
              description: 'Desc',
              link: {
                id: 100,
                text: 'More',
                page: { slug: 'detail' },
                anchor: null,
                url: null,
                file: null,
                disabled: false,
              },
            },
          ],
          columns: '3',
          card_clickable: true,
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(1);
    const cards = result.content[0] as { cards: Array<{ title: string; link: { href: string } }> };
    expect(cards.cards).toHaveLength(1);
    expect(cards.cards[0].title).toBe('Card 1');
    expect(cards.cards[0].link.href).toBe('/detail');
  });

  it('maps documents with file media', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 50,
          __component: 'components.documents',
          documents: [
            {
              name: 'Doc',
              file: {
                url: '/uploads/doc.pdf',
                alternativeText: null,
                width: 0,
                height: 0,
                name: 'doc.pdf',
              },
            },
          ],
          columns: '2',
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const docs = result.content[0] as { documents: Array<{ name: string; file: { url: string } }> };
    expect(docs.documents[0].name).toBe('Doc');
    expect(docs.documents[0].file.url).toBe('http://uploads.test/uploads/doc.pdf');
  });

  it('maps sidebar components', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        { id: 10, __component: 'components.text', text: 'Main' },
      ],
      sidebar: [
        { id: 20, __component: 'components.text', text: 'Side' },
        { id: 30, __component: 'components.heading', text: 'Side heading', type: 'h3', anchor: null },
      ],
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(1);
    expect(result.sidebar).toHaveLength(2);
    expect(result.sidebar[0].__component).toBe('components.text');
    expect(result.sidebar[1].__component).toBe('components.heading');
  });

  it('filters out unknown components', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        { id: 10, __component: 'components.text', text: 'Known' },
        { id: 11, __component: 'components.unknown-widget', data: 'foo' },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].__component).toBe('components.text');
  });

  it('maps section-divider component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        { id: 60, __component: 'components.section-divider', spacing: 'L', style: 'dashed' },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const divider = result.content[0] as { spacing: string; style: string };
    expect(divider.spacing).toBe('L');
    expect(divider.style).toBe('dashed');
  });

  it('maps contact-cards component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 70,
          __component: 'components.contact-cards',
          cards: [
            { name: 'Jan', role: 'Coach', phone: '+420111', email: 'jan@test.cz', photo: null },
          ],
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const contacts = result.content[0] as { cards: Array<{ name: string; role: string }> };
    expect(contacts.cards[0].name).toBe('Jan');
    expect(contacts.cards[0].role).toBe('Coach');
  });

  it('maps badges component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 80,
          __component: 'components.badges',
          badges: [{ label: 'MSFL', variant: 'primary', size: 'M' }],
          alignment: 'C',
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const badges = result.content[0] as { badges: Array<{ label: string }>; alignment: string };
    expect(badges.badges[0].label).toBe('MSFL');
    expect(badges.alignment).toBe('C');
  });

  it('maps video component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        { id: 90, __component: 'components.video', youtube_id: 'abc123', aspect_ratio: '4:3' },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const video = result.content[0] as { youtube_id: string; aspect_ratio: string };
    expect(video.youtube_id).toBe('abc123');
    expect(video.aspect_ratio).toBe('4:3');
  });

  it('maps image component with media transform', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 100,
          __component: 'components.image',
          image: { url: '/uploads/photo.jpg', alternativeText: 'Photo', width: 800, height: 600, name: 'photo.jpg' },
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const img = result.content[0] as { image: { url: string } };
    expect(img.image.url).toBe('http://uploads.test/uploads/photo.jpg');
  });

  it('maps timeline component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 110,
          __component: 'components.timeline',
          items: [
            { number: '1920', title: 'Founded', description: 'Club was founded' },
          ],
          collapsible: true,
          style: 'style2',
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const timeline = result.content[0] as { items: Array<{ number: string; title: string }>; collapsible: boolean; style: string };
    expect(timeline.items[0].number).toBe('1920');
    expect(timeline.items[0].title).toBe('Founded');
    expect(timeline.collapsible).toBe(true);
    expect(timeline.style).toBe('style2');
  });

  it('maps timeline component with defaults', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 111,
          __component: 'components.timeline',
          items: [
            { number: '2000', title: 'Milestone', description: 'Something happened' },
          ],
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const timeline = result.content[0] as { collapsible: boolean; style: string };
    expect(timeline.collapsible).toBe(false);
    expect(timeline.style).toBe('style1');
  });

  it('maps accordion-sections component', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        {
          id: 120,
          __component: 'components.accordion-sections',
          sections: [
            {
              title: 'FAQ',
              description: '<p>Answer</p>',
              default_open: true,
              files: [],
              photos: [],
            },
          ],
        },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    const accordion = result.content[0] as { sections: Array<{ title: string; default_open: boolean }> };
    expect(accordion.sections[0].title).toBe('FAQ');
    expect(accordion.sections[0].default_open).toBe(true);
  });

  it('provides defaults for missing optional fields', () => {
    const raw: StrapiRawPage = {
      id: 1,
      documentId: 'page-1',
      title: 'Test',
      slug: 'test',
      meta_description: null,
      parent: null,
      content: [
        { id: 10, __component: 'components.heading', text: null, type: undefined, anchor: undefined },
        { id: 20, __component: 'components.alert', type: undefined, title: undefined, text: undefined },
        { id: 30, __component: 'components.section-divider', spacing: undefined, style: undefined },
      ],
      sidebar: null,
    };

    const result = mapPage(raw);
    expect(result.content).toHaveLength(3);

    const heading = result.content[0] as { type: string; anchor: string | null };
    expect(heading.type).toBe('h2');
    expect(heading.anchor).toBeNull();

    const alert = result.content[1] as { type: string };
    expect(alert.type).toBe('info');

    const divider = result.content[2] as { spacing: string; style: string };
    expect(divider.spacing).toBe('M');
    expect(divider.style).toBe('solid');
  });
});
