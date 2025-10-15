import { defineWorkspace } from 'vitest/config';
import os from 'node:os';

function getSuggestedThreadCount() {
  if (typeof (os as any).availableParallelism === 'function') {
    return (os as any).availableParallelism();
  }
  const cpus = os.cpus();
  return Array.isArray(cpus) && cpus.length > 0 ? cpus.length : 2;
}

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/.bun/**',
        'src/**/?(*.){integration,interaction,ui}.test.ts',
        'src/**/?(*.){integration,interaction,ui}.spec.ts',
      ],
      environment: 'jsdom',
      isolate: true,
      testTimeout: 5000,
      hookTimeout: 10000,
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          minThreads: 1,
          maxThreads: Math.max(2, getSuggestedThreadCount() - 1),
        },
      },
    },
  },
  {
    test: {
      name: 'integration',
      setupFiles: ['./src/test/setup.ts'],
      include: [
        'src/**/?(*.)integration.test.ts',
        'src/**/?(*.)integration.spec.ts',
        'src/**/?(*.)interaction.test.ts',
        'src/**/?(*.)interaction.spec.ts',
        'src/**/?(*.)ui.test.ts',
        'src/**/?(*.)ui.spec.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/.bun/**',
      ],
      environment: 'jsdom',
      isolate: true,
      testTimeout: 5000,
      hookTimeout: 10000,
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: false,
          minThreads: 1,
          maxThreads: Math.max(2, getSuggestedThreadCount() - 1),
        },
      },
    },
  },
]);

