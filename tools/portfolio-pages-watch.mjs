#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const owner = process.env.AEON_GITHUB_OWNER ?? 'Rethymus';
const repo = process.env.AEON_GITHUB_REPO ?? 'AeonVale';
const fullRepo = `${owner}/${repo}`;
const pagesUrl = process.env.AEON_PAGES_URL ?? 'https://Rethymus.github.io/AeonVale/';
const printJson = process.argv.includes('--json');
const wait = process.argv.includes('--wait');
const maxWaitMs = Number(readOption('--timeout-ms') ?? process.env.AEON_PAGES_WATCH_TIMEOUT_MS ?? 10 * 60 * 1000);
const intervalMs = Number(readOption('--interval-ms') ?? process.env.AEON_PAGES_WATCH_INTERVAL_MS ?? 15 * 1000);
const fetchTimeoutMs = Number(process.env.AEON_PAGES_FETCH_TIMEOUT_MS ?? 15_000);

function readOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function parseJson(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return { error: errorMessage(error), raw };
  }
}

function maybeText(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function latestRun(workflow) {
  const raw = run('gh', [
    'run', 'list',
    '--workflow', workflow,
    '--branch', 'main',
    '--limit', '1',
    '--json', 'databaseId,status,conclusion,headSha,headBranch,createdAt,updatedAt,event,displayTitle,url',
  ]);
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return parsed;
  return parsed[0] ?? null;
}

function pagesConfig() {
  const raw = run('gh', [
    'api', `repos/${fullRepo}/pages`,
    '--jq', '{html_url:.html_url,build_type:.build_type,source:.source,status:.status,cname:.cname,protected_domain_state:.protected_domain_state}',
  ]);
  return parseJson(raw);
}

function latestDeployment() {
  const raw = run('gh', [
    'api', `repos/${fullRepo}/deployments?environment=github-pages&per_page=1`,
    '--jq', '[.[] | {id,sha,ref,task,environment,created_at,updated_at,creator:.creator.login,statuses_url}]',
  ]);
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) return parsed;
  return parsed[0] ?? null;
}

