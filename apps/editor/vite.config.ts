import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';
  const resolvePath = (p: string) => path.resolve(__dirname, p);
  const alias: Record<string, string> = isBuild
    ? {
        '@engine/wasm-collision': resolvePath('../../packages/wasm-collision/dist/index.js'),
        '@engine/net': resolvePath('../../packages/net/dist/src/index.js'),
        '@engine/world-templates': resolvePath('../../packages/world-templates/dist/index.js'),
      }
    : {
        '@engine/core': resolvePath('../../packages/core/src'),
        '@engine/animation': resolvePath('../../packages/animation/src'),
        '@engine/world': resolvePath('../../packages/world/src'),
        '@engine/world/components': resolvePath('../../packages/world/src/components'),
        '@engine/world-templates': resolvePath('../../packages/world-templates/src'),
        '@engine/gfx-webgpu': resolvePath('../../packages/gfx-webgpu/src'),
        '@engine/assets': resolvePath('../../packages/assets/src'),
        '@engine/script': resolvePath('../../packages/script/src'),
        '@engine/input': resolvePath('../../packages/input/src'),
        '@engine/camera': resolvePath('../../packages/camera/src'),
        '@engine/avatar': resolvePath('../../packages/avatar/src'),
        '@engine/stdlib': resolvePath('../../packages/stdlib/src'),
        '@engine/wasm-collision': resolvePath('../../packages/wasm-collision/src'),
        '@engine/net': resolvePath('../../packages/net/src'),
        '@engine/editor-utils': resolvePath('../../packages/editor-utils/src'),
        '@engine/voxel': resolvePath('../../packages/voxel/src'),
        '@engine/voxel/terrain': resolvePath('../../packages/voxel/src/terrain'),
        '@engine/economy': resolvePath('../../packages/economy/src'),
      };

  return {
    root: __dirname,
    assetsInclude: ['**/*.wasm'],
    worker: {
      format: 'es',
    },
    resolve: {
      alias,
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
    },
  };
});

