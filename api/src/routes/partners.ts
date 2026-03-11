import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiGet } from '../lib/strapi.js';
import { PartnerSummarySchema, PartnerDetailSchema } from '../schemas/partner.js';
import { mapPartnerSummary, mapPartnerDetail } from '../mappers/partner.js';
import type { StrapiRawPartner } from '../types/strapi.js';

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
        },
      },
    },
  };
}

const listRoute = createRoute({
  method: 'get',
  path: '/partners',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(PartnerSummarySchema),
          }),
        },
      },
      description: 'List of partners',
    },
  },
});

const detailRoute = createRoute({
  method: 'get',
  path: '/partners/{slug}',
  request: {
    params: z.object({
      slug: z.string().openapi({ description: 'Partner slug' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: PartnerDetailSchema,
          }),
        },
      },
      description: 'Partner detail with dynamic zone content',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: 'Partner not found',
    },
  },
});

export const partnersRoute = new OpenAPIHono();

partnersRoute.openapi(listRoute, async (c) => {
  const result = await strapiGet<StrapiRawPartner>('/partners', {
    sort: 'sortOrder:asc',
    pagination: { pageSize: 100 },
    populate: {
      logo: { fields: ['url', 'alternativeText', 'width', 'height'] },
      partnerCategory: { fields: ['name'] },
    },
  });

  const data = result.data.map(mapPartnerSummary);
  return c.json({ data });
});

partnersRoute.openapi(detailRoute, async (c) => {
  const { slug } = c.req.valid('param');

  const dz = buildDynamicZonePopulate();
  const result = await strapiGet<StrapiRawPartner>('/partners', {
    filters: { slug: { $eq: slug } },
    pagination: { pageSize: 1 },
    populate: {
      logo: { fields: ['url', 'alternativeText', 'width', 'height'] },
      partnerCategory: { fields: ['name'] },
      content: dz,
      panel: dz,
    },
  });

  const partner = result.data[0];
  if (!partner) {
    return c.json({ error: 'Partner not found' }, 404);
  }

  return c.json({ data: mapPartnerDetail(partner) }, 200);
});
