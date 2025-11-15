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
      '@engine/world': path.resolve(__dirname, '../world/src'),
      '@engine/animation': path.resolve(__dirname, '../animation/src'),
      '@engine/stdlib': path.resolve(__dirname, 'src'),
    },
    conditions: ['development', 'test', 'import', 'module'],
  },
});

