import { defineWorkspace } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

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
      setupFiles: [
        './apps/editor/src/test/setup.ts',
        './packages/gfx-webgpu/__tests__/setup.ts',
      ],
      resolve: {
        alias: {
          '@engine/core': resolve(__dirname, 'packages/core/src'),
          '@engine/core/*': resolve(__dirname, 'packages/core/src/*'),
          '@engine/animation': resolve(__dirname, 'packages/animation/src'),
          '@engine/animation/*': resolve(__dirname, 'packages/animation/src/*'),
          '@engine/world': resolve(__dirname, 'packages/world/src'),
          '@engine/world/*': resolve(__dirname, 'packages/world/src/*'),
          '@engine/world/components': resolve(__dirname, 'packages/world/src/components'),
          '@engine/world/components/*': resolve(__dirname, 'packages/world/src/components/*'),
          '@engine/world/physics': resolve(__dirname, 'packages/world/src/physics'),
          '@engine/world/physics/*': resolve(__dirname, 'packages/world/src/physics/*'),
          '@engine/world-templates': resolve(__dirname, 'packages/world-templates/src'),
          '@engine/world-templates/*': resolve(__dirname, 'packages/world-templates/src/*'),
          '@engine/gfx-webgpu': resolve(__dirname, 'packages/gfx-webgpu/src'),
          '@engine/gfx-webgpu/*': resolve(__dirname, 'packages/gfx-webgpu/src/*'),
          '@engine/script': resolve(__dirname, 'packages/script/src'),
          '@engine/script/*': resolve(__dirname, 'packages/script/src/*'),
          '@engine/input': resolve(__dirname, 'packages/input/src'),
          '@engine/input/*': resolve(__dirname, 'packages/input/src/*'),
          '@engine/camera': resolve(__dirname, 'packages/camera/src'),
          '@engine/camera/*': resolve(__dirname, 'packages/camera/src/*'),
          '@engine/avatar': resolve(__dirname, 'packages/avatar/src'),
          '@engine/avatar/*': resolve(__dirname, 'packages/avatar/src/*'),
          '@engine/stdlib': resolve(__dirname, 'packages/stdlib/src'),
          '@engine/stdlib/*': resolve(__dirname, 'packages/stdlib/src/*'),
          '@engine/editor-utils': resolve(__dirname, 'packages/editor-utils/src'),
          '@engine/editor-utils/*': resolve(__dirname, 'packages/editor-utils/src/*'),
          '@engine/test-utils': resolve(__dirname, 'packages/test-utils/src'),
          '@engine/test-utils/*': resolve(__dirname, 'packages/test-utils/src/*'),
          '@engine/wasm-collision': resolve(__dirname, 'packages/wasm-collision/src'),
          '@engine/wasm-collision/*': resolve(__dirname, 'packages/wasm-collision/src/*'),
          '@engine/net': resolve(__dirname, 'packages/net/src'),
          '@engine/net/*': resolve(__dirname, 'packages/net/src/*'),
          '@engine/net-protocol': resolve(__dirname, 'packages/net-protocol/src'),
          '@engine/net-protocol/*': resolve(__dirname, 'packages/net-protocol/src/*'),
        },
        conditions: ['test', 'development', 'import', 'module'],
      },
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
        'apps/**/__tests__/e2e/**',
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
        // Tests that use localStorage need jsdom
        ['**/*InventoryManager*.test.ts', 'jsdom'],
        ['**/*BlockEditor*.test.ts', 'jsdom'],
        // Camera tests need DOM for canvas/document APIs
        ['**/packages/camera/**/*.test.ts', 'jsdom'],
        ['**/packages/camera/**/*.spec.ts', 'jsdom'],
        // gfx-webgpu tests that use DOM APIs
        ['**/packages/gfx-webgpu/**/*.test.ts', 'jsdom'],
        ['**/packages/gfx-webgpu/**/*.spec.ts', 'jsdom'],
        // Core tests that use DOM (like DisposableGroup)
        ['**/packages/core/**/*DisposableGroup*.test.ts', 'jsdom'],
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
      server: {
        deps: {
          // Inline dependencies to avoid external module resolution overhead
          inline: [/@engine\/.*/],
          // Explicitly include wasm-collision to force source file resolution
          include: ['@engine/wasm-collision'],
        },
        fs: {
          // Allow access to packages directory
          allow: ['..'],
        },
      },
      // Force Vite to prioritize alias over package.json exports
      resolve: {
        preserveSymlinks: false,
        mainFields: ['module', 'main'],
        dedupe: ['@engine/wasm-collision'],
      },
      // Coverage configuration
      coverage: {
        enabled: false, // Enable with --coverage flag
        provider: 'v8',
        reporter: ['text', 'html', 'json-summary', 'lcov'],
        reportsDirectory: './coverage/unit',
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/__tests__/**',
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/test/**',
          '**/tests/**',
          '**/vitest.config.ts',
          '**/vitest.workspace.ts',
          '**/setup.ts',
        ],
        thresholds: {
          lines: 60,
          functions: 60,
          branches: 60,
          statements: 60,
        },
      },
    },
  },
  {
    test: {
      name: 'integration',
      setupFiles: ['./apps/editor/src/test/setup.ts'],
      resolve: {
        alias: {
          '@engine/core': resolve(__dirname, 'packages/core/src'),
          '@engine/core/*': resolve(__dirname, 'packages/core/src/*'),
          '@engine/animation': resolve(__dirname, 'packages/animation/src'),
          '@engine/animation/*': resolve(__dirname, 'packages/animation/src/*'),
          '@engine/world': resolve(__dirname, 'packages/world/src'),
          '@engine/world/*': resolve(__dirname, 'packages/world/src/*'),
          '@engine/world/components': resolve(__dirname, 'packages/world/src/components'),
          '@engine/world/components/*': resolve(__dirname, 'packages/world/src/components/*'),
          '@engine/world/physics': resolve(__dirname, 'packages/world/src/physics'),
          '@engine/world/physics/*': resolve(__dirname, 'packages/world/src/physics/*'),
          '@engine/world-templates': resolve(__dirname, 'packages/world-templates/src'),
          '@engine/world-templates/*': resolve(__dirname, 'packages/world-templates/src/*'),
          '@engine/gfx-webgpu': resolve(__dirname, 'packages/gfx-webgpu/src'),
          '@engine/gfx-webgpu/*': resolve(__dirname, 'packages/gfx-webgpu/src/*'),
          '@engine/script': resolve(__dirname, 'packages/script/src'),
          '@engine/script/*': resolve(__dirname, 'packages/script/src/*'),
          '@engine/input': resolve(__dirname, 'packages/input/src'),
          '@engine/input/*': resolve(__dirname, 'packages/input/src/*'),
          '@engine/camera': resolve(__dirname, 'packages/camera/src'),
          '@engine/camera/*': resolve(__dirname, 'packages/camera/src/*'),
          '@engine/avatar': resolve(__dirname, 'packages/avatar/src'),
          '@engine/avatar/*': resolve(__dirname, 'packages/avatar/src/*'),
          '@engine/stdlib': resolve(__dirname, 'packages/stdlib/src'),
          '@engine/stdlib/*': resolve(__dirname, 'packages/stdlib/src/*'),
          '@engine/editor-utils': resolve(__dirname, 'packages/editor-utils/src'),
          '@engine/editor-utils/*': resolve(__dirname, 'packages/editor-utils/src/*'),
          '@engine/test-utils': resolve(__dirname, 'packages/test-utils/src'),
          '@engine/test-utils/*': resolve(__dirname, 'packages/test-utils/src/*'),
          '@engine/wasm-collision': resolve(__dirname, 'packages/wasm-collision/src'),
          '@engine/wasm-collision/*': resolve(__dirname, 'packages/wasm-collision/src/*'),
          '@engine/net': resolve(__dirname, 'packages/net/src'),
          '@engine/net/*': resolve(__dirname, 'packages/net/src/*'),
          '@engine/net-protocol': resolve(__dirname, 'packages/net-protocol/src'),
          '@engine/net-protocol/*': resolve(__dirname, 'packages/net-protocol/src/*'),
        },
        conditions: ['test', 'development', 'import', 'module'],
      },
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
      // Coverage configuration
      coverage: {
        enabled: false, // Enable with --coverage flag
        provider: 'v8',
        reporter: ['text', 'html', 'json-summary', 'lcov'],
        reportsDirectory: './coverage/integration',
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/__tests__/**',
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/test/**',
          '**/tests/**',
          '**/vitest.config.ts',
          '**/vitest.workspace.ts',
          '**/setup.ts',
        ],
      },
    },
  },
]);

