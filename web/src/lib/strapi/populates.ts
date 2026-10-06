// `updatedAt` versions the URL (`?v=`, mappers/shared.ts) so a replaced file gets a new one.
const mediaFields = { fields: ['url', 'alternativeText', 'width', 'height', 'name', 'ext', 'size', 'updatedAt'] };

const textLinkPopulate = {
  populate: {
    page: { fields: ['slug'] },
    file: mediaFields,
  },
};

const buttonPopulate = {
  populate: {
    link: textLinkPopulate,
  },
};

const documentItemPopulate = {
  populate: {
    file: mediaFields,
  },
};

const photoPopulate = {
  populate: {
    image: mediaFields,
  },
};

const slidePopulate = {
  populate: {
    link: textLinkPopulate,
    image: mediaFields,
    background_image: mediaFields,
  },
};

const contactCardPopulate = {
  populate: {
    photo: mediaFields,
  },
};

const expandableSectionPopulate = {
  populate: {
    files: documentItemPopulate,
    photos: photoPopulate,
    contacts: contactCardPopulate,
  },
};

const featureCardPopulate = {
  populate: {
    icon: mediaFields,
    link: textLinkPopulate,
  },
};

const bannerCardPopulate = {
  populate: {
    link: textLinkPopulate,
  },
};

const partnerLogoPopulate = {
  populate: {
    logo: mediaFields,
  },
};

function buildDynamicZonePopulate() {
  return {
    on: {
      'components.text': { populate: '*' },
      'components.heading': { populate: '*' },
      'components.alert': { populate: '*' },
      'components.links-list': {
        populate: {
          links: textLinkPopulate,
        },
      },
      'components.video': { populate: '*' },
      'components.feature-cards': {
        populate: {
          cards: featureCardPopulate,
        },
      },
      'components.banner-cards': {
        populate: {
          cards: bannerCardPopulate,
        },
      },
      'components.documents': {
        populate: {
          documents: documentItemPopulate,
        },
      },
      'components.partner-logos': {
        populate: {
          partners: partnerLogoPopulate,
        },
      },
      'components.stats-highlights': {
        populate: {
          items: { populate: '*' },
        },
      },
      'components.timeline': {
        populate: {
          items: { populate: '*' },
        },
      },
      'components.section-divider': { populate: '*' },
      'components.slider': {
        populate: {
          slides: slidePopulate,
        },
      },
      'components.gallery-slider': {
        populate: {
          photos: photoPopulate,
        },
      },
      'components.photo-gallery': {
        populate: {
          photos: photoPopulate,
        },
      },
      'components.button-group': {
        populate: {
          buttons: buttonPopulate,
        },
      },
      'components.contact-cards': {
        populate: {
          cards: contactCardPopulate,
        },
      },
      'components.accordion-sections': {
        populate: {
          sections: expandableSectionPopulate,
        },
      },
      'components.popup': {
        populate: {
          link: textLinkPopulate,
        },
      },
      'components.badges': {
        populate: {
          badges: { populate: '*' },
        },
      },
      'components.image': {
        populate: {
          image: mediaFields,
        },
      },
      'components.news-articles': {
        populate: {
          categories: { fields: ['name', 'slug'] },
          news_article_type: { fields: ['name', 'slug'] },
          show_all_link: textLinkPopulate,
        },
      },
      'components.form': {
        populate: {
          form: {
            populate: {
              inputGroups: {
                populate: {
                  inputs: { populate: '*' },
                },
              },
            },
          },
          recipients: { populate: '*' },
        },
      },
    },
  };
}

function buildParentPopulate(depth: number): Record<string, unknown> {
  if (depth <= 1) {
    return { parent: { fields: ['title', 'slug'] } };
  }
  return { parent: { fields: ['title', 'slug'], populate: buildParentPopulate(depth - 1) } };
}

export function buildPagePopulate() {
  return {
    content: buildDynamicZonePopulate(),
    sidebar: buildDynamicZonePopulate(),
    ...buildParentPopulate(5),
  };
}

/** The dynamic-zone component types a page actually has (from the shallow first step of the load). */
export interface PageComponentTypes {
  content: readonly string[];
  sidebar: readonly string[];
}

/**
 * The page populate narrowed to the component types the page has: its fragments only, in the
 * full populate's order, and an empty zone as `true` in its own position — so Strapi answers byte
 * for byte what the full populate answers (verified on prod for all 23 pages, 2026-10-06), at a
 * fraction of the cost: Strapi spends ~90% of a full page query (~400 ms, serialized on its one
 * event loop) on the 50 fragments, not on data. `null` when a type has no fragment here: the
 * caller uses the full populate (same answer by construction).
 */
export function buildPagePopulateFor(used: PageComponentTypes) {
  const content = narrowDynamicZone(used.content);
  const sidebar = narrowDynamicZone(used.sidebar);
  if (content === null || sidebar === null) return null;
  return { content, sidebar, ...buildParentPopulate(5) };
}

function narrowDynamicZone(types: readonly string[]): true | { on: Record<string, unknown> } | null {
  const { on } = buildDynamicZonePopulate();
  if (types.some((type) => !Object.hasOwn(on, type))) return null;
  if (types.length === 0) return true; // keeps `zone: []` in the answer
  return { on: Object.fromEntries(Object.entries(on).filter(([type]) => types.includes(type))) };
}

export function buildPartnerPopulate() {
  const dz = buildDynamicZonePopulate();
  return {
    logo: mediaFields,
    partnerCategory: { fields: ['name'] },
    content: dz,
    panel: dz,
  };
}

export function buildFooterPopulate() {
  return {
    linkSections: {
      populate: {
        links: textLinkPopulate,
      },
    },
    bottomLinks: textLinkPopulate,
    partnerSections: {
      populate: {
        partners: {
          populate: {
            logo: mediaFields,
          },
        },
      },
    },
  };
}

export function buildNavigationPopulate() {
  return {
    link: {
      populate: {
        page: { fields: ['slug'] },
        file: mediaFields,
      },
    },
  };
}
