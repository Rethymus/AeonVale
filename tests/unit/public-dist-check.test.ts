import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('tools/public-dist-check.mjs');
const temps: string[] = [];

function makeCase(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aeonvale-dist-check-'));
  temps.push(dir);
  mkdirSync(join(dir, 'dist/assets'), { recursive: true });
  mkdirSync(join(dir, 'dist/logo'), { recursive: true });
  writeFileSync(join(dir, 'dist/.nojekyll'), '');
  writeFileSync(
    join(dir, 'dist/index.html'),
    '<!doctype html><title>Aeon Vale</title><link rel="icon" href="./logo/favicon-32.png"><link rel="stylesheet" href="./assets/index.css"><script type="module" src="./assets/index.js"></script>',
  );
  writeFileSync(join(dir, 'dist/logo/favicon-32.png'), 'png');
  writeFileSync(join(dir, 'dist/assets/index.css'), 'body{}');
  writeFileSync(join(dir, 'dist/assets/index.js'), 'console.log("ok");');
  return dir;
}

function runDistCheck(cwd: string): string {
  return execFileSync('node', [script], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('公开构建产物检查', () => {
  it('允许干净的浏览器构建产物', () => {
    const dir = makeCase();
    expect(runDistCheck(dir)).toContain('Public dist check passed');
  });

it('允许 GitHub Pages base path 下的本地资源引用', () => {
    const dir = makeCase();
    writeFileSync(
      join(dir, 'dist/index.html'),
      '<!doctype html><title>Aeon Vale</title><link rel="icon" href="/AeonVale/logo/favicon-32.png"><script type="module" src="/AeonVale/assets/index.js"></script>',
    );

expect(runDistCheck(dir)).toContain('Public dist check passed');
  });

it('要求 GitHub Pages .nojekyll 标记', () => {
    const dir = makeCase();
    rmSync(join(dir, 'dist/.nojekyll'));
    expect(() => runDistCheck(dir)).toThrow(/dist\/\.nojekyll must exist/);
  });

it('要求 GitHub Pages index.html 入口', () => {
    const dir = makeCase();
    rmSync(join(dir, 'dist/index.html'));
    expect(() => runDistCheck(dir)).toThrow(/dist\/index\.html must exist/);
  });

it('要求 index.html 加载模块 JavaScript 入口', () => {
    const dir = makeCase();
    writeFileSync(join(dir, 'dist/index.html'), '<!doctype html><title>Aeon Vale</title>');
    expect(() => runDistCheck(dir)).toThrow(/module JavaScript entry/);
  });

it('拒绝生产 sourcemap', () => {
    const dir = makeCase();
    writeFileSync(join(dir, 'dist/assets/index.js.map'), '{}');
    expect(() => runDistCheck(dir)).toThrow(/production sourcemap/);
  });

it('拒绝误打进 dist 的设计文档', () => {
    const dir = makeCase();
    mkdirSync(join(dir, 'dist/docs'), { recursive: true });
    writeFileSync(join(dir, 'dist/docs/00-DESIGN-BRIEF.md'), '# private');
    expect(() => runDistCheck(dir)).toThrow(/private design docs/);
  });

it('拒绝 index.html 引用不存在的本地资源', () => {
    const dir = makeCase();
    writeFileSync(
      join(dir, 'dist/index.html'),
      '<!doctype html><title>Aeon Vale</title><link rel="icon" href="./logo/missing.png"><script type="module" src="./assets/index.js"></script>',
    );
    expect(() => runDistCheck(dir)).toThrow(/missing local asset/);
  });
});
