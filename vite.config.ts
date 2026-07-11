import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = typeof __dirname !== 'undefined' ? __dirname : resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? './',
  // assets/ 作为静态资产根（docs/13 §5.2：开发直接读盘、生产打入 dist/）。
  // 字体/精灵等资产放 assets/ 下，由 Vite 静态服务并随构建复制到 dist/。
  publicDir: 'assets',
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
    sourcemap: process.env.PUBLIC_BUILD !== 'true',
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
