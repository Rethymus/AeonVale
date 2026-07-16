import { describe, expect, it } from 'vitest';

import { auditPublicContentFiles, shouldFailPublicContentAudit } from '../../tools/public-content-audit.mjs';

describe('公开候选内容审查', () => {
  it('统计公开候选中的私有资料引用但不默认阻断', () => {
    const report = auditPublicContentFiles([
      { path: 'src/app/main.ts', content: '/* see docs/10-technical-architecture.md, docs/15 §2 and AGENTS.md */\nexport const ok = true;\n' },
      { path: 'README.md', content: '# Aeon Vale\n' },
    ]);

expect(report.counts.filesScanned).toBe(2);
    expect(report.counts.info).toBe(3);
    expect(report.counts.high).toBe(0);
    expect(report.counts.actionable).toBe(3);
    expect(report.counts.reviewedGuardrail).toBe(0);
    expect(report.counts.byKind['private-document-reference']).toBe(2);
    expect(report.counts.byKind['design-doc-index-reference']).toBe(1);
    expect(shouldFailPublicContentAudit(report, { failOnHighRisk: true })).toBe(false);
  });

it('把公开治理测试中的排除规则样例标记为已审护栏引用', () => {
    const report = auditPublicContentFiles([
      { path: 'tests/unit/prepare-public-tree.test.ts', content: "expect(excluded).toContain('docs/00-DESIGN-BRIEF.md');\nexpect(label).toContain('docs/15 §2');\nexpect(excluded).toContain('.omc/state.json');\n" },
      { path: 'tests/unit/portfolio-release-checklist.test.ts', content: "expect(output).toContain('AGENTS.md');\nexpect(output).toContain('assets/ART-ASSETS-STATUS.md');\n" },
      { path: 'src/app/main.ts', content: '/* TODO: see docs/10-technical-architecture.md */\n' },
    ]);

expect(report.counts.info).toBe(6);
    expect(report.counts.actionable).toBe(1);
    expect(report.counts.reviewedGuardrail).toBe(5);
    expect(report.findings.filter((finding) => finding.reviewStatus === 'reviewed-guardrail')).toHaveLength(5);
    expect(report.findings.find((finding) => finding.path === 'src/app/main.ts')?.reviewStatus).toBe('actionable');
  });

it('发现密钥形态和 sourcemap 引用时启用高风险失败策略', () => {
    const fakeToken = `ghp_${'1234567890abcdefghijklmnop'}`;
    const sourcemapMarker = `source${'Mapping'}URL`;
    const report = auditPublicContentFiles([
      { path: 'tools/example.mjs', content: `const token = "${fakeToken}";\n//# ${sourcemapMarker}=index.js.map\n` },
    ]);

expect(report.counts.high).toBe(2);
    expect(report.counts.byKind['secret-literal']).toBe(1);
    expect(report.counts.byKind['production-sourcemap-reference']).toBe(1);
    expect(report.findings.find((finding) => finding.kind === 'secret-literal')?.match).toContain('redacted');
    expect(shouldFailPublicContentAudit(report)).toBe(false);
    expect(shouldFailPublicContentAudit(report, { failOnHighRisk: true })).toBe(true);
  });

it('跳过非文本文件，避免把图片二进制当成源码扫描', () => {
    const sourcemapMarker = `source${'Mapping'}URL`;
    const report = auditPublicContentFiles([
      { path: 'assets/logo/logo-full.png', content: sourcemapMarker },
      { path: 'src/app/main.ts', content: 'export const ok = true;\n' },
    ]);

expect(report.counts.filesScanned).toBe(1);
    expect(report.counts.high).toBe(0);
  });
});