function deploymentStatuses(deployment) {
  if (!deployment?.id) return [];
  const raw = run('gh', [
    'api', `repos/${fullRepo}/deployments/${deployment.id}/statuses`,
    '--jq', '[.[] | {state,environment,environment_url,log_url,target_url,created_at,updated_at,description}]',
  ]);
  const parsed = parseJson(raw);
  return Array.isArray(parsed) ? parsed : parsed;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timed out after ${fetchTimeoutMs}ms`)), fetchTimeoutMs);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      lastModified: response.headers.get('last-modified'),
      etag: response.headers.get('etag'),
      cacheControl: response.headers.get('cache-control'),
      text: await response.text(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function firstScriptSrc(html, baseUrl) {
  const match = html.match(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/i);
  if (!match?.[1]) return null;
  return new URL(match[1], baseUrl).toString();
}

async function liveBundle() {
  let html;
  try {
    html = await fetchText(pagesUrl);
  } catch (error) {
    return { ok: false, status: null, finalUrl: pagesUrl, error: errorMessage(error), script: null };
  }
  const scriptUrl = firstScriptSrc(html.text, html.url);
  let script = null;
  if (scriptUrl) {
    try {
      const js = await fetchText(scriptUrl);
      script = {
        url: scriptUrl,
        ok: js.ok,
        status: js.status,
        bytes: js.text.length,
        hasBodyAppend: js.text.includes('document.body.appendChild('),
        hasAppMountQuery: js.text.includes('querySelector("#app")') || js.text.includes("querySelector('#app')"),
      };
    } catch (error) {
      script = { url: scriptUrl, ok: false, status: null, bytes: 0, error: errorMessage(error), hasBodyAppend: false, hasAppMountQuery: false };
    }
  }
  return {
    ok: html.ok,
    status: html.status,
    finalUrl: html.url,
    lastModified: html.lastModified,
    etag: html.etag,
    cacheControl: html.cacheControl,
    script,
  };
}

function buildDiagnosis(report) {
  const findings = [];
  const actions = [];
  const latestStatus = Array.isArray(report.deploymentStatuses) ? report.deploymentStatuses[0] : null;

  if (report.git.head && report.git.originMain && report.git.head !== report.git.originMain) {
    findings.push('local-head-differs-from-origin-main');
    actions.push('本地 HEAD 尚未进入 origin/main；需要通过 PR/合并/部署链路同步后，真实 Pages 才会反映本地修复。');
  }

  if (report.ciRun?.status && report.ciRun.status !== 'completed') {
    findings.push('ci-running');
    actions.push(`CI #${report.ciRun.databaseId} 仍在运行；等待完成期间可继续跑本地 pnpm governance:check/typecheck/test/build。`);
  } else if (report.ciRun?.conclusion && report.ciRun.conclusion !== 'success') {
    findings.push('ci-not-green');
    actions.push(`先查看 CI #${report.ciRun.databaseId} 的失败 job，不要直接等待 Pages。`);
  }

  if (report.pagesRun?.status && report.pagesRun.status !== 'completed') {
    findings.push('pages-action-running');
    actions.push(`Pages Action #${report.pagesRun.databaseId} 仍在运行；可用 gh run watch ${report.pagesRun.databaseId} --compact --exit-status 做短时观察。`);
  } else if (report.pagesRun?.conclusion && report.pagesRun.conclusion !== 'success') {
    findings.push('pages-action-not-green');
    actions.push(`先查看 Pages Action #${report.pagesRun.databaseId} 的失败步骤，再决定修 workflow 还是重新部署。`);
  }

  if (report.ciRun?.headSha && report.pagesRun?.headSha && report.ciRun.headSha !== report.pagesRun.headSha) {
    findings.push('pages-run-behind-ci');
    actions.push('最新 Pages Action 的 headSha 落后于最新 main CI；先确认 workflow_run 是否触发或是否被 concurrency 取消。');
  }

  if (report.deployment?.sha && report.pagesRun?.headSha && report.deployment.sha !== report.pagesRun.headSha) {
    findings.push('deployment-sha-differs-from-pages-run');
    actions.push('最新 github-pages deployment 的 SHA 与最新 Pages Action 不一致；优先看 deployment statuses 和 Pages environment。');
  }

  if (latestStatus?.state && latestStatus.state !== 'success') {
    findings.push('latest-deployment-status-not-success');
    actions.push(`最新 github-pages deployment status 是 ${latestStatus.state}；先打开 deployment log。`);
  }

  if (report.pagesConfig?.build_type && report.pagesConfig.build_type !== 'workflow') {
    findings.push('pages-source-not-actions-workflow');
    actions.push('Pages Source 不是 GitHub Actions；需要维护者在 Settings -> Pages 复核 source。');
  }

  if (report.live?.error || report.live?.script?.error) {
    findings.push('live-pages-fetch-failed');
    actions.push('真实 Pages HTML 或 JS 读取失败；先检查网络、GitHub Pages 状态、URL 和缓存响应。');
  }

  if (report.live?.script?.hasBodyAppend) {
    findings.push('deployed-bundle-uses-body-append');
    actions.push('线上 bundle 仍包含旧 body append 挂载；这是旧部署/分支漂移证据，不要继续盲改当前本地布局。');
  }

  if (report.git.originMain && report.deployment?.sha && report.git.originMain !== report.deployment.sha) {
    findings.push('deployment-behind-origin-main');
    actions.push('最新 deployment SHA 落后于 origin/main；等待 workflow_run 或复核 Pages workflow 触发条件。');
  }

  if (!findings.length) {
    findings.push('remote-pages-chain-current');
    actions.push('远端 CI、Pages Action、deployment 和 live bundle 没有明显漂移；若仍失败，复跑 pnpm portfolio:pages-diagnose && pnpm test:browser:pages。');
  }

  return { findings, actions };
}

