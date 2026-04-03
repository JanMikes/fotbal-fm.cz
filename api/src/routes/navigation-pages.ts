import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { strapiGet } from '../lib/strapi.js';

interface StrapiRawPage {
  id: number;
  documentId: string;
  title: string;
  slug: string;
}

const NavigationPageSchema = z.object({
  title: z.string(),
  slug: z.string(),
});

const route = createRoute({
  method: 'get',
  path: '/navigation-pages',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(NavigationPageSchema),
          }),
        },
      },
      description: 'List of pages shown in categories navigation',
    },
  },
});

export const navigationPagesRoute = new OpenAPIHono();

navigationPagesRoute.openapi(route, async (c) => {
  const result = await strapiGet<StrapiRawPage>('/pages', {
    filters: { show_in_categories_nav: { $eq: true } },
    fields: ['title', 'slug'],
    pagination: { pageSize: 100 },
  });

  const data = result.data.map((page) => ({
    title: page.title,
    slug: page.slug,
  }));

  return c.json({ data });
});
