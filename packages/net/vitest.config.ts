import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const rootDir = resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    alias: {
      '@engine/core': resolve(rootDir, 'packages/core/src'),
      '@engine/core/*': resolve(rootDir, 'packages/core/src/*'),
      '@engine/world': resolve(rootDir, 'packages/world/src'),
      '@engine/world/*': resolve(rootDir, 'packages/world/src/*'),
      '@engine/animation': resolve(rootDir, 'packages/animation/src'),
      '@engine/animation/*': resolve(rootDir, 'packages/animation/src/*'),
      '@engine/net-protocol': resolve(rootDir, 'packages/net-protocol/src'),
      '@engine/net-protocol/*': resolve(rootDir, 'packages/net-protocol/src/*'),
      '@engine/net': resolve(__dirname, 'src'),
      '@engine/net/*': resolve(__dirname, 'src/*'),
    },
    conditions: ['development', 'test', 'import', 'module'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    passWithNoTests: true,
  },
});

