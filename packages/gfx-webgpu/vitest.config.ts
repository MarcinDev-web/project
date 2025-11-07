import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['./__tests__/setup.ts'],
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

