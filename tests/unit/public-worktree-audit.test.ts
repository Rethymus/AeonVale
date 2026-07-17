import { describe, expect, it } from 'vitest';

import { auditPublicWorktree, classifyPublicCandidateGroup, shouldFailPublicWorktreeAudit } from '../../tools/public-worktree-audit.mjs';

describe('公开工作区审查', () => {
  it('按公开树边界分类未提交路径', () => {
    const report = auditPublicWorktree([' M README.md', ' M src/app/main.ts', ' M docs/00-DESIGN-BRIEF.md', '?? DESIGN-NOTES.md', ' D .omc/state/session.json', '?? .agents/state.json', '?? test-results/portfolio/home.png', '?? dist/assets/index.js.map', '?? .env.local', ''].join('\0'));

    expect(report.counts['public-candidate']).toBe(2);
    expect(report.counts['private-design']).toBe(2);
    expect(report.counts['local-state']).toBe(2);
    expect(report.counts['generated']).toBe(2);
    expect(report.counts['secret-risk']).toBe(1);
    expect(report.byClass['public-candidate']).toEqual([' M README.md', ' M src/app/main.ts']);
    expect(report.byClass['private-design']).toEqual([' M docs/00-DESIGN-BRIEF.md', '?? DESIGN-NOTES.md']);
    expect(report.publicCandidateGroupCounts['public-governance']).toBe(1);
    expect(report.publicCandidateGroupCounts['portfolio-runtime']).toBe(1);
    expect(report.publicCandidatesByGroup['public-governance']).toEqual([' M README.md']);
    expect(report.publicCandidatesByGroup['portfolio-runtime']).toEqual([' M src/app/main.ts']);
  });

  it('把公开候选路径归入发布审查桶', () => {
    const report = auditPublicWorktree([' M README.md', ' M .github/workflows/pages.yml', ' M index.html', ' M assets/logo/logo-full.png', ' M src/vite-env.d.ts', ' M src/app/main.ts', ' M src/render/renderer.ts', ' M src/io/assets.ts', ' M src/sim/farm/actions.ts', ' M src/content/registry.ts', ' M tests/browser/smoke.spec.ts', ' M tests/unit/farm.test.ts', ' M tests/integration/mvp-slice.int.test.ts', ' M tests/property/farm.property.test.ts', ' M tests/replay/schema.ts', ' M tools/content-lint.ts', ' M scripts/manual-check.ts', ''].join('\0'));

    expect(report.publicCandidateGroupCounts).toMatchObject({
      'public-governance': 2,
      'portfolio-runtime': 6,
      'gameplay-sim': 2,
      'tests-browser': 1,
      'tests-unit-integration': 4,
      'tools-pipeline': 1,
      'unknown-public': 1
    });
    expect(report.publicCandidatesByGroup['public-governance']).toContain(' M README.md');
    expect(report.publicCandidatesByGroup['unknown-public']).toEqual([' M scripts/manual-check.ts']);
  });

  it('公开候选分组保持可单独复用', () => {
    expect(classifyPublicCandidateGroup('tools/public-worktree-audit.mjs')).toBe('public-governance');
    expect(classifyPublicCandidateGroup('tools/balance-scan.ts')).toBe('tools-pipeline');
    expect(classifyPublicCandidateGroup('src/content/i18n.ts')).toBe('gameplay-sim');
    expect(classifyPublicCandidateGroup('src/vite-env.d.ts')).toBe('portfolio-runtime');
    expect(classifyPublicCandidateGroup('src/app/todayBriefing.ts')).toBe('portfolio-runtime');
    expect(classifyPublicCandidateGroup('tests/property/farm.property.test.ts')).toBe('tests-unit-integration');
  });

  it('把私有 master reference 资产判为 private-design 而不是公开候选', () => {
    const report = auditPublicWorktree([' M assets/references/master-cozy-warm-farm-v1.png', ''].join('\0'));

    expect(report.counts['private-design']).toBe(1);
    expect(report.counts['public-candidate']).toBe(0);
    expect(report.byClass['private-design']).toEqual([' M assets/references/master-cozy-warm-farm-v1.png']);
  });

  it('同时审查 rename/copy 记录的新旧路径', () => {
    const report = auditPublicWorktree(['R  src/app/new.ts', 'src/app/old.ts', 'C  README.md', 'docs/old-public-notes.md', ''].join('\0'));

    expect(report.byClass['public-candidate']).toContain('R  src/app/new.ts');
    expect(report.byClass['public-candidate']).toContain('R  src/app/old.ts');
    expect(report.byClass['public-candidate']).toContain('C  README.md');
    expect(report.byClass['private-design']).toContain('C  docs/old-public-notes.md');
  });

  it('支持按公开候选和密钥风险启用严格失败策略', () => {
    const report = auditPublicWorktree([' M README.md', '?? .env.local', ''].join('\0'));

    expect(shouldFailPublicWorktreeAudit(report)).toBe(false);
    expect(shouldFailPublicWorktreeAudit(report, { failOnPublicCandidates: true })).toBe(true);
    expect(shouldFailPublicWorktreeAudit(report, { failOnSecretRisk: true })).toBe(true);
  });
});
