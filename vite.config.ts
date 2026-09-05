import { defineConfig } from 'vite';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = typeof __dirname !== 'undefined' ? __dirname : resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? './',
  // assets/ 作为静态资产根。
  // 字体/精灵等资产放 assets/ 下，由 Vite 静态服务并随构建复制到 dist/。
  publicDir: 'assets',
  plugins: [
    {
      name: 'aeonvale-public-asset-scrub',
      closeBundle() {
        rmSync(resolve(here, 'dist/ART-ASSETS-STATUS.md'), { force: true });
        writeFileSync(resolve(here, 'dist/.nojekyll'), '');
      }
    }
  ],
  resolve: {
    alias: {
      '@sim': resolve(here, 'src/sim'),
      '@content': resolve(here, 'src/content'),
      '@render': resolve(here, 'src/render'),
      '@io': resolve(here, 'src/io'),
      '@app': resolve(here, 'src/app')
    }
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    // Pixi is intentionally kept as one vendor chunk to avoid Rollup circular chunk
    // warnings. Keep the warning gate above the current Pixi bundle but low enough
    // to catch real app-entry growth before the portfolio build gets sluggish.
    chunkSizeWarningLimit: 650,
    sourcemap: process.env.VITE_SOURCEMAP === 'true',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Pixi root entry pulls tightly-coupled subsystems together. Keeping it in one
            // vendor chunk avoids Rollup circular chunk warnings while still shrinking app entry size.
            if (id.includes('/pixi.js/')) return 'vendor-pixi';
            if (id.includes('/zod/')) return 'vendor-zod';
            return 'vendor';
          }
          // First-party regrouping only: these chunks are still statically imported, so
          // module evaluation order and runtime behavior are unchanged (the module graph
          // is acyclic; Rollup preserves order across chunk boundaries).
          // - app-sim: pure simulation core (src/sim, no IO/render deps).
          if (id.includes('/src/sim/')) return 'app-sim';
          // - app-render: Pixi rendering layer (src/render).
          if (id.includes('/src/render/')) return 'app-render';
          // - app-io / app-content: audio & asset adapters; content registry, i18n, scenes.
          if (id.includes('/src/io/')) return 'app-io';
          if (id.includes('/src/content/')) return 'app-content';
          // - app-narration: narration-mode cluster (narration* + firstPersonView, which is
          //   referenced only by narration surfaces).
          if (id.includes('/src/app/narration') || id.includes('/src/app/firstPersonView')) return 'app-narration';
          // - app-roguelite-proto: the roguelite-proto mode surface tree (rogueliteProto plus
          //   its exclusive cultivationRun surfaces).
          if (id.includes('/src/app/rogueliteProto/') || id.includes('/src/app/cultivationRun/')) {
            return 'app-roguelite-proto';
          }
          // Everything else (src/app shell + entry) stays in the index chunk.
          return undefined;
        }
      }
    }
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    fs: {
      // The repository path contains a colon, which Vite 6 can misclassify as an
      // out-of-root URL during local dev/Playwright serving even when it is allowed.
      strict: false
    }
  }
});
