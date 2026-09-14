#!/usr/bin/env node
/**
 * Windows 兼容的 Pages 线上冒烟启动器。
 *
 * package.json 的 npm script 无法使用 Unix env 前缀（`ENV=x cmd` 在 Windows
 * cmd.exe 下不被识别，曾使 portfolio:mvp-preflight 的 live 校验链在
 * Windows 上崩溃）。本启动器以进程内 env 注入替代前缀，再透传 Playwright。
 *
 * 用法：
 *   node tools/run-pages-smoke.mjs                              # 冒烟 tests/browser/smoke.spec.ts
 *   node tools/run-pages-smoke.mjs tests/browser/pages-playable.spec.ts
 */
import { spawnSync } from 'node:child_process';

process.env.PLAYWRIGHT_BASE_URL ??= 'https://Rethymus.github.io';
process.env.PLAYWRIGHT_GAME_BASE_PATH ??= '/AeonVale/';
process.env.PLAYWRIGHT_SKIP_WEBSERVER ??= 'true';

const target = process.argv.slice(2);
const specArgs = target.length > 0 ? target : ['tests/browser/smoke.spec.ts'];

const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', ...specArgs],
  { stdio: 'inherit', env: process.env, shell: process.platform === 'win32' }
);
process.exit(result.status ?? 1);
