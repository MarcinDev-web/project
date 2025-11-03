import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  const resolvePath = (p: string) => path.resolve(__dirname, p);
  
  // During build: externalize all @engine/* packages (use as external dependencies)
  // During dev: use source files for HMR
  const alias: Record<string, string> = isBuild
    ? {} // No aliases needed - packages will be externalized
    : {
        '@engine/core': resolvePath('../../packages/core/src'),
        '@engine/world': resolvePath('../../packages/world/src'),
        '@engine/world/components': resolvePath('../../packages/world/src/components'),
        '@engine/gfx-webgpu': resolvePath('../../packages/gfx-webgpu/src'),
        '@engine/input': resolvePath('../../packages/input/src'),
        '@engine/camera': resolvePath('../../packages/camera/src'),
        '@engine/stdlib': resolvePath('../../packages/stdlib/src'),
        '@engine/script': resolvePath('../../packages/script/src'),
        '@engine/editor-utils': resolvePath('../../packages/editor-utils/src'),
        '@engine/wasm-collision': resolvePath('../../packages/wasm-collision/src'),
        '@engine/avatar': resolvePath('../../packages/avatar/src'),
      };

  return {
    root: __dirname,
    assetsInclude: ['**/*.wasm'],
    resolve: {
      alias,
    },
    server: {
      port: 5174,
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

