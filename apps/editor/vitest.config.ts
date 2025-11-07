import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@engine/core': path.resolve(__dirname, '../../packages/core/src'),
      '@engine/world': path.resolve(__dirname, '../../packages/world/src'),
      '@engine/world-templates': path.resolve(__dirname, '../../packages/world-templates/src'),
      '@engine/gfx-webgpu': path.resolve(__dirname, '../../packages/gfx-webgpu/src'),
      '@engine/assets': path.resolve(__dirname, '../../packages/assets/src'),
      '@engine/script': path.resolve(__dirname, '../../packages/script/src'),
      '@engine/input': path.resolve(__dirname, '../../packages/input/src'),
      '@engine/camera': path.resolve(__dirname, '../../packages/camera/src'),
      '@engine/stdlib': path.resolve(__dirname, '../../packages/stdlib/src'),
      '@engine/voxel': path.resolve(__dirname, '../../packages/voxel/src'),
      '@engine/voxel/terrain': path.resolve(__dirname, '../../packages/voxel/src/terrain'),
      '@engine/economy': path.resolve(__dirname, '../../packages/economy/src'),
    },
  },
  optimizeDeps: {
    exclude: ['@engine/wasm-collision'],
  },
});

