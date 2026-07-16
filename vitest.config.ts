import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = typeof __dirname !== 'undefined' ? __dirname : resolve(fileURLToPath(import.meta.url), '..');

export default defineConfig({
  resolve: {
    alias: {
      '@sim': resolve(here, 'src/sim'),
      '@content': resolve(here, 'src/content'),
      '@render': resolve(here, 'src/render'),
      '@io': resolve(here, 'src/io'),
      '@app': resolve(here, 'src/app')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      include: ['src/sim/**/*.ts'],
      reporter: ['text', 'html']
    }
  }
});
