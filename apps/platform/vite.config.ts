import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  assetsInclude: ['**/*.wasm'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@engine/core': path.resolve(__dirname, '../../packages/core/src'),
      '@engine/world': path.resolve(__dirname, '../../packages/world/src'),
      '@engine/world/components': path.resolve(__dirname, '../../packages/world/src/components'),
      '@engine/gfx-webgpu': path.resolve(__dirname, '../../packages/gfx-webgpu/src'),
      '@engine/avatar': path.resolve(__dirname, '../../packages/avatar/src'),
      '@engine/blocks': path.resolve(__dirname, '../../packages/blocks/src'),
      '@engine/camera': path.resolve(__dirname, '../../packages/camera/src'),
      '@engine/script': path.resolve(__dirname, '../../packages/script/src'),
      '@engine/net': path.resolve(__dirname, '../../packages/net/src'),
      '@engine/net-protocol': path.resolve(__dirname, '../../packages/net-protocol/src'),
      '@shared': path.resolve(__dirname, '../../shared'),
      '@shared/types': path.resolve(__dirname, '../../shared/types'),
    },
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
});

