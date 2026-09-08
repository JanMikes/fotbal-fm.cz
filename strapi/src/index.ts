import type { Core } from '@strapi/strapi';
import { registerCacheMiddleware, connectCacheRedis } from './cache-invalidation';

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

async function setPlayerMainField(strapi: Core.Strapi) {
  const storeKey = 'plugin_content_manager_configuration_content_types::api::player.player';
  const config = await strapi.store.get({ key: storeKey }) as Record<string, unknown> | null;

  if (config && (config as any).settings?.mainField === 'displayName') return;

  const settings = (config as any)?.settings || {};
  const updated = {
    ...config,
    settings: { ...settings, mainField: 'displayName' },
  };

  await strapi.store.set({ key: storeKey, value: updated });
  strapi.log.info('Set Player mainField to displayName');
}

async function backfillPlayerDisplayNames(strapi: Core.Strapi) {
  const players = await strapi.db.query('api::player.player').findMany({
    where: { displayName: null },
    select: ['id', 'name', 'number'],
  });

  if (players.length === 0) return;

  strapi.log.info(`Backfilling displayName for ${players.length} players...`);

  for (const player of players) {
    const displayName = player.number ? `${player.name} (#${player.number})` : player.name;
    await strapi.db.query('api::player.player').update({
      where: { id: player.id },
      data: { displayName },
    });
  }

  strapi.log.info('Player displayName backfill complete');
}

/**
 * Content-API permissions that must stay OFF no matter what is clicked in the admin.
 * users-permissions stores an enabled action as a row, so deleting the row disables it.
 * The remaining user actions (find/findOne/update/me) stay enabled for the backoffice
 * and are ownership-guarded in src/extensions/users-permissions/strapi-server.ts.
 */
const USER_PERMISSION_DENYLIST: Array<{ roleType: string; action: string; reason: string }> = [
  {
    roleType: 'public',
    action: 'plugin::users-permissions.user.create',
    reason: 'anyone could create accounts (with any role) bypassing registration',
  },
  {
    roleType: 'authenticated',
    action: 'plugin::users-permissions.user.count',
    reason: 'members have no business counting accounts',
  },
];

async function enforceUserPermissionPolicy(strapi: Core.Strapi) {
  for (const rule of USER_PERMISSION_DENYLIST) {
    const role = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: rule.roleType },
      select: ['id'],
    });
    if (!role) continue;

    const result = await strapi.db.query('plugin::users-permissions.permission').deleteMany({
      where: { action: rule.action, role: { id: role.id } },
    });
    if (result.count > 0) {
      strapi.log.warn(`[Permissions] Removed ${rule.action} from role "${rule.roleType}" — ${rule.reason}`);
    }
  }
}

let cleanupCache: (() => Promise<void>) | null = null;

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    registerCacheMiddleware(strapi);
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedCategories(strapi);
    await backfillPlayerDisplayNames(strapi);
    await setPlayerMainField(strapi);
    await enforceUserPermissionPolicy(strapi);
    cleanupCache = connectCacheRedis(strapi);
  },

  async destroy() {
    if (cleanupCache) {
      await cleanupCache();
    }
  },
};
