import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/strapi-client',
      'packages/cache',
      'api',
      'web',
      'backoffice',
      // Strapi is not an npm workspace and has no vitest of its own; its tests import only
      // ioredis (resolved from the root node_modules) and are excluded from Strapi's tsc.
      {
        test: {
          name: 'strapi',
          root: 'strapi',
          include: ['src/__tests__/**/*.test.ts'],
        },
      },
    ],
  },
});
