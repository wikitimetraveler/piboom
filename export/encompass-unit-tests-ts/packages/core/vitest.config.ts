import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setupParser.ts', './tests/setupBrParser.ts'],
  },
  assetsInclude: ['**/*.js'],
});
