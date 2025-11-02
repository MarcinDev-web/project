import { defineConfig } from 'vitest/config';

export default defineConfig({
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

