import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = readFileSync(resolve('tools/portfolio-pages-watch.mjs'), 'utf8');

describe('GitHub Pages 只读 watch 工具', () => {
  it('保持非部署边界并提供有界等待与 JSON 输出', () => {
    expect(script).toContain('不提交、不推送、不部署、不修改远端设置');
    expect(script).toContain("process.argv.includes('--json')");
    expect(script).toContain("process.argv.includes('--wait')");
    expect(script).toContain('AEON_PAGES_WATCH_TIMEOUT_MS');
    expect(script).toContain('AEON_PAGES_WATCH_INTERVAL_MS');
    expect(script).toContain('--timeout-ms must be at least 1000');
    expect(script).toContain('--interval-ms must be at least 1000');
    expect(script).not.toMatch(/gh\s+workflow\s+run|gh\s+release\s+create|git\s+push|git\s+commit/);
  });

  it('聚合 CI、Pages Action、deployment、Pages source 和线上 bundle 证据', () => {
    expect(script).toContain("latestRun('CI')");
    expect(script).toContain("latestRun('Deploy GitHub Pages')");
    expect(script).toContain('repos/${fullRepo}/pages');
    expect(script).toContain('deployments?environment=github-pages');
    expect(script).toContain('deploymentStatuses');
    expect(script).toContain('environment_url');
    expect(script).toContain('firstScriptSrc');
    expect(script).toContain('AbortController');
    expect(script).toContain('document.body.appendChild(');
    expect(script).toContain('querySelector("#app")');
  });

  it('给出反等待卡点的可操作归因', () => {
    expect(script).toContain('local-head-differs-from-origin-main');
    expect(script).toContain('ci-running');
    expect(script).toContain('ci-not-green');
    expect(script).toContain('pages-action-running');
    expect(script).toContain('pages-action-not-green');
    expect(script).toContain('pages-run-behind-ci');
    expect(script).toContain('deployment-sha-differs-from-pages-run');
    expect(script).toContain('latest-deployment-status-not-success');
    expect(script).toContain('pages-config-fetch-failed');
    expect(script).toContain('deployment-fetch-failed');
    expect(script).toContain('pages-source-not-actions-workflow');
    expect(script).toContain('live-pages-fetch-failed');
    expect(script).toContain('deployed-bundle-uses-body-append');
    expect(script).toContain('deployment-behind-origin-main');
    expect(script).toContain('remote-pages-chain-current');
    expect(script).toContain('gh run watch');
    expect(script).toContain('不要把 live HTML 200 单独当作完整部署链证明');
    expect(script).toContain('不要继续盲改当前本地布局');
  });
});
