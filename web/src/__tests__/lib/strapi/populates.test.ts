import { describe, it, expect } from 'vitest';
import { buildPagePopulate, buildNavigationPopulate, buildPartnerPopulate } from '@/lib/strapi/populates';

describe('buildPagePopulate', () => {
  it('returns content and sidebar populate objects', () => {
    const result = buildPagePopulate();
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('sidebar');
  });

  it('content has on syntax for all 23 components', () => {
    const result = buildPagePopulate();
    const on = result.content.on;
    expect(on).toBeDefined();

    const expectedComponents = [
      'components.text',
      'components.heading',
      'components.alert',
      'components.links-list',
      'components.video',
      'components.feature-cards',
      'components.banner-cards',
      'components.documents',
      'components.partner-logos',
      'components.stats-highlights',
      'components.timeline',
      'components.section-divider',
      'components.slider',
      'components.gallery-slider',
      'components.photo-gallery',
      'components.button-group',
      'components.contact-cards',
      'components.accordion-sections',
      'components.popup',
      'components.badges',
      'components.image',
      'components.news-articles',
      'components.form',
    ];

    for (const comp of expectedComponents) {
      expect(on).toHaveProperty(comp);
    }
    expect(Object.keys(on)).toHaveLength(23);
  });

  it('sidebar has same on keys as content', () => {
    const result = buildPagePopulate();
    const contentKeys = Object.keys(result.content.on).sort();
    const sidebarKeys = Object.keys(result.sidebar.on).sort();
    expect(sidebarKeys).toEqual(contentKeys);
  });

  it('documents populate includes file fields', () => {
    const result = buildPagePopulate();
    const docs = result.content.on['components.documents'];
    expect(docs.populate.documents.populate.file.fields).toContain('url');
    expect(docs.populate.documents.populate.file.fields).toContain('name');
  });

  it('feature-cards populate includes link with page', () => {
    const result = buildPagePopulate();
    const cards = result.content.on['components.feature-cards'];
    expect(cards.populate.cards.populate.link.populate).toHaveProperty('page');
  });

  it('slider populate includes image and background_image', () => {
    const result = buildPagePopulate();
    const slider = result.content.on['components.slider'];
    expect(slider.populate.slides.populate).toHaveProperty('image');
    expect(slider.populate.slides.populate).toHaveProperty('background_image');
    expect(slider.populate.slides.populate).toHaveProperty('link');
  });

  it('news-articles populate includes categories', () => {
    const result = buildPagePopulate();
    const news = result.content.on['components.news-articles'];
    expect(news.populate).toHaveProperty('categories');
    expect(news.populate).toHaveProperty('show_all_link');
  });
});

describe('buildNavigationPopulate', () => {
  it('returns link populate with page and file', () => {
    const result = buildNavigationPopulate();
    expect(result).toHaveProperty('link');
    expect(result.link.populate).toHaveProperty('page');
    expect(result.link.populate).toHaveProperty('file');
  });

  it('page populate includes slug field', () => {
    const result = buildNavigationPopulate();
    expect(result.link.populate.page.fields).toContain('slug');
  });

  it('file populate includes url field', () => {
    const result = buildNavigationPopulate();
    expect(result.link.populate.file.fields).toContain('url');
  });
});

describe('buildPartnerPopulate', () => {
  it('returns logo, content, and panel keys', () => {
    const result = buildPartnerPopulate();
    expect(result).toHaveProperty('logo');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('panel');
  });

  it('logo includes media fields', () => {
    const result = buildPartnerPopulate();
    expect(result.logo.fields).toContain('url');
    expect(result.logo.fields).toContain('alternativeText');
  });

  it('content has on syntax for dynamic zone components', () => {
    const result = buildPartnerPopulate();
    expect(result.content.on).toBeDefined();
    expect(result.content.on).toHaveProperty('components.text');
    expect(result.content.on).toHaveProperty('components.heading');
  });

  it('panel has same on keys as content', () => {
    const result = buildPartnerPopulate();
    const contentKeys = Object.keys(result.content.on).sort();
    const panelKeys = Object.keys(result.panel.on).sort();
    expect(panelKeys).toEqual(contentKeys);
  });
});
