import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEditorAlias } from './vite.alias';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  
  // During build: externalize all @engine/* packages (use as external dependencies)
  // During dev: use source files for HMR
  const alias = createEditorAlias(isBuild);

  return {
    root: __dirname,
    assetsInclude: ['**/*.wasm'],
    worker: {
      format: 'es',
    },
    resolve: {
      alias,
      conditions: isBuild ? ['import', 'module', 'browser', 'default'] : ['import', 'module', 'browser', 'default'],
      preserveSymlinks: false,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
      },
      rollupOptions: {
        // Externalize all @engine/* packages during build
        // They are already built and will be resolved via package.json exports
        external: isBuild
          ? (id) => {
              // Externalize all workspace packages
              if (id.startsWith('@engine/')) {
                return true;
              }
              // Keep other dependencies internal (node_modules, etc.)
              return false;
            }
          : [],
        output: {
          // Generate proper external imports
          globals: isBuild
            ? {} // ES modules don't use globals
            : undefined,
        },
      },
    },
    optimizeDeps: {
      exclude: isBuild ? [] : ['@engine/*'],
    },
  };
});

