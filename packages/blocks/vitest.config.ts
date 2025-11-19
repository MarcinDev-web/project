import { defineConfig } from 'vitest/config';
import path from 'path';

console.log('DEBUG: Loading vitest config for blocks');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@engine/microblocks', replacement: path.resolve(__dirname, '../microblocks/src/index.ts') },
      { find: '@engine/world', replacement: path.resolve(__dirname, '../world/src/index.ts') },
      { find: '@engine/animation', replacement: path.resolve(__dirname, '../animation/src/index.ts') },
      // Map @engine/core to src directory to support deep imports like @engine/core/math
      { find: '@engine/core', replacement: path.resolve(__dirname, '../core/src') },
    ],
  },
  test: {
    // Allow package to pass even if no test files found
    passWithNoTests: true,
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
