const mediaFields = { fields: ['url', 'alternativeText', 'width', 'height', 'name', 'ext', 'size'] };

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

const expandableSectionPopulate = {
  populate: {
    files: documentItemPopulate,
    photos: photoPopulate,
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

const contactCardPopulate = {
  populate: {
    photo: mediaFields,
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
          show_all_link: textLinkPopulate,
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

export function buildPartnerPopulate() {
  const dz = buildDynamicZonePopulate();
  return {
    logo: mediaFields,
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
