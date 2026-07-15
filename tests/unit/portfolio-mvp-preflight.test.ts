import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = readFileSync(resolve('tools/portfolio-mvp-preflight.mjs'), 'utf8');

function indexOfRequired(text: string): number {
 const index = script.indexOf(text);
 expect(index, `missing ${text}`).toBeGreaterThanOrEqual(0);
 return index;
}

describe('作品集 MVP 本地预检', () => {
 it('按公开发布风险顺序运行并以非部署清单收尾', () => {
 const worktreeAudit = indexOfRequired("args: ['audit:public-worktree', '--', '--fail-on-secret-risk']");
 const contentAudit = indexOfRequired("args: ['audit:public-content', '--', '--fail-on-high-risk']");
 const capture = indexOfRequired("args: ['portfolio:capture']");
 const publicTreeVerify = indexOfRequired("args: ['verify:public-tree']");
 const statusMatrix = indexOfRequired("args: ['portfolio:status']");
 const releaseChecklist = indexOfRequired("args: ['portfolio:release-checklist']");

 expect(worktreeAudit).toBeLessThan(contentAudit);
 expect(contentAudit).toBeLessThan(capture);
 expect(capture).toBeLessThan(publicTreeVerify);
 expect(publicTreeVerify).toBeLessThan(statusMatrix);
 expect(statusMatrix).toBeLessThan(releaseChecklist);
 expect(publicTreeVerify).toBeLessThan(releaseChecklist);
 expect(script).toContain('Print non-deploying portfolio status matrix');
 expect(script).toContain('Print non-deploying portfolio release checklist');
 });

 it('清理旧截图、校验四张作品集截图，并默认移除公开树', () => {
 expect(script).toContain("rmSync('test-results/portfolio', { recursive: true, force: true })");
 expect(script).toContain("'test-results/portfolio/01-farm-loop.png'");
 expect(script).toContain("'test-results/portfolio/02-location-routing.png'");
 expect(script).toContain("'test-results/portfolio/03-farm-actions.png'");
 expect(script).toContain("'test-results/portfolio/04-mobile-farm-loop.png'");
 expect(script).toContain("'test-results/portfolio/portfolio-mvp-evidence.json'");
 expect(script).toContain('readUInt32BE(16)');
 expect(script).toContain('readUInt32BE(20)');
 expect(script).toContain('width: 960, height: 540');
 expect(script).toContain('unexpected dimensions');
 expect(script).toContain("evidence.runtimeSignals?.onboardingObjectiveId !== 'first-loop-complete'");
 expect(script).toContain("evidence.runtimeSignals?.firstLoopProgress !== '10/10'");
 expect(script).toContain('todayBriefingProof');
 expect(script).toContain("['农庄', '炼丹', '引劫', '首轮进度：10/10']");
 expect(script).toContain('farm, alchemy, tribulation, and 10/10 progress cues');
 expect(script).toContain('screenshotEvidence');
 expect(script).toContain('paintedRatio');
 expect(script).toContain('minPaintedRatio: 0.55');
 expect(script).toContain('screenshot stats are too blank');
 expect(script).toContain('blocked-by-maintainer-authorization');
 expect(script).toContain('Verified generated portfolio MVP evidence');
 expect(script).toContain("rmSync('.public-tree', { recursive: true, force: true })");
 expect(script).toContain('--keep-public-tree');
 });

 it('保留非发布契约，不执行 commit、push、deploy 或 release 命令', () => {
 expect(script).toContain('No deployment, commit, or push was performed.');
 expect(script).not.toMatch(/args: \[['"](?:commit|push|deploy|release|tag)['"]/);
 });
});
