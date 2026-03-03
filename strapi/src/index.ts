import type { Core } from '@strapi/strapi';

const CATEGORIES = [
  { name: 'Muži A', slug: 'muzi-a', sortOrder: 1 },
  { name: 'Muži B', slug: 'muzi-b', sortOrder: 2 },
  { name: 'Dorost U16', slug: 'dorost-u16', sortOrder: 3 },
  { name: 'Dorost U17', slug: 'dorost-u17', sortOrder: 4 },
  { name: 'Dorost U18', slug: 'dorost-u18', sortOrder: 5 },
  { name: 'Dorost U19', slug: 'dorost-u19', sortOrder: 6 },
  { name: 'Žáci U12', slug: 'zaci-u12', sortOrder: 7 },
  { name: 'Žáci U13', slug: 'zaci-u13', sortOrder: 8 },
  { name: 'Žáci U14', slug: 'zaci-u14', sortOrder: 9 },
  { name: 'Žáci U15', slug: 'zaci-u15', sortOrder: 10 },
  { name: 'Přípravka U8', slug: 'pripravka-u8', sortOrder: 11 },
  { name: 'Přípravka U9', slug: 'pripravka-u9', sortOrder: 12 },
  { name: 'Přípravka U10', slug: 'pripravka-u10', sortOrder: 13 },
  { name: 'Přípravka U11', slug: 'pripravka-u11', sortOrder: 14 },
  { name: 'Školička', slug: 'skolicka', sortOrder: 15 },
  { name: 'Ženy A', slug: 'zeny-a', sortOrder: 16 },
  { name: 'Žákyně Mladší', slug: 'zakyne-mladsi', sortOrder: 17 },
  { name: 'Žákyně Starší', slug: 'zakyne-starsi', sortOrder: 18 },
  { name: 'Žákyně Přípravka', slug: 'zakyne-pripravka', sortOrder: 19 },
];

async function seedCategories(strapi: Core.Strapi) {
  const existingCategories = await strapi.documents('api::category.category').findMany({
    limit: 1,
  });

  if (existingCategories.length > 0) {
    strapi.log.info('Categories already seeded, skipping...');
    return;
  }

  strapi.log.info('Seeding categories...');

  for (const category of CATEGORIES) {
    await strapi.documents('api::category.category').create({
      data: category,
    });
  }

  strapi.log.info(`Successfully seeded ${CATEGORIES.length} categories`);
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedCategories(strapi);
  },
};
