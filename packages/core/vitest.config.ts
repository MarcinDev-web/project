import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// vitest.config.ts is in packages/core/
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..'); // packages/core
const rootDir = resolve(__dirname, '../..'); // root of monorepo

// Verify paths exist
const testUtilsPath = resolve(rootDir, 'packages/test-utils/src/index.ts');
if (!existsSync(testUtilsPath)) {
  console.warn(`Warning: @engine/test-utils path not found: ${testUtilsPath}`);
}

export default defineConfig({
  resolve: {
    alias: {
      '@engine/core': resolve(__dirname, 'src/index.ts'),
      '@engine/test-utils': testUtilsPath,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    onConsoleLog(log, type) {
      const ignore = [/DisposableGroup: Cannot add to disposed group/];
      if (ignore.some((r) => r.test(String(log)))) {
        return false; // silence expected error output validated by tests
      }
    },
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
  },
});

