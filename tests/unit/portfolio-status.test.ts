import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('tools/portfolio-status.mjs');

function runStatus(): string {
  return execFileSync('node', [script], { encoding: 'utf8' });
}

function runJsonStatus(): unknown {
  return JSON.parse(execFileSync('node', [script, '--json'], { encoding: 'utf8' }));
}

describe('公开试玩状态矩阵', () => {
  it('只输出公开安全状态并保留 P0/P1/P2 边界', () => {
    const output = runStatus();

    expect(output).toContain('不提交、不推送、不部署、不修改 GitHub 设置');
    expect(output).toContain('P0-A 本地可审版本');
    expect(output).toContain('pnpm portfolio:mvp-preflight -- --keep-public-tree');
    expect(output).toContain('P0-B GitHub Pages 公开展示');
    expect(output).toContain('维护者当次明确授权');
    expect(output).toContain('pnpm portfolio:pages-diagnose');
    expect(output).toContain('pnpm test:browser:pages');
    expect(output).toContain('https://Rethymus.github.io/AeonVale/');
    expect(output).toContain('P1 独立游戏首版循环');
    expect(output).toContain('P2 Patch / DLC 内容厚度');
    expect(output).toContain('《星露谷物语》是长期生活感参照');
    expect(output).toContain('翻地、播种、浇水、过夜、收获、出货、补种');
    expect(output).toContain('炼丹、阵法、淬体、主动引劫');
    expect(output).toContain('《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》');
    expect(output).toContain('对标维度');
    expect(output).toContain('P0 日循环（daily-loop）');
    expect(output).toContain('P0 公开发布可验证性（publishability）');
    expect(output).toContain('状态：pages-redeploy-required');
    expect(output).toContain('P2 内容体量（content-scale）');
    expect(output).toContain('证据产物');
    expect(output).toContain('P0-A public-demo-evidence-json');
    expect(output).toContain('test-results/portfolio/portfolio-mvp-evidence.json');
    expect(output).toContain('first-loop-complete onboarding objective');
    expect(output).toContain('screenshotEvidence paintedRatio and colors meet thresholds');
    expect(output).toContain('P0-B live-pages-smoke');
    expect(output).toContain('PLAYWRIGHT_SKIP_WEBSERVER=true smoke test hits the deployed URL');
    expect(output).toContain('每次重新部署后，真实 Pages URL 未通过 pnpm test:browser:pages 前，不宣称 GitHub Pages 闭环完成');
    expect(output).toContain('docs/、Agent 状态、生成物、.env*、sourcemap 和私有设计资料不得进入公开树、Pages 或 Release 产物');
  });

  it('可输出机器可读 JSON，供发布前对标检查复用', () => {
    const status = runJsonStatus() as {
      generatedAt: string;
      pagesUrl: string;
      safety: string;
      rows: Array<{ scope: string; status: string }>;
      dimensions: Array<{
        id: string;
        priority: string;
        dimension: string;
        stardewReference: string;
        xianxiaReference: string;
        evidence: string;
        status: string;
      }>;
      noGo: string[];
      evidenceArtifacts: Array<{
        id: string;
        priority: string;
        path: string;
        generatedBy: string;
        requiredSignals: string[];
        publicTreePolicy: string;
        reviewCommand: string;
      }>;
    };

    expect(status.generatedAt).toBe('static-public-status');
    expect(status.pagesUrl).toBe('https://Rethymus.github.io/AeonVale/');
    expect(status.safety).toContain('不提交、不推送、不部署、不修改 GitHub 设置');
    expect(status.rows.map(row => row.scope)).toEqual(['P0-A 本地可审版本', 'P0-B GitHub Pages 公开展示', 'P1 独立游戏首版循环', 'P2 Patch / DLC 内容厚度']);
    expect(status.dimensions.map(item => item.id)).toEqual(['daily-loop', 'economy-feedback', 'xianxia-differentiation', 'long-term-growth', 'social-commissions', 'world-events', 'content-scale', 'publishability']);
    expect(status.dimensions).toContainEqual(
      expect.objectContaining({
        id: 'daily-loop',
        priority: 'P0',
        stardewReference: expect.stringContaining('翻地、播种、浇水、过夜、收获、出货和补种'),
        xianxiaReference: expect.stringContaining('炼丹、阵法与引劫准备'),
        evidence: 'pnpm portfolio:mvp-preflight -- --keep-public-tree',
        status: 'local-review-ready'
      })
    );
    expect(status.dimensions).toContainEqual(
      expect.objectContaining({
        id: 'publishability',
        priority: 'P0',
        evidence: 'pnpm governance:readiness && pnpm portfolio:mvp-preflight -- --keep-public-tree && pnpm portfolio:pages-diagnose && pnpm test:browser:pages',
        status: 'pages-redeploy-required'
      })
    );
    expect(status.dimensions).toContainEqual(
      expect.objectContaining({
        id: 'content-scale',
        priority: 'P2',
        status: 'p2-deferred'
      })
    );
    expect(status.evidenceArtifacts).toContainEqual(
      expect.objectContaining({
        id: 'public-demo-evidence-json',
        priority: 'P0-A',
        path: 'test-results/portfolio/portfolio-mvp-evidence.json',
        generatedBy: 'pnpm portfolio:capture',
        reviewCommand: 'pnpm portfolio:mvp-preflight -- --keep-public-tree',
        requiredSignals: expect.arrayContaining(['first-loop-complete onboarding objective', '10/10 first-loop progress', 'today briefing proof includes farm, alchemy, tribulation, and 10/10 progress cues', 'remote-action authorization boundary']),
        publicTreePolicy: expect.stringContaining('must not enter the public tree')
      })
    );
    expect(status.evidenceArtifacts).toContainEqual(
      expect.objectContaining({
        id: 'public-demo-screenshot-set',
        priority: 'P0-A',
        path: 'test-results/portfolio/*.png',
        requiredSignals: expect.arrayContaining(['04-mobile-farm-loop.png 736x414 CSS-rendered small-viewport landscape keyboard-first PNG (compatibility filename)', 'screenshotEvidence paintedRatio and colors meet thresholds'])
      })
    );
    expect(status.evidenceArtifacts).toContainEqual(
      expect.objectContaining({
        id: 'live-pages-smoke',
        priority: 'P0-B',
        path: 'https://Rethymus.github.io/AeonVale/',
        generatedBy: 'maintainer-authorized GitHub Pages deployment',
        reviewCommand: 'pnpm portfolio:pages-diagnose && pnpm test:browser:pages',
        publicTreePolicy: expect.stringContaining('verified for private Pages')
      })
    );
    expect(status.noGo).toContain('每次重新部署后，真实 Pages URL 未通过 pnpm test:browser:pages 前，不宣称 GitHub Pages 闭环完成。');
  });
});
