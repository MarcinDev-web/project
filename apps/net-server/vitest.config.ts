import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Allow app to pass even if no test files found
    passWithNoTests: true,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/.bun/**'],
  },
});

