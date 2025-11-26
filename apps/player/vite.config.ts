import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  const resolvePath = (p: string) => path.resolve(__dirname, p);
  
  // During build: externalize all @engine/* packages (use as external dependencies)
  // During dev: use source files for HMR
  // @shared is always bundled (not externalized)
  const sharedAlias = {
    '@shared': resolvePath('../../shared'),
  };
  
  const alias: Record<string, string> = isBuild
    ? sharedAlias // Only @shared alias needed - @engine packages will be externalized
    : {
        ...sharedAlias,
        '@engine/core': '../../packages/core/src',
        '@engine/world/components': '../../packages/world/src/components',
        '@engine/world': '../../packages/world/src',
        '@engine/gfx-webgpu': '../../packages/gfx-webgpu/src',
        '@engine/input': '../../packages/input/src',
        '@engine/camera': '../../packages/camera/src',
        '@engine/stdlib': '../../packages/stdlib/src',
        '@engine/script': '../../packages/script/src',
        '@engine/editor-utils': '../../packages/editor-utils/src',
        '@engine/wasm-collision': '../../packages/wasm-collision/src',
        '@engine/avatar': '../../packages/avatar/src',
      };

  return {
    root: __dirname,
    plugins: [react()],
    assetsInclude: ['**/*.wasm'],
    resolve: {
      alias,
    },
    server: {
      port: 5175,
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
  };
});

