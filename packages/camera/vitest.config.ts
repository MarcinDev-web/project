import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    onConsoleLog(log, type) {
      const ignore = [
        /EditorCamera is null!/,
        /Unknown camera mode:/,
      ];
      if (ignore.some((r) => r.test(String(log)))) {
        return false; // silence expected noisy logs
      }
    },
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@engine/core': path.resolve(__dirname, '../core/src'),
      '@engine/world': path.resolve(__dirname, '../world/src'),
    },
  },
});

