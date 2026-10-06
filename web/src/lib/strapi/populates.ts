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

/**
 * A populate narrowed to the dynamic-zone component types a record actually has: for each zone in
 * `used`, only its fragments (in the full populate's order), an empty zone as `true` in its own
 * position, every other key unchanged and in place — so Strapi answers byte for byte what the full
 * populate answers (verified on prod for all 23 pages and 3 partners, 2026-10-06) at a fraction of
 * the cost: ~90% of a full page/partner query (~400 ms of Strapi CPU, serialized on its single
 * event loop) goes to the 50 unused fragments, not to data. `null` when a zone has a type this
 * populate has no fragment for: the caller uses the full populate (same answer by construction).
 */
export function narrowDynamicZones(
  full: Record<string, unknown>,
  used: Record<string, readonly string[]>,
): Record<string, unknown> | null {
  const narrowed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(full)) {
    const types = used[key];
    if (!types) {
      narrowed[key] = value;
      continue;
    }
    const on = (value as { on?: Record<string, unknown> }).on;
    if (!on || types.some((type) => !Object.hasOwn(on, type))) return null;
    narrowed[key] = types.length === 0 ? true : { on: Object.fromEntries(Object.entries(on).filter(([type]) => types.includes(type))) };
  }
  return narrowed;
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
