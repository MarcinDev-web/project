import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const rootDir = resolve(__dirname, '../..');

export default defineConfig({
  resolve: {
    alias: {
      // Resolve engine packages to source during package-level runs
      '@engine/core': resolve(rootDir, 'packages/core/src'),
      '@engine/core/*': resolve(rootDir, 'packages/core/src/*'),
      '@engine/world': resolve(rootDir, 'packages/world/src'),
      '@engine/world/*': resolve(rootDir, 'packages/world/src/*'),
      '@engine/test-utils': resolve(rootDir, 'packages/test-utils/src'),
    },
    conditions: ['development', 'test', 'import', 'module'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['./__tests__/setup.ts'],
    exclude: ['__tests__/resources/HdrLoader.test.ts'],
    onConsoleLog(log, type) {
      const ignore = [
        /Timestamp period: no source available/,
      ];
      if (ignore.some((r) => r.test(String(log)))) {
        return false; // silence expected environment warnings
      }
    },
    passWithNoTests: true,
  },
});

