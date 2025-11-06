import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@engine/world': path.resolve(__dirname, '../../packages/world/src'),
      '@engine/world/*': path.resolve(__dirname, '../../packages/world/src/*'),
      '@engine/economy': path.resolve(__dirname, '../../packages/economy/src'),
      '@engine/economy/*': path.resolve(__dirname, '../../packages/economy/src/*'),
      '@engine/script': path.resolve(__dirname, '../../packages/script/src'),
      '@engine/script/*': path.resolve(__dirname, '../../packages/script/src/*'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@shared/*': path.resolve(__dirname, '../../shared/*'),
      // Alias for Prisma Client custom output location
      '../node_modules/.prisma/net-client': path.resolve(__dirname, 'node_modules/.prisma/net-client'),
    },
  },
  test: {
    // Allow app to pass even if no test files found
    passWithNoTests: true,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/.bun/**'],
    // Use file-level isolation for tests that start servers
    isolate: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: false,
      },
    },
    setupFiles: [],
    globals: true,
  },
});

