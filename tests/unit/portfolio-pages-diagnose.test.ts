import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = readFileSync(resolve('tools/portfolio-pages-diagnose.mjs'), 'utf8');

describe('GitHub Pages 只读诊断工具', () => {
  it('保持非部署边界并提供机器可读输出', () => {
    expect(script).toContain('不提交、不推送、不部署、不修改远端设置');
    expect(script).toContain("process.argv.includes('--json')");
    expect(script).toContain("process.argv.includes('--skip-browser')");
    expect(script).toContain("process.argv.includes('--fail-on-live-error')");
    expect(script).not.toMatch(/gh\s+workflow\s+run|gh\s+release\s+create|git\s+push|git\s+commit/);
  });

  it('聚合 Git、GitHub Actions、线上 HTML/JS 和浏览器布局证据', () => {
    expect(script).toContain("git', ['rev-parse', 'HEAD']");
    expect(script).toContain("git', ['rev-parse', 'origin/main']");
    expect(script).toContain("gh', [");
    expect(script).toContain("'run', 'list'");
    expect(script).toContain('Deploy GitHub Pages');
    expect(script).toContain('firstScriptSrc');
    expect(script).toContain('AbortController');
    expect(script).toContain('document.body.appendChild(');
    expect(script).toContain('querySelector("#app")');
    expect(script).toContain("document.querySelector('canvas')");
    expect(script).toContain('canvasInInitialViewport');
    expect(script).toContain('firstBodyChildren');
  });

  it('给出可操作的失败归因而不是重复流水线', () => {
    expect(script).toContain('local-head-differs-from-origin-main');
    expect(script).toContain('local-has-canvas-app-mount-fix-not-on-origin-main');
    expect(script).toContain('live-pages-fetch-failed');
    expect(script).toContain('deployed-bundle-uses-body-append');
    expect(script).toContain('live-canvas-starts-outside-initial-viewport');
    expect(script).toContain('latest-pages-action-not-green');
    expect(script).toContain('不要继续盲改当前运行时代码');
    expect(script).toContain('旧部署/分支漂移证据');
    expect(script).toContain('需要维护者授权后通过正常 PR/部署链路更新 main');
  });
});
