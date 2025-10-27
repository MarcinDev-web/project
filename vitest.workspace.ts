import { defineWorkspace } from 'vitest/config';
import os from 'node:os';

function getSuggestedThreadCount() {
  if (typeof (os as any).availableParallelism === 'function') {
    return (os as any).availableParallelism();
  }
  const cpus = os.cpus();
  return Array.isArray(cpus) && cpus.length > 0 ? cpus.length : 2;
}

const cpuCount = getSuggestedThreadCount();

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      setupFiles: ['./apps/editor/src/test/setup.ts'],
      include: [
        'packages/**/*.test.ts',
        'packages/**/*.spec.ts',
        'apps/**/*.test.ts',
        'apps/**/*.spec.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/.bun/**',
        'packages/**/?(*.){integration,interaction,ui}.test.ts',
        'packages/**/?(*.){integration,interaction,ui}.spec.ts',
        'apps/**/?(*.){integration,interaction,ui}.test.ts',
        'apps/**/?(*.){integration,interaction,ui}.spec.ts',
      ],
      // Use node environment for pure logic tests (faster), jsdom only when needed
      environment: 'node',
      environmentMatchGlobs: [
        // Use jsdom only for tests that need DOM/Browser APIs
        ['**/apps/editor/**/*.test.ts', 'jsdom'],
        ['**/editor/**/*.test.ts', 'jsdom'],
        ['**/*UI*.test.ts', 'jsdom'],
        ['**/*Dom*.test.ts', 'jsdom'],
        ['**/*Browser*.test.ts', 'jsdom'],
      ],
      // Use file-level isolation only (not test-level) for better performance
      isolate: false,
      testTimeout: 5000,
      hookTimeout: 10000,
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          minThreads: Math.max(2, Math.floor(cpuCount / 2)),
          maxThreads: cpuCount,
          // Use isolation only for tests, not for each file
          isolate: false,
          // Enable shared memory for faster worker communication
          useAtomics: true,
        },
      },
      // Enable caching for faster re-runs
      cache: {
        dir: 'node_modules/.vitest/cache',
      },
      // Optimize file watching
      watchExclude: ['**/node_modules/**', '**/dist/**'],
      // Optimize deps
      deps: {
        // Inline dependencies to avoid external module resolution overhead
        inline: [/@engine\/.*/],
      },
    },
  },
  {
    test: {
      name: 'integration',
      setupFiles: ['./apps/editor/src/test/setup.ts'],
      include: [
        'packages/**/?(*.)integration.test.ts',
        'packages/**/?(*.)integration.spec.ts',
        'packages/**/?(*.)interaction.test.ts',
        'packages/**/?(*.)interaction.spec.ts',
        'packages/**/?(*.)ui.test.ts',
        'packages/**/?(*.)ui.spec.ts',
        'apps/**/?(*.)integration.test.ts',
        'apps/**/?(*.)integration.spec.ts',
        'apps/**/?(*.)interaction.test.ts',
        'apps/**/?(*.)interaction.spec.ts',
        'apps/**/?(*.)ui.test.ts',
        'apps/**/?(*.)ui.spec.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/.bun/**',
      ],
      environment: 'jsdom',
      // Integration tests need isolation
      isolate: true,
      testTimeout: 10000,
      hookTimeout: 15000,
      // Use forks for integration tests (better for I/O heavy operations)
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: false,
          minForks: 1,
          maxForks: Math.max(2, Math.floor(cpuCount / 2)),
          // Integration tests need isolation
          isolate: true,
        },
      },
      // Enable caching
      cache: {
        dir: 'node_modules/.vitest/cache-integration',
      },
      // Optimize deps
      deps: {
        inline: [/@engine\/.*/],
      },
    },
  },
]);

