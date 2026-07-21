import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('tools/publication-check.mjs');
const temps: string[] = [];

function write(root: string, file: string, text: string): void {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makePublicTree(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aeonvale-public-check-'));
  temps.push(dir);

  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  write(dir, 'README.md', '# Aeon Vale\n');
  write(dir, 'CONTRIBUTING.md', '# Contribution policy\n');
  write(dir, 'SECURITY.md', '# Security policy\n');
  write(dir, 'CONTENT-LICENSE.md', '# Content license\n');
  write(dir, 'CHANGELOG.md', '# Changelog\n');
  write(dir, 'LICENSE', 'MIT\n');
  write(dir, '.github/pull_request_template.md', '# PR\n');
  write(dir, '.github/ISSUE_TEMPLATE/bug.md', '# Bug\n');
  write(dir, 'src/app/main.ts', 'export const ok = true;\n');
  execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });

  return dir;
}

function runPublicationCheck(cwd: string): string {
  return execFileSync('node', [script], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('公开树发布检查', () => {
  it('允许 README、贡献、安全、许可证、变更记录和 GitHub 模板等治理文档', () => {
    const dir = makePublicTree();
    expect(runPublicationCheck(dir)).toContain('Public publication check passed');
  });

  it('拒绝 docs 下的设计文档', () => {
    const dir = makePublicTree();
    write(dir, 'docs/00-DESIGN-BRIEF.md', '# private design\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });

    expect(() => runPublicationCheck(dir)).toThrow(/forbidden design document/);
  });

  it('拒绝本地规划目录进入公开树', () => {
    const dir = makePublicTree();
    write(dir, '.planning/patches/01bf653-pixel-ambient.patch', 'private local planning patch\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });

    expect(() => runPublicationCheck(dir)).toThrow(/forbidden planning document/);
  });

  it('拒绝美术状态文档', () => {
    const dir = makePublicTree();
    write(dir, 'assets/ART-ASSETS-STATUS.md', '# private art status\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });

    expect(() => runPublicationCheck(dir)).toThrow(/forbidden design\/status document/);
  });

  it('拒绝非白名单 Markdown 文档', () => {
    const dir = makePublicTree();
    write(dir, 'DESIGN-NOTES.md', '# private design notes\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });

    expect(() => runPublicationCheck(dir)).toThrow(/forbidden markdown document/);
  });

  it('拒绝 Agent 入口文档进入公开树', () => {
    const dir = makePublicTree();
    write(dir, 'AGENTS.md', '# private agent entry\n');
    write(dir, 'CLAUDE.md', '# private agent entry\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });

    expect(() => runPublicationCheck(dir)).toThrow(/forbidden markdown document/);
  });

  it('拒绝 README 引用未公开设计目录或 Agent 入口文档', () => {
    const dir = makePublicTree();
    write(dir, 'README.md', 'See docs/00-DESIGN-BRIEF.md, .planning/ROADMAP.md, and AGENTS.md.\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });

    expect(() => runPublicationCheck(dir)).toThrow(/README\.md references private or unpublished document pattern/);
  });
});
