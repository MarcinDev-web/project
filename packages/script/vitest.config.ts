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
      '@engine/economy': resolve(rootDir, 'packages/economy/src'),
      '@engine/economy/*': resolve(rootDir, 'packages/economy/src/*'),
      '@engine/test-utils': resolve(rootDir, 'packages/test-utils/src'),
      '@engine/script': resolve(__dirname, 'src'),
      '@engine/script/*': resolve(__dirname, 'src/*'),
    },
    conditions: ['development', 'test', 'import', 'module'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    onConsoleLog(log, type) {
      const ignore = [
        /Signal queue overflow/,
      ];
      if (ignore.some((r) => r.test(String(log)))) {
        return false; // silence expected warnings
      }
    },
    include: ['__tests__/**/*.test.ts'],
    passWithNoTests: true,
  },
});

