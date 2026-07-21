import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('tools/prepare-public-tree.mjs');
const rules = resolve('tools/public-tree-rules.mjs');
const temps: string[] = [];

function write(root: string, file: string, text: string): void {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makeSourceRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aeonvale-public-source-'));
  temps.push(dir);

  execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
  mkdirSync(join(dir, 'tools'), { recursive: true });
  cpSync(script, join(dir, 'tools/prepare-public-tree.mjs'), { recursive: true });
  cpSync(rules, join(dir, 'tools/public-tree-rules.mjs'), { recursive: true });

  write(dir, 'README.md', '# public readme');
  write(dir, 'CHANGELOG.md', '# public changelog');
  write(dir, 'CONTENT-LICENSE.md', '# public content license');
  write(dir, 'AGENTS.md', '# private agent entry');
  write(dir, 'CLAUDE.md', '# private agent entry');
  write(dir, 'CONTRIBUTING.md', '# public contribution policy');
  write(dir, 'SECURITY.md', '# public security policy');
  write(dir, '.github/pull_request_template.md', '# public PR template');
  write(dir, '.github/ISSUE_TEMPLATE/bug.md', '# public issue template');
  write(dir, 'DESIGN-NOTES.md', '# private root design notes');
  write(dir, 'src/app/main.ts', 'export const ok = true;\n');
  write(
    dir,
    'assets/manifest.json',
    JSON.stringify(
      {
        version: 1,
        sprites: [
          {
            id: 'logo.full',
            path: 'logo/logo-full.png',
            type: 'png',
            checksum: 'a'.repeat(64),
            license: 'AI-Generated',
            source: 'public-safe summary',
            src: {
              model: 'gpt-image-2',
              endpoint: 'https://fast.qianxing.us.ci/v1',
              prompt: 'private art direction prompt',
              seed: null,
              master_ref: ['reference.master.cozy-warm-farm-v1'],
              ref_imgs: [],
              generated_at: '2026-07-17T00:00:00.000Z'
            },
            human_edits: ['crop', 'font composite'],
            ai_disclosed: true
          },
          {
            id: 'reference.master.cozy-warm-farm-v1',
            path: 'references/master-cozy-warm-farm-v1.png',
            type: 'png',
            checksum: 'b'.repeat(64),
            license: 'AI-Generated',
            source: 'private master reference',
            src: {
              model: 'gpt-image-2',
              endpoint: 'https://fast.qianxing.us.ci/v1',
              prompt: 'cozy warm farm master reference prompt',
              seed: null,
              master_ref: [],
              ref_imgs: [],
              generated_at: '2026-07-17T00:00:00.000Z'
            },
            human_edits: [],
            ai_disclosed: true
          }
        ],
        audio: [],
        fonts: [],
        shaders: []
      },
      null,
      1
    )
  );
  write(dir, 'docs/00-DESIGN-BRIEF.md', '# private design');
  write(dir, '.planning/patches/01bf653-pixel-ambient.patch', 'private local planning patch');
  write(dir, 'assets/ART-ASSETS-STATUS.md', '# private art status');
  write(dir, 'assets/references/master-cozy-warm-farm-v1.png', 'not-public');
  write(dir, '.omc/state/session.json', '{}');
  write(dir, '.superpowers/brainstorm/session.html', '<!doctype html>');
  write(dir, '.public-tree/README.md', '# stale public tree');
  write(dir, 'dist/assets/index.js.map', '{}');
  write(dir, 'tmp/visual-audit/report.json', '{}');
  write(dir, '.env.local', 'SECRET=value');

  execFileSync('git', ['add', '-A'], { cwd: dir, stdio: 'ignore' });
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('公开树生成脚本', () => {
  it('只复制公开源码和治理文档，排除设计资料、本地状态、构建产物与暂存公开树', () => {
    const source = makeSourceRepo();
    const target = join(mkdtempSync(join(tmpdir(), 'aeonvale-public-target-')), 'public');
    temps.push(dirname(target));

    const output = execFileSync('node', ['tools/prepare-public-tree.mjs', target], {
      cwd: source,
      encoding: 'utf8'
    });

    expect(output).toContain('excluded design docs and local state');
    expect(output).toContain('install --frozen-lockfile --ignore-scripts');
    expect(output).toContain('governance:readiness');
    expect(existsSync(join(target, 'README.md'))).toBe(true);
    expect(existsSync(join(target, 'CHANGELOG.md'))).toBe(true);
    expect(existsSync(join(target, 'CONTENT-LICENSE.md'))).toBe(true);
    expect(existsSync(join(target, 'CONTRIBUTING.md'))).toBe(true);
    expect(existsSync(join(target, 'SECURITY.md'))).toBe(true);
    expect(existsSync(join(target, '.github/pull_request_template.md'))).toBe(true);
    expect(existsSync(join(target, '.github/ISSUE_TEMPLATE/bug.md'))).toBe(true);
    expect(existsSync(join(target, 'src/app/main.ts'))).toBe(true);
    expect(existsSync(join(target, 'assets/manifest.json'))).toBe(true);

    expect(existsSync(join(target, 'AGENTS.md'))).toBe(false);
    expect(existsSync(join(target, 'CLAUDE.md'))).toBe(false);
    expect(existsSync(join(target, 'DESIGN-NOTES.md'))).toBe(false);
    expect(existsSync(join(target, 'docs/00-DESIGN-BRIEF.md'))).toBe(false);
    expect(existsSync(join(target, '.planning/patches/01bf653-pixel-ambient.patch'))).toBe(false);
    expect(existsSync(join(target, 'assets/ART-ASSETS-STATUS.md'))).toBe(false);
    expect(existsSync(join(target, 'assets/references/master-cozy-warm-farm-v1.png'))).toBe(false);
    expect(existsSync(join(target, '.omc/state/session.json'))).toBe(false);
    expect(existsSync(join(target, '.superpowers/brainstorm/session.html'))).toBe(false);
    expect(existsSync(join(target, '.public-tree/README.md'))).toBe(false);
    expect(existsSync(join(target, 'dist/assets/index.js.map'))).toBe(false);
    expect(existsSync(join(target, 'tmp/visual-audit/report.json'))).toBe(false);
    expect(existsSync(join(target, '.env.local'))).toBe(false);

    const publicManifest = JSON.parse(execFileSync('cat', [join(target, 'assets/manifest.json')], { encoding: 'utf8' }));
    expect(publicManifest.sprites).toHaveLength(1);
    expect(publicManifest.sprites[0]?.id).toBe('logo.full');
    expect(publicManifest.sprites[0]?.src).toBeUndefined();
    expect(publicManifest.sprites[0]?.human_edits).toBeUndefined();
    expect(publicManifest.sprites[0]?.ai_disclosed).toBe(true);
  });
});
