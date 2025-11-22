import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import wasm from 'vite-plugin-wasm';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const rootDir = resolve(__dirname, '../..');

export default defineConfig({
  plugins: [wasm()],
  resolve: {
    alias: {
      '@engine/core': resolve(__dirname, '../core/src'),
      '@engine/core/*': resolve(__dirname, '../core/src/*'),
      // Ensure local tests resolve to source during package-level runs
      '@engine/test-utils': resolve(rootDir, 'packages/test-utils/src'),
      '@engine/test-utils/determinism': resolve(rootDir, 'packages/test-utils/src/determinism/index.ts'),
      '@engine/world': resolve(__dirname, 'src'),
      '@engine/world/*': resolve(__dirname, 'src/*'),
      '@engine/world/components': resolve(__dirname, 'src/components'),
      '@engine/world/components/*': resolve(__dirname, 'src/components/*'),
      '@engine/world/physics': resolve(__dirname, 'src/physics'),
      '@engine/world/physics/*': resolve(__dirname, 'src/physics/*'),
      '@engine/wasm-voxel': resolve(__dirname, '../wasm-voxel/src'),
    },
    conditions: ['development', 'test', 'import', 'module'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    passWithNoTests: true,
  },
});

