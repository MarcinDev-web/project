import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    onConsoleLog(log, type) {
      const ignore = [/DisposableGroup: Cannot add to disposed group/];
      if (ignore.some((r) => r.test(String(log)))) {
        return false; // silence expected error output validated by tests
      }
    },
    include: ['__tests__/**/*.test.ts'],
  },
});

