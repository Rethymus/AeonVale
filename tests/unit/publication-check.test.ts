import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * 单分支发布检查测试：守护「本地状态/密钥不入库 + README 存在」。
 * 旧双分支「docs/ 不入公开树」断言随模型退役（见 docs/github-publication-design.md 归档注记）。
 */
const script = resolve('tools/publication-check.mjs');
const repoRoot = resolve('.');

function runCheck(dir: string): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('node', [script], { cwd: dir, encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

function makeFixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'aeon-pubcheck-'));
  // 用 git init 让 ls-files 工作
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [file, content] of Object.entries(files)) {
    const path = join(dir, file);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
    execFileSync('git', ['add', file], { cwd: dir });
  }
  return dir;
}

describe('单分支发布检查', () => {
  it('真实仓库通过检查', () => {
    const result = runCheck(repoRoot);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Publication check passed');
  });

  it('跟踪 Agent 本地状态目录时失败', () => {
    const dir = makeFixture({ 'README.md': '# Aeon Vale\n', '.claude/skills/x/SKILL.md': 'x' });
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.claude/');
    rmSync(dir, { recursive: true, force: true });
  });

  it('跟踪 .env 系文件时失败', () => {
    const dir = makeFixture({ 'README.md': '# Aeon Vale\n', '.env.local': 'SECRET=1' });
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('environment file');
    rmSync(dir, { recursive: true, force: true });
  });

  it('跟踪生成目录（test-results/tmp）时失败', () => {
    const dir = makeFixture({ 'README.md': '# Aeon Vale\n', 'tmp/probe.ts': 'x' });
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('tmp/');
    rmSync(dir, { recursive: true, force: true });
  });

  it('缺 README 时失败', () => {
    const dir = makeFixture({ 'src/app.ts': 'x' });
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('README.md');
    rmSync(dir, { recursive: true, force: true });
  });
});
