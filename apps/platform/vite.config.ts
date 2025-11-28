import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { engineAliases } from '../../shared/config/aliases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    plugins: [react()],
    root: __dirname,
    assetsInclude: ['**/*.wasm'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        // During dev: use source files for HMR
        // During build: don't use aliases, let external resolution work
        ...(isBuild ? {} : engineAliases(__dirname)),
        '@shared': path.resolve(__dirname, '../../shared'),
        '@shared/types': path.resolve(__dirname, '../../shared/types'),
      },
      conditions: isBuild ? ['import', 'module', 'browser', 'default'] : ['import', 'module', 'browser', 'default'],
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
      rollupOptions: {
        // Externalize all @engine/* packages during build
        // They are already built and will be resolved via package.json exports
        external: isBuild
          ? (id) => {
              if (id.startsWith('@engine/')) {
                return true;
              }
              return false;
            }
          : [],
      },
    },
    optimizeDeps: {
      exclude: isBuild ? [] : ['@engine/*'],
    },
  };
});
