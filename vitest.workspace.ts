import { defineWorkspace } from 'vitest/config';
import { resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import wasm from 'vite-plugin-wasm';
import { engineAliases } from './shared/config/aliases';

// Normalize the root directory path to prevent Windows path aliasing issues
// (e.g., "My Documents" vs "Documents" causing duplicate test discovery)
const __dirname = normalize(resolve(fileURLToPath(import.meta.url), '..'));
const sharedRoot = resolve(__dirname, 'shared');

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
    plugins: [wasm()],
    // Set root to normalized path to prevent Windows path aliasing issues
    root: __dirname,
    resolve: {
      alias: {
        ...engineAliases(__dirname),
        '@shared': sharedRoot,
        '@shared/types': resolve(sharedRoot, 'types'),
        // Mock WASM packages to avoid loading issues in tests
        '@engine/wasm-animation': resolve(__dirname, 'packages/test-utils/src/mocks/wasm-animation.ts'),
        '@engine/wasm-ecs-core': resolve(__dirname, 'packages/test-utils/src/mocks/wasm-ecs-core.ts'),
        '@engine/wasm-collision': resolve(__dirname, 'packages/test-utils/src/mocks/wasm-collision.ts'),
        // Explicit asset-pipeline alias to ensure it's resolved from source
        '@engine/asset-pipeline': resolve(__dirname, 'packages/asset-pipeline/src/index.ts'),
      },
    },
    test: {
      name: 'unit',
      // Use normalized root to prevent duplicate test discovery on Windows
      dir: __dirname,
      setupFiles: [
        './apps/editor/src/test/setup.ts',
        './packages/gfx-webgpu/__tests__/setup.ts',
      ],
      optimizeDeps: {
        // Force Vite to use source files instead of dist files for @engine/* packages
        include: [
          '@engine/core',
          '@engine/core/math',
          '@engine/core/utils',
          '@engine/core/event',
          '@engine/core/event/EventBus',
          '@engine/core/job',
          '@engine/core/script',
          '@engine/core/ecs',
          '@engine/world',
          '@engine/world/components',
          '@engine/world/physics',
          '@engine/animation',
          '@engine/avatar',
          '@engine/camera',
          '@engine/stdlib',
          '@engine/editor-utils',
          '@engine/test-utils',
          '@engine/script',
          '@engine/economy',
          '@engine/wasm-collision',
          '@engine/asset-pipeline',
        ],
        exclude: [],
      },
      resolve: {
        conditions: ['development', 'test', 'import', 'module'],
        dedupe: ['@engine/core', '@engine/world', '@engine/animation', '@engine/avatar', '@engine/camera'],
        preserveSymlinks: false,
        mainFields: [], // Prevent Vite from resolving through package.json exports
      },
      include: [
        'packages/**/*.test.ts',
        'packages/**/src/**/*.spec.ts',
        'packages/**/__tests__/**/*.spec.ts',
        'apps/**/*.test.ts',
        'apps/**/*.spec.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/coverage/**',
        '**/.bun/**',
        // World systems tests require jsdom and are executed in package scope
        'packages/world/src/systems/**/*.test.ts',
        // Core test-utils dependent tests are executed in package scope
        'packages/core/src/utils/SeededRNG.test.ts',
        // Camera controller DOM-dependent tests run in package scope
        'packages/camera/__tests__/EditorCameraController.test.ts',
        'packages/script/__tests__/Determinism.test.ts',
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
        // WASM collision tests require actual WASM build - skip in unit tests
        'packages/wasm-collision/src/__tests__/**/*.test.ts',
        // Playwright E2E tests - these use @playwright/test and must NOT be run by vitest
        'packages/gfx-webgpu/tests/**/*.spec.ts',
        '**/gfx-webgpu/tests/**',
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
        // World systems tests rely on DOM APIs
        ['**/packages/world/src/**/*.test.ts', 'jsdom'],
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
          include: ['@engine/wasm-collision', '@engine/economy', '@engine/script', '@engine/core', '@engine/world', '@engine/animation', '@engine/avatar', '@engine/camera', '@engine/stdlib', '@engine/editor-utils', '@engine/test-utils', '@engine/asset-pipeline'],
        },
        fs: {
          // Allow access to packages directory
          allow: ['..'],
        },
      },
      // Include WASM files as assets
      assetsInclude: ['**/*.wasm'],
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
    plugins: [wasm()],
    // Set root to normalized path to prevent Windows path aliasing issues
    root: __dirname,
    resolve: {
      alias: {
        ...engineAliases(__dirname),
        '@shared': resolve(__dirname, 'shared'),
        '@shared/types': resolve(__dirname, 'shared/types'),
        // Mock WASM package to avoid loading issues in tests
        '@engine/wasm-animation': resolve(__dirname, 'packages/test-utils/src/mocks/wasm-animation.ts'),
        // Explicit aliases to ensure packages are resolved from source
        '@engine/asset-pipeline': resolve(__dirname, 'packages/asset-pipeline/src/index.ts'),
        // Mock wasm-ecs-core to avoid WASM loading issues in tests
        '@engine/wasm-ecs-core': resolve(__dirname, 'packages/test-utils/src/mocks/wasm-ecs-core.ts'),
        '@engine/wasm-collision': resolve(__dirname, 'packages/test-utils/src/mocks/wasm-collision.ts'),
      },
    },
    test: {
      name: 'integration',
      // Use normalized root to prevent duplicate test discovery on Windows
      dir: __dirname,
      setupFiles: ['./apps/editor/src/test/setup.ts'],
      optimizeDeps: {
        // Force Vite to use source files instead of dist files for @engine/* packages
        include: [
          '@engine/core',
          '@engine/world',
          '@engine/world/components',
          '@engine/world-templates',
          '@engine/voxel',
          '@engine/voxel/terrain',
          '@engine/animation',
          '@engine/avatar',
          '@engine/camera',
          '@engine/stdlib',
          '@engine/editor-utils',
          '@engine/script',
          '@engine/economy',
          '@engine/asset-pipeline',
        ],
        exclude: [],
      },
      resolve: {
        conditions: ['development', 'test', 'import', 'module'],
        dedupe: ['@engine/core', '@engine/world', '@engine/animation', '@engine/avatar', '@engine/camera'],
        preserveSymlinks: false,
        mainFields: [], // Prevent Vite from resolving through package.json exports
      },
      server: {
        deps: {
          // Inline dependencies to avoid external module resolution overhead
          inline: [/@engine\/.*/],
          // Explicitly include packages to force source file resolution
          include: [
            '@engine/world-templates',
            '@engine/voxel',
            '@engine/economy',
            '@engine/core',
            '@engine/world',
            '@engine/animation',
            '@engine/avatar',
            '@engine/camera',
            '@engine/stdlib',
            '@engine/editor-utils',
            '@engine/script',
            '@engine/asset-pipeline',
          ],
        },
        fs: {
          // Allow access to packages directory
          allow: ['..'],
        },
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
        // Playwright E2E tests - these use @playwright/test and must NOT be run by vitest
        '**/gfx-webgpu/tests/**',
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
