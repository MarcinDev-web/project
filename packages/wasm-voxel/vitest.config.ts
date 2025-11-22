import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import wasm from 'vite-plugin-wasm';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  plugins: [wasm()],
  resolve: {
    alias: {
      '@engine/wasm-voxel': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});

