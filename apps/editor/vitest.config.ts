import { defineConfig } from 'vitest/config';
import path from 'path';
import { engineAliases } from '../../shared/config/aliases';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/e2e/**'],
  },
  resolve: {
    alias: {
      ...engineAliases(__dirname),
    },
    conditions: ['development', 'test', 'import', 'module'],
    preserveSymlinks: false,
    mainFields: [], // Prevent Vite from resolving through package.json exports
  },
  optimizeDeps: {
    exclude: ['@engine/wasm-collision'],
  },
});

