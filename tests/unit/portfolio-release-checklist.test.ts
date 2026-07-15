import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('tools/portfolio-release-checklist.mjs');

function runChecklist(): string {
  return execFileSync('node', [script], { encoding: 'utf8' });
}

function runChecklistJson(): unknown {
  return JSON.parse(execFileSync('node', [script, '--json'], { encoding: 'utf8' }));
}

describe('公开试玩发布清单', () => {
  it('只输出非部署清单并保留公开边界', () => {
    const output = runChecklist();

    expect(output).toContain('不提交、不推送、不部署、不修改 GitHub 设置');
    expect(output).toContain('pnpm portfolio:mvp-preflight -- --keep-public-tree');
    expect(output).toContain('pnpm test:browser:pages');
    expect(output).toContain('禁止直接上传当前完整仓库');
    expect(output).toContain('README.md、CONTRIBUTING.md、SECURITY.md、LICENSE、CONTENT-LICENSE.md、CHANGELOG.md');
    expect(output).toContain('不得上传设计类文档、docs/、AGENTS.md、CLAUDE.md、assets/ART-ASSETS-STATUS.md');
    expect(output).toContain('在公开树内复查 docs/、AGENTS.md、CLAUDE.md、.omc/、.agents/、.codex/、.claude/ 均不存在');
    expect(output).toContain('Settings -> Pages 的 Source 设为 GitHub Actions');
    expect(output).toContain('ENABLE_PAGES=true 闸门保护');
    expect(output).toContain('确认仓库 Homepage 指向 https://Rethymus.github.io/AeonVale/');
    expect(output).toContain('https://Rethymus.github.io/AeonVale/');
    expect(output).toContain('《星露谷物语》对照验收');
    expect(output).toContain('低门槛日循环：至少能完成翻地、播种、浇水、过夜、收获、出货、补种');
    expect(output).toContain('差异化内核：炼丹、阵法、淬体、主动引劫');
    expect(output).toContain('Go / No-Go 证据');
    expect(output).toContain('4 张 test-results/portfolio/*.png 截图为本次生成');
    expect(output).toContain('test-results/portfolio/portfolio-mvp-evidence.json 由本次 portfolio:capture 生成');
    expect(output).toContain('runtimeSignals.todayBriefingProof 包含农庄、炼丹、引劫、首轮进度：10/10');
    expect(output).toContain('screenshotEvidence：4 张截图尺寸均为 960x540');
    expect(output).toContain('paintedRatio 达到阈值，colors 达到阈值');
    expect(output).toContain('该文件仍是生成物，不进入公开树');
    expect(output).toContain('真实 Pages URL 尚未通过 pnpm test:browser:pages 前，不得宣称 P0-B GitHub Pages 闭环完成');
    expect(output).toContain('对标范围与优先级复核');
    expect(output).toContain('以《星露谷物语》作为长期生活感参照');
    expect(output).toContain('P0 只要求公开试玩版与 GitHub Pages 部署闭环成立');
    expect(output).toContain('P1 再推进独立游戏首版的可持续循环');
    expect(output).toContain('P2 才以 Patch / DLC 方式补人物、节日、地点、作物、收藏和长期叙事');
    expect(output).toContain('《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》');
  });

  it('输出公开安全的机器可读发布证据清单', () => {
    const checklist = runChecklistJson() as {
      title: string;
      generatedAt: string;
      pagesUrl: string;
      safety: string;
      sections: Array<{ title: string; items: string[] }>;
      requiredEvidence: Array<{ id: string; requiredSignals: string[]; blocker?: string; command?: string }>;
      authorizationRequired: string[];
      noGo: string[];
    };

    expect(checklist.title).toBe('Aeon Vale 公开试玩发布清单');
    expect(checklist.generatedAt).toBe('static-public-release-checklist');
    expect(checklist.pagesUrl).toBe('https://Rethymus.github.io/AeonVale/');
    expect(checklist.safety).toContain('不提交、不推送、不部署、不修改 GitHub 设置');
    expect(checklist.sections.map((section) => section.title)).toContain('6. 《星露谷物语》对照验收');
    expect(JSON.stringify(checklist.sections)).toContain('P0 只要求公开试玩版与 GitHub Pages 部署闭环成立');
    expect(JSON.stringify(checklist.sections)).toContain('P1 再推进独立游戏首版的可持续循环');
    expect(JSON.stringify(checklist.sections)).toContain('P2 才以 Patch / DLC 方式补人物、节日、地点、作物、收藏和长期叙事');
    expect(JSON.stringify(checklist.sections)).toContain('《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》');

    const evidenceById = new Map(checklist.requiredEvidence.map((evidence) => [evidence.id, evidence]));
    expect(evidenceById.get('portfolio-mvp-preflight')?.command).toBe('pnpm portfolio:mvp-preflight -- --keep-public-tree');
    expect(evidenceById.get('portfolio-evidence-json')?.requiredSignals.join('\n')).toContain('runtimeSignals.todayBriefingProof');
    expect(evidenceById.get('portfolio-screenshot-set')?.requiredSignals.join('\n')).toContain('screenshotEvidence');
    expect(evidenceById.get('live-pages-smoke')?.command).toBe('pnpm test:browser:pages');
    expect(evidenceById.get('live-pages-smoke')?.blocker).toBe('blocked-by-maintainer-authorization');
    expect(checklist.authorizationRequired).toContain('启用 GitHub Pages 或设置 ENABLE_PAGES=true');
    expect(checklist.noGo.join('\n')).toContain('真实 Pages URL 尚未通过 pnpm test:browser:pages');
  });
});
