import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { engineAliases } from '../../shared/config/aliases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to normalize paths for Vite (needed on Windows)
const normalizePath = (p: string) => p.split(path.sep).join('/');

// Plugin to mock WASM files during tests
const wasmIgnorePlugin = {
  name: 'wasm-ignore',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id.endsWith('.wasm')) {
      return id;
    }
    return null;
  },
  load(id: string) {
    if (id.endsWith('.wasm')) {
      return 'export default {}; export const memory = new WebAssembly.Memory({initial: 1});';
    }
    return null;
  }
};

export default defineConfig({
  plugins: [wasmIgnorePlugin],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/__tests__/e2e/**'],
  },
  resolve: {
    alias: [
      // Force alias to mock file for tests to avoid WASM loading issues (must be first)
      { 
        find: '@engine/wasm-collision', 
        replacement: normalizePath(path.join(__dirname, 'src/test/mocks/wasm-collision.ts')) 
      },
      // Also alias the resolved source file in case tsconfig paths are used
      {
        find: path.resolve(__dirname, '../../packages/wasm-collision/src/index.ts'),
        replacement: normalizePath(path.join(__dirname, 'src/test/mocks/wasm-collision.ts'))
      },
      ...Object.entries(engineAliases(__dirname)).map(([find, replacement]) => ({ 
        find, 
        replacement: normalizePath(replacement) 
      })),
    ],
    conditions: ['development', 'test', 'import', 'module'],
    preserveSymlinks: false,
    mainFields: [], // Prevent Vite from resolving through package.json exports
  },
  optimizeDeps: {
    // exclude: ['@engine/wasm-collision'], // Removed exclusion since we mock it
  },
});

