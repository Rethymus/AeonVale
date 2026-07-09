import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = typeof __dirname !== 'undefined' ? __dirname : resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@sim': resolve(here, 'src/sim'),
      '@content': resolve(here, 'src/content'),
      '@render': resolve(here, 'src/render'),
      '@io': resolve(here, 'src/io'),
      '@app': resolve(here, 'src/app'),
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
