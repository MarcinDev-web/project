import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  resolve: {
    alias: {
      '@engine/core': resolve(__dirname, '../core/src'),
      '@engine/world': resolve(__dirname, '../world/src'),
      '@engine/world/*': resolve(__dirname, '../world/src/*'),
    },
  },
  test: {
    // Allow package to pass even if no test files found
    passWithNoTests: true,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});