async function snapshot() {
  const head = run('git', ['rev-parse', 'HEAD']);
  const branch = run('git', ['branch', '--show-current']);
  const originMain = run('git', ['rev-parse', 'origin/main']);
  const deployment = latestDeployment();
  const report = {
    title: 'Aeon Vale Pages 只读 watch',
    safety: '此命令只读取本地 Git、GitHub Actions、GitHub Pages deployment 和真实 Pages URL，不提交、不推送、不部署、不修改远端设置。',
    repo: fullRepo,
    pagesUrl,
    generatedAt: new Date().toISOString(),
    git: {
      branch: maybeText(branch),
      head: maybeText(head),
      originMain: maybeText(originMain),
      headMatchesOriginMain: typeof head === 'string' && typeof originMain === 'string' ? head === originMain : null,
    },
    ciRun: latestRun('CI'),
    pagesRun: latestRun('Deploy GitHub Pages'),
    pagesConfig: pagesConfig(),
    deployment,
    deploymentStatuses: deploymentStatuses(deployment),
    live: await liveBundle(),
    diagnosis: null,
  };
  report.diagnosis = buildDiagnosis(report);
  return report;
}

function isSettled(report) {
  return !report.diagnosis.findings.some((finding) => finding === 'ci-running' || finding === 'pages-action-running');
}

function printReport(report) {
  console.log(report.title);
  console.log(report.safety);
  console.log('');
  console.log(`Repo: ${report.repo}`);
  console.log(`Pages: ${report.pagesUrl}`);
  console.log(`Git: ${report.git.branch ?? 'unknown'} ${report.git.head ?? 'unknown'}`);
  console.log(`origin/main: ${report.git.originMain ?? 'unknown'}`);
  console.log(`HEAD matches origin/main: ${String(report.git.headMatchesOriginMain)}`);
  if (report.ciRun && !report.ciRun.error) {
    console.log(`Latest CI: #${report.ciRun.databaseId} ${report.ciRun.conclusion}/${report.ciRun.status} ${report.ciRun.headSha ?? ''}`);
  } else if (report.ciRun?.error) {
    console.log(`Latest CI: ${report.ciRun.error}`);
  }
  if (report.pagesRun && !report.pagesRun.error) {
    console.log(`Latest Pages Action: #${report.pagesRun.databaseId} ${report.pagesRun.conclusion}/${report.pagesRun.status} ${report.pagesRun.headSha ?? ''}`);
  } else if (report.pagesRun?.error) {
    console.log(`Latest Pages Action: ${report.pagesRun.error}`);
  }
  console.log(`Pages source: ${report.pagesConfig?.build_type ?? 'unknown'} ${report.pagesConfig?.source?.branch ?? ''}`.trim());
  console.log(`Latest deployment: ${report.deployment?.id ?? 'none'} ${report.deployment?.sha ?? ''}`.trim());
  const latestStatus = Array.isArray(report.deploymentStatuses) ? report.deploymentStatuses[0] : null;
  console.log(`Latest deployment status: ${latestStatus?.state ?? 'unknown'} ${latestStatus?.environment_url ?? ''}`.trim());
  console.log(`Live HTML: ${report.live.status ?? 'unknown'} last-modified=${report.live.lastModified ?? 'unknown'}`);
  console.log(`Live JS: ${report.live.script?.url ?? 'missing'}`);
  console.log(`Live JS body append: ${String(report.live.script?.hasBodyAppend ?? null)}`);
  console.log('');
  console.log('Findings');
  for (const item of report.diagnosis.findings) console.log(`- ${item}`);
  console.log('');
  console.log('Next Actions');
  for (const item of report.diagnosis.actions) console.log(`- ${item}`);
}

async function main() {
  if (!Number.isFinite(intervalMs) || intervalMs < 1000) throw new Error('--interval-ms must be at least 1000');
  if (!Number.isFinite(maxWaitMs) || maxWaitMs < 1000) throw new Error('--timeout-ms must be at least 1000');

  const started = Date.now();
  let report = await snapshot();
  while (wait && !isSettled(report) && Date.now() - started < maxWaitMs) {
    await delay(intervalMs);
    report = await snapshot();
  }
  report.watch = {
    enabled: wait,
    settled: isSettled(report),
    elapsedMs: Date.now() - started,
    intervalMs,
    timeoutMs: maxWaitMs,
  };

  if (printJson) console.log(JSON.stringify(report, null, 2));
  else printReport(report);
}

main().catch((error) => {
  console.error(errorMessage(error));
  process.exit(1);
});
