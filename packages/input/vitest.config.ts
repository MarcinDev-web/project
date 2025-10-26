import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@engine/core': path.resolve(__dirname, '../core/src'),
      '@engine/world': path.resolve(__dirname, '../world/src'),
      '@engine/camera': path.resolve(__dirname, '../camera/src'),
    },
  },
});

