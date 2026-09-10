import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = resolve('tools/public-readiness-check.mjs');
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

function makeFixtureDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aeon-readiness-'));
  mkdirSyncRecursive(dir, '.github/workflows');
  mkdirSyncRecursive(dir, 'tools');
  mkdirSyncRecursive(dir, 'assets/logo');
  mkdirSyncRecursive(dir, 'assets/screenshots');
  return dir;
}

function mkdirSyncRecursive(base: string, rel: string): void {
  const parts = rel.split('/');
  let cur = base;
  for (const part of parts) {
    cur = join(cur, part);
    try {
      require('node:fs').mkdirSync(cur);
    } catch {
      /* 已存在 */
    }
  }
}

function writeReadyFixture(dir: string): void {
  const workflows = [
    ['ci.yml', ['uses: gitleaks/gitleaks-action@v3', 'pnpm governance:readiness', 'VITE_BASE_PATH: /AeonVale/', 'name: aeonvale-pages-dist-${{ github.sha }}', 'pnpm test:browser']],
    ['pages.yml', ['workflow_run:', 'actions/download-artifact@v4']],
    ['release.yml', ['workflow_dispatch:', 'cd dist && zip']]
  ] as const;
  for (const [name, lines] of workflows) {
    writeFileSync(join(dir, `.github/workflows/${name}`), `${lines.join('\n')}\n`);
  }
  for (const doc of ['README.md', 'SECURITY.md', 'LICENSE', 'CONTENT-LICENSE.md', 'CHANGELOG.md', '.github/pull_request_template.md']) {
    writeFileSync(join(dir, doc), 'ok\n');
  }
  writeFileSync(join(dir, 'CONTRIBUTING.md'), 'Pages 与 Release 产物只包含构建出的 dist，不得混入设计文档、Agent 状态或 sourcemap\n');
  writeFileSync(join(dir, 'playwright.config.ts'), 'export default {};\n');
  for (const tool of ['portfolio-mvp-preflight.mjs', 'portfolio-status.mjs', 'portfolio-release-checklist.mjs', 'portfolio-pages-diagnose.mjs', 'portfolio-pages-watch.mjs', 'publication-check.mjs', 'public-dist-check.mjs']) {
    writeFileSync(join(dir, `tools/${tool}`), 'export {};\n');
  }
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'portfolio:capture': 'playwright tests/browser/portfolio-capture.spec.ts',
        'test:browser:pages': 'playwright pages smoke'
      }
    })
  );
  writeFileSync(join(dir, '.gitignore'), ['.env', 'node_modules/', 'dist/', '.public-tree/', 'coverage/'].join('\n'));
  writeFileSync(join(dir, 'assets/logo/logo-emblem.png'), 'png');
  writeFileSync(join(dir, 'assets/screenshots/roguelite-prep.png'), 'png');
  writeFileSync(join(dir, 'assets/screenshots/tribulation-sokoban.gif'), 'gif');
}

describe('release readiness check（单分支模型）', () => {
  it('真实仓库通过检查', () => {
    const result = runCheck(repoRoot);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Release readiness check passed');
  });

  it('缺少治理文档时失败并点名缺失文件', () => {
    const dir = makeFixtureDir();
    writeReadyFixture(dir);
    rmSync(join(dir, 'SECURITY.md'));
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('SECURITY.md');
    rmSync(dir, { recursive: true, force: true });
  });

  it('package.json 缺发布脚本或指向错误仓库时失败', () => {
    const dir = makeFixtureDir();
    writeReadyFixture(dir);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    delete pkg.scripts['governance:dist'];
    pkg.repository.url = 'https://github.com/wrong/repo.git';
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('governance:dist');
    expect(result.stderr).toContain('repository.url');
    rmSync(dir, { recursive: true, force: true });
  });

  it('CI 工作流缺密钥扫描或 Pages 产物上传时失败', () => {
    const dir = makeFixtureDir();
    writeReadyFixture(dir);
    writeFileSync(join(dir, '.github/workflows/ci.yml'), 'run: pnpm test\n');
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('secret scanning');
    expect(result.stderr).toContain('Pages dist artifact');
    rmSync(dir, { recursive: true, force: true });
  });

  it('.gitignore 漏掉 dist 或 .env 时失败', () => {
    const dir = makeFixtureDir();
    writeReadyFixture(dir);
    writeFileSync(join(dir, '.gitignore'), ['node_modules/', 'coverage/'].join('\n'));
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.env');
    expect(result.stderr).toContain('dist/');
    rmSync(dir, { recursive: true, force: true });
  });

  it('缺少 README 媒体资产时失败', () => {
    const dir = makeFixtureDir();
    writeReadyFixture(dir);
    rmSync(join(dir, 'assets/screenshots/tribulation-sokoban.gif'));
    const result = runCheck(dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('tribulation-sokoban.gif');
    rmSync(dir, { recursive: true, force: true });
  });
});
