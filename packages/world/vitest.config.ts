import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  resolve: {
    alias: {
      '@engine/core': resolve(__dirname, '../core/src'),
      '@engine/core/*': resolve(__dirname, '../core/src/*'),
      '@engine/world': resolve(__dirname, 'src'),
      '@engine/world/*': resolve(__dirname, 'src/*'),
      '@engine/world/components': resolve(__dirname, 'src/components'),
      '@engine/world/components/*': resolve(__dirname, 'src/components/*'),
      '@engine/world/physics': resolve(__dirname, 'src/physics'),
      '@engine/world/physics/*': resolve(__dirname, 'src/physics/*'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
  },
});

