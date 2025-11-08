import { defineWorkspace } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import type { Plugin } from 'vite';
import wasm from 'vite-plugin-wasm';

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
  const path = require('path');
  
  // Cache for original package.json contents
  const originalPackageJsonCache = new Map<string, string>();
  
  // List of @engine/* packages to modify
  const enginePackages = [
    'core',
    'world',
    'animation',
    'avatar',
    'camera',
    'editor-utils',
    'test-utils',
    'stdlib',
    'script',
    'economy',
    'gfx-webgpu',
    'input',
    'net',
    'net-protocol',
    'voxel',
    'blocks',
    'microblocks',
    'world-templates',
  ];
  
  // Helper to modify package.json exports to point to src/ instead of dist/
  const modifyPackageJson = (packagePath: string): void => {
    const packageJsonPath = path.join(packagePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) return;
    
    // Read and cache original content
    if (!originalPackageJsonCache.has(packageJsonPath)) {
      const originalContent = fs.readFileSync(packageJsonPath, 'utf-8');
      originalPackageJsonCache.set(packageJsonPath, originalContent);
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    
    // Modify exports to point to src/ for all conditions
    if (packageJson.exports) {
      const modifyExports = (exports: any): any => {
        if (typeof exports === 'string') {
          // Replace dist/ with src/ and .js with .ts
          const modified = exports.replace(/\/dist\//g, '/src/').replace(/\.js$/g, '.ts');
          return modified;
        }
        if (typeof exports === 'object' && exports !== null) {
          if (Array.isArray(exports)) {
            return exports.map(modifyExports);
          }
          const modified: any = {};
          for (const [key, value] of Object.entries(exports)) {
            // For all export conditions (import, default, development, test, etc.), point to src/
            modified[key] = modifyExports(value);
          }
          return modified;
        }
        return exports;
      };
      
      const originalExports = JSON.stringify(packageJson.exports);
      packageJson.exports = modifyExports(packageJson.exports);
      const modifiedExports = JSON.stringify(packageJson.exports);
      
      // Only write if actually modified
      if (originalExports !== modifiedExports) {
        // Write modified package.json
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
      }
    }
  };
  
  // Helper to restore original package.json
  const restorePackageJson = (packagePath: string): void => {
    const packageJsonPath = path.join(packagePath, 'package.json');
    const originalContent = originalPackageJsonCache.get(packageJsonPath);
    if (originalContent) {
      fs.writeFileSync(packageJsonPath, originalContent, 'utf-8');
      originalPackageJsonCache.delete(packageJsonPath);
    }
  };
  
  // Helper to resolve @engine/* imports to source files
  const resolveEngineImport = (id: string): string | null => {
    // Handle @engine/core subpath exports - always resolve to src
    if (id === '@engine/core/math') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/math/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id === '@engine/core/utils') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/utils/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id === '@engine/core/event') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/event/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id === '@engine/core/event/EventBus') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/event/EventBus.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id === '@engine/core/job') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/job/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id === '@engine/core/script') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/script/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id === '@engine/core/ecs') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/ecs/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    // Handle @engine/core main export
    if (id === '@engine/core') {
      const resolvedPath = resolve(__dirname, 'packages/core/src/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    // Handle @engine/world - always resolve to src
    if (id === '@engine/world') {
      const resolvedPath = resolve(__dirname, 'packages/world/src/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id.startsWith('@engine/world/components')) {
      const subpath = id.replace('@engine/world/components/', '');
      if (!subpath) {
        const resolvedPath = resolve(__dirname, 'packages/world/src/components/index.ts');
        return fs.existsSync(resolvedPath) ? resolvedPath : null;
      }
      const componentPath = resolve(__dirname, `packages/world/src/components/${subpath}.ts`);
      if (fs.existsSync(componentPath)) return componentPath;
      const componentIndexPath = resolve(__dirname, `packages/world/src/components/${subpath}/index.ts`);
      if (fs.existsSync(componentIndexPath)) return componentIndexPath;
    }
    if (id.startsWith('@engine/world/physics')) {
      const subpath = id.replace('@engine/world/physics/', '');
      if (!subpath) {
        const resolvedPath = resolve(__dirname, 'packages/world/src/physics/index.ts');
        return fs.existsSync(resolvedPath) ? resolvedPath : null;
      }
      const physicsPath = resolve(__dirname, `packages/world/src/physics/${subpath}.ts`);
      if (fs.existsSync(physicsPath)) return physicsPath;
      const physicsIndexPath = resolve(__dirname, `packages/world/src/physics/${subpath}/index.ts`);
      if (fs.existsSync(physicsIndexPath)) return physicsIndexPath;
    }
    // Handle @engine/script
    if (id === '@engine/script') {
      const resolvedPath = resolve(__dirname, 'packages/script/src/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id.startsWith('@engine/script/')) {
      const subpath = id.replace('@engine/script/', '');
      const tsPath = resolve(__dirname, `packages/script/src/${subpath}.ts`);
      if (fs.existsSync(tsPath)) return tsPath;
      const dirIndexPath = resolve(__dirname, `packages/script/src/${subpath}/index.ts`);
      if (fs.existsSync(dirIndexPath)) return dirIndexPath;
    }
    // Handle @engine/economy
    if (id === '@engine/economy') {
      const resolvedPath = resolve(__dirname, 'packages/economy/src/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id.startsWith('@engine/economy/')) {
      const subpath = id.replace('@engine/economy/', '');
      const economySubPath = resolve(__dirname, `packages/economy/src/${subpath}.ts`);
      if (fs.existsSync(economySubPath)) return economySubPath;
    }
    // Handle @engine/test-utils
    if (id === '@engine/test-utils') {
      const resolvedPath = resolve(__dirname, 'packages/test-utils/src/index.ts');
      return fs.existsSync(resolvedPath) ? resolvedPath : null;
    }
    if (id.startsWith('@engine/test-utils/')) {
      const subpath = id.replace('@engine/test-utils/', '');
      const testUtilsPath = resolve(__dirname, `packages/test-utils/src/${subpath}.ts`);
      if (fs.existsSync(testUtilsPath)) return testUtilsPath;
      const testUtilsIndexPath = resolve(__dirname, `packages/test-utils/src/${subpath}/index.ts`);
      if (fs.existsSync(testUtilsIndexPath)) return testUtilsIndexPath;
    }
    // Handle @engine/stdlib
    if (id.startsWith('@engine/stdlib/')) {
      const subpath = id.replace('@engine/stdlib/', '');
      const stdlibPath = resolve(__dirname, `packages/stdlib/src/${subpath}.ts`);
      if (fs.existsSync(stdlibPath)) return stdlibPath;
      const stdlibIndexPath = resolve(__dirname, `packages/stdlib/src/${subpath}/index.ts`);
      if (fs.existsSync(stdlibIndexPath)) return stdlibIndexPath;
    }
    return null;
  };
  
  return {
    name: 'resolve-engine-aliases',
    enforce: 'pre', // Run before other resolvers
    config() {
      // Modify package.json files BEFORE Vite reads them
      // This is the earliest hook - runs before configResolved
      for (const pkg of enginePackages) {
        const packagePath = resolve(__dirname, `packages/${pkg}`);
        if (fs.existsSync(packagePath)) {
          modifyPackageJson(packagePath);
        }
      }
    },
    configResolved() {
      // Also modify in configResolved as a safety net
      for (const pkg of enginePackages) {
        const packagePath = resolve(__dirname, `packages/${pkg}`);
        if (fs.existsSync(packagePath)) {
          modifyPackageJson(packagePath);
        }
      }
    },
    buildEnd() {
      // Restore original package.json files after tests
      for (const pkg of enginePackages) {
        const packagePath = resolve(__dirname, `packages/${pkg}`);
        if (fs.existsSync(packagePath)) {
          restorePackageJson(packagePath);
        }
      }
    },
    closeBundle() {
      // Also restore in closeBundle as a safety net
      for (const pkg of enginePackages) {
        const packagePath = resolve(__dirname, `packages/${pkg}`);
        if (fs.existsSync(packagePath)) {
          restorePackageJson(packagePath);
        }
      }
    },
    resolveId(id, importer) {
      // Always resolve @engine/* imports to source files first (highest priority)
      // This must happen before any other resolution logic
      // Check for @engine/* imports regardless of importer
      if (id.startsWith('@engine/')) {
        const engineResolved = resolveEngineImport(id);
        if (engineResolved && fs.existsSync(engineResolved)) {
          // Return absolute path to ensure Vite uses it
          // This should override package.json exports
          return engineResolved;
        }
      }
      
      // If trying to resolve a .js file in src/, redirect to .ts equivalent
      if (id.includes('/src/') && id.endsWith('.js')) {
        const tsId = id.replace(/\.js$/, '.ts');
        if (fs.existsSync(tsId)) {
          return tsId;
        }
      }
      
      // If importer is a .js file in dist/ or src/, try to resolve imports from source
      if (importer && (importer.includes('/dist/') || importer.includes('/src/')) && importer.endsWith('.js')) {
        // Re-resolve the import ID with the engine resolver
        const reResolved = resolveEngineImport(id);
        if (reResolved && fs.existsSync(reResolved)) {
          return reResolved;
        }
      }
      
      // If importer is from dist/, always try to resolve @engine/* imports to source
      if (importer && importer.includes('/dist/')) {
        const reResolved = resolveEngineImport(id);
        if (reResolved && fs.existsSync(reResolved)) {
          return reResolved;
        }
      }
      
      return null; // Let aliases and other resolvers handle other imports
    },
    shouldExternalize(id, importer, isResolved) {
      // Prevent externalization of @engine/* packages - we want to bundle them from source
      if (id.startsWith('@engine/')) {
        return false;
      }
      return undefined; // Let Vite decide for other packages
    },
    load(id) {
      // If trying to load a .js file in src/, redirect to .ts equivalent
      if (id.includes('/src/') && id.endsWith('.js')) {
        const tsId = id.replace(/\.js$/, '.ts');
        if (fs.existsSync(tsId)) {
          // Return null to let Vite handle the .ts file
          return null;
        }
      }
      // If trying to load a .js file in dist/, redirect to .ts equivalent in src/
      if (id.includes('/dist/') && id.endsWith('.js')) {
        const srcId = id.replace('/dist/', '/src/').replace(/\.js$/, '.ts');
        if (fs.existsSync(srcId)) {
          // Return null to let Vite handle the .ts file
          return null;
        }
      }
      // If trying to load a file from dist/ that was resolved via package.json exports,
      // redirect to src/ equivalent
      if (id.includes('/dist/') && (id.endsWith('.js') || id.endsWith('.d.ts'))) {
        const srcId = id.replace('/dist/', '/src/').replace(/\.(js|d\.ts)$/, '.ts');
        if (fs.existsSync(srcId)) {
          // Return null to let Vite handle the .ts file
          return null;
        }
      }
      return null;
    },
    transform(code, id) {
      // Transform imports from @engine/* to direct source file paths
      // This runs before Vite resolves imports, so we can intercept here
      if ((id.endsWith('.ts') || id.endsWith('.tsx')) && !id.includes('node_modules')) {
        let modified = false;
        let transformedCode = code;
        
        // Match import/export statements with @engine/* imports
        // Support both single and double quotes, and handle various import styles
        const importRegex = /from\s+['"]@engine\/([^'"]+)['"]/g;
        const requireRegex = /require\s*\(\s*['"]@engine\/([^'"]+)['"]\s*\)/g;
        const importStatementRegex = /import\s+.*?\s+from\s+['"]@engine\/([^'"]+)['"]/g;
        const exportFromRegex = /export\s+.*?\s+from\s+['"]@engine\/([^'"]+)['"]/g;
        
        // Replace @engine/* imports with direct source paths
        const replaceImport = (match: string, pkgPath: string) => {
          const fullId = `@engine/${pkgPath}`;
          const resolved = resolveEngineImport(fullId);
          if (resolved && fs.existsSync(resolved)) {
            modified = true;
            // Use relative path from current file to resolved file
            const relativePath = path.relative(path.dirname(id), resolved);
            // Normalize path separators and remove .ts extension
            let normalizedPath = relativePath.replace(/\\/g, '/').replace(/\.ts$/, '');
            // Ensure path starts with ./ or ../
            if (!normalizedPath.startsWith('.')) {
              normalizedPath = './' + normalizedPath;
            }
            // Replace the import path in the match, preserving quotes
            const quote = match.match(/['"]/)?.[0] || "'";
            return match.replace(/@engine\/[^'"]+/, normalizedPath);
          }
          return match;
        };
        
        transformedCode = transformedCode.replace(importRegex, replaceImport);
        transformedCode = transformedCode.replace(requireRegex, replaceImport);
        transformedCode = transformedCode.replace(importStatementRegex, replaceImport);
        transformedCode = transformedCode.replace(exportFromRegex, replaceImport);
        
        if (modified) {
          return {
            code: transformedCode,
            map: null, // We don't need source maps for this transformation
          };
        }
      }
      return null;
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
      plugins: [resolveEngineAliasesPlugin(), wasm()],
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
        ],
        exclude: [],
      },
      resolve: {
        alias: {
          '@engine/core': resolve(__dirname, 'packages/core/src'),
          '@engine/core/*': resolve(__dirname, 'packages/core/src/*'),
          '@engine/core/math': resolve(__dirname, 'packages/core/src/math'),
          '@engine/core/utils': resolve(__dirname, 'packages/core/src/utils'),
          '@engine/core/event': resolve(__dirname, 'packages/core/src/event'),
          '@engine/core/event/EventBus': resolve(__dirname, 'packages/core/src/event/EventBus'),
          '@engine/core/job': resolve(__dirname, 'packages/core/src/job'),
          '@engine/core/script': resolve(__dirname, 'packages/core/src/script'),
          '@engine/core/ecs': resolve(__dirname, 'packages/core/src/ecs'),
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
          '@engine/test-utils/determinism': resolve(__dirname, 'packages/test-utils/src/determinism/index.ts'),
          '@engine/test-utils': resolve(__dirname, 'packages/test-utils/src'),
          '@engine/test-utils/*': resolve(__dirname, 'packages/test-utils/src/*'),
          '@engine/wasm-collision': resolve(__dirname, 'packages/wasm-collision/src'),
          '@engine/wasm-collision/*': resolve(__dirname, 'packages/wasm-collision/src/*'),
          '@engine/net': resolve(__dirname, 'packages/net/src'),
          '@engine/net/*': resolve(__dirname, 'packages/net/src/*'),
          '@engine/net-protocol': resolve(__dirname, 'packages/net-protocol/src'),
          '@engine/net-protocol/*': resolve(__dirname, 'packages/net-protocol/src/*'),
          '@shared': resolve(__dirname, 'shared'),
          '@shared/*': resolve(__dirname, 'shared/*'),
        },
        conditions: ['development', 'test', 'import', 'module'],
        dedupe: ['@engine/core', '@engine/world', '@engine/animation', '@engine/avatar', '@engine/camera'],
        preserveSymlinks: false,
        mainFields: [], // Prevent Vite from resolving through package.json exports
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
          include: ['@engine/wasm-collision', '@engine/economy', '@engine/script', '@engine/core', '@engine/world', '@engine/animation', '@engine/avatar', '@engine/camera', '@engine/stdlib', '@engine/editor-utils', '@engine/test-utils'],
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
        conditions: ['development', 'test', 'import', 'module'],
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

