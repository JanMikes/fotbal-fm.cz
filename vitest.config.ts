import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/strapi-client',
      'packages/cache',
      'api',
      'web',
      'backoffice',
    ],
  },
});
