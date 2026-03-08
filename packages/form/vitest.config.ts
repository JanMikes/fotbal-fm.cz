import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'form',
    include: ['src/__tests__/**/*.test.ts'],
  },
});
