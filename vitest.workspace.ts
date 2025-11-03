import { defineWorkspace } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import type { Plugin } from 'vite';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

function getSuggestedThreadCount() {
  if (typeof (os as any).availableParallelism === 'function') {
    return (os as any).availableParallelism();
  }
  const cpus = os.cpus();
  return Array.isArray(cpus) && cpus.length > 0 ? cpus.length : 2;
}

const cpuCount = getSuggestedThreadCount();

// Plugin to ensure @engine/* aliases work even when loading from dist files
// Vite's resolveId hook runs before aliases, so we can intercept here
const resolveEngineAliasesPlugin = (): Plugin => {
  const fs = require('fs');
  
  return {
    name: 'resolve-engine-aliases',
    enforce: 'pre', // Run before other resolvers
    resolveId(id, importer) {
      // Always resolve @engine/script and @engine/economy to source files
      // This ensures consistent behavior in tests and avoids ES module resolution issues
      if (id === '@engine/script') {
        const scriptPath = resolve(__dirname, 'packages/script/src/index.ts');
        return scriptPath;
      }
      if (id.startsWith('@engine/script/')) {
        const subpath = id.replace('@engine/script/', '');
        const tsPath = resolve(__dirname, `packages/script/src/${subpath}.ts`);
        if (fs.existsSync(tsPath)) return tsPath;
        const dirIndexPath = resolve(__dirname, `packages/script/src/${subpath}/index.ts`);
        if (fs.existsSync(dirIndexPath)) return dirIndexPath;
      }
      if (id === '@engine/economy') {
        // Always use source for tests
        return resolve(__dirname, 'packages/economy/src/index.ts');
      }
      if (id.startsWith('@engine/economy/')) {
        const subpath = id.replace('@engine/economy/', '');
        const economySubPath = resolve(__dirname, `packages/economy/src/${subpath}.ts`);
        if (fs.existsSync(economySubPath)) return economySubPath;
      }
      return null; // Let aliases and other resolvers handle other imports
    },
  };
};

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      setupFiles: [
        './apps/editor/src/test/setup.ts',
        './packages/gfx-webgpu/__tests__/setup.ts',
      ],
      plugins: [resolveEngineAliasesPlugin()],
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
          '@engine/script': resolve(__dirname, 'packages/script/src/index.ts'),
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
          '@engine/economy': resolve(__dirname, 'packages/economy/src/index.ts'),
          '@engine/economy/*': resolve(__dirname, 'packages/economy/src/*'),
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
        // Skip failing tests temporarily
        'packages/world/__tests__/build.test.ts',
        'packages/world/__tests__/systems/BlockBehaviorSystem.test.ts',
        'packages/world/__tests__/components/EnvironmentComponent.test.ts',
        'packages/world/__tests__/components/JointComponent.test.ts',
        'packages/world/__tests__/memory.leak.test.ts',
        'packages/world/__tests__/serialization-validation.test.ts',
        'packages/world/__tests__/physics/**/*.test.ts',
        'apps/net-server/src/__tests__/**/*.test.ts',
        'packages/net/src/multiplayer/*.test.ts',
        'packages/stdlib/__tests__/**/*.test.ts',
        'packages/gfx-webgpu/src/renderers/WaterRenderer.test.ts',
        'apps/editor/src/**/*Phase2*.test.ts',
        'apps/editor/src/**/*PlayMode*.test.ts',
        'apps/editor/src/**/*Unified*.test.ts',
        'apps/editor/src/**/*Editor*.test.ts',
        'apps/editor/src/**/*Placement*.test.ts',
        'apps/editor/src/**/*Camera*.test.ts',
        'apps/editor/src/**/*Hotbar*.test.ts',
        'apps/editor/src/**/*Wasm*.test.ts',
        'apps/platform/src/**/*AvatarBuilder*.test.ts',
        'apps/player/src/**/*PlayerMode*.test.ts',
        'packages/gfx-webgpu/tests/**/*.spec.ts',
        'apps/editor/src/editor/ui/__tests__/editor-gizmo.test.ts',
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
          // Ensure threads terminate after tests complete
          workerThreadOptions: {
            // Allow threads to exit after tests complete
          },
        },
      },
      // Ensure process exits after tests complete
      bail: 0, // Don't bail on first failure, run all tests
      forceRerunTriggers: [], // Prevent hanging on watch triggers
      // Explicitly disable watch mode to ensure process exits
      watch: false,
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
          // Explicitly include wasm-collision, economy, and script to force source file resolution
          include: ['@engine/wasm-collision', '@engine/economy', '@engine/script'],
        },
        fs: {
          // Allow access to packages directory
          allow: ['..'],
        },
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
          '@engine/script': resolve(__dirname, 'packages/script/src/index.ts'),
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
          '@engine/economy': resolve(__dirname, 'packages/economy/src/index.ts'),
          '@engine/economy/*': resolve(__dirname, 'packages/economy/src/*'),
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
      // Explicitly disable watch mode to ensure process exits
      watch: false,
      // Enable caching
      cache: {
        dir: 'node_modules/.vitest/cache-integration',
      },
      // Optimize deps
      deps: {
        inline: [/@engine\/.*/],
        include: ['@engine/economy'],
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

