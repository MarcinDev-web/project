import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { createEditorAlias } from './vite.alias';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const introHtmlPath = path.resolve(__dirname, 'intro.html');

export default defineConfig(({ command }) => {
  const isBuild = command === 'build';

  return {
    root: __dirname,
    appType: 'mpa',
    assetsInclude: ['**/*.wasm'],
    resolve: {
      alias: createEditorAlias(isBuild),
      conditions: ['import', 'module', 'browser', 'default'],
      preserveSymlinks: false,
    },
    server: {
      port: 5183,
      open: '/intro.html',
      strictPort: false,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      entries: [introHtmlPath],
      exclude: isBuild ? [] : ['@engine/*'],
    },
    build: {
      outDir: 'dist-intro',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          intro: introHtmlPath,
        },
        external: isBuild
          ? (id) => (id.startsWith('@engine/') ? true : false)
          : [],
      },
      commonjsOptions: {
        include: [/node_modules/],
      },
    },
  };
});


