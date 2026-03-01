import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'strapi-client',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
