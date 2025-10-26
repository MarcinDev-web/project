import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Workspace mode - projects defined in vitest.workspace.ts
  },
  // Optimize build performance
  optimizeDeps: {
    entries: [],
  },
  // Enable esbuild for faster transforms
  esbuild: {
    target: 'esnext',
    keepNames: true,
  },
});