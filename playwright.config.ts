import { defineConfig, devices } from '@playwright/test';

const host = '127.0.0.1';
const port = process.env.PLAYWRIGHT_PREVIEW_PORT ?? '4174';
const appDir = process.env.PLAYWRIGHT_APP_DIR ?? '.';
const viteBasePath = process.env.PLAYWRIGHT_VITE_BASE_PATH ?? './';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';

export default defineConfig({
 testDir: './tests/browser',
 outputDir: 'test-results/playwright',
 retries: process.env.CI ? 1 : 0,
 workers: process.env.CI ? 1 : undefined,
 reporter: process.env.CI ? 'github' : 'list',
 use: { baseURL, trace: 'on-first-retry' },
 webServer: skipWebServer ? undefined : {
 command: `pnpm --dir ${appDir} build && pnpm --dir ${appDir} preview --host ${host} --port ${port}`,
 url: `http://${host}:${port}`,
 reuseExistingServer: false,
 env: {
 PUBLIC_BUILD: 'true',
 VITE_BASE_PATH: viteBasePath,
 VITE_PRESERVE_DRAWING_BUFFER: 'true',
 },
 },
 projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-gl=swiftshader'] } } }],
});
