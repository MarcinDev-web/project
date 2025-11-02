import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@engine/core': path.resolve(__dirname, '../core/src'),
      '@engine/core/event': path.resolve(__dirname, '../core/src/event'),
    },
  },
});

