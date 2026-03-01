import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/strapi-client',
      'api',
      'presentation',
      'nextjs',
    ],
  },
});
