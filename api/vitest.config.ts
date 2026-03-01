import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
