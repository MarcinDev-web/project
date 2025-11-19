import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      enabled: false,
    },
  },
  resolve: {
    alias: {
      '@engine/world': resolve(rootDir, '../../../packages/world/src'),
    },
  },
});

