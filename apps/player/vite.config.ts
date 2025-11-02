import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const resolvePath = (p: string) => path.resolve(__dirname, p);
  // Use src for both dev and build (consistent with editor)
  const alias: Record<string, string> = {
    '@engine/core': resolvePath('../../packages/core/src'),
    '@engine/world': resolvePath('../../packages/world/src'),
    '@engine/world/components': resolvePath('../../packages/world/src/components'),
    '@engine/gfx-webgpu': resolvePath('../../packages/gfx-webgpu/src'),
    '@engine/input': resolvePath('../../packages/input/src'),
    '@engine/camera': resolvePath('../../packages/camera/src'),
    '@engine/stdlib': resolvePath('../../packages/stdlib/src'),
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
    },
  };
});

