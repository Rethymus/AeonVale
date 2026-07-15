import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { shouldSkipPublicTreeFile } from './public-tree-rules.mjs';

const jsonOutput = process.argv.includes('--json');
const failOnHighRisk = process.argv.includes('--fail-on-high-risk');

const textFilePattern = /\.(?:cjs|css|html|js|json|md|mjs|mts|ts|tsx|txt|yml|yaml)$/i;
const extensionlessTextFiles = new Set(['LICENSE']);

const findingKinds = ['private-document-reference', 'design-doc-index-reference', 'agent-state-reference', 'production-sourcemap-reference', 'secret-literal'];
const severityOrder = ['info', 'high'];
const reviewedGuardrailPathPattern = /^(?:CONTRIBUTING\.md|tests\/unit\/(?:portfolio-release-checklist|prepare-public-tree|public-content-audit|public-dist-check|public-readiness-check|public-worktree-audit|publication-check)\.test\.ts|tools\/(?:governance-check|portfolio-release-checklist|public-readiness-check|public-tree-rules|publication-check)\.mjs)$/;

const findingRules = [
 {
 kind: 'private-document-reference',
 severity: 'info',
 pattern: /\b(?:docs\/[\w./-]*\.md|assets\/ART-ASSETS-STATUS\.md|AGENTS\.md|CLAUDE\.md)\b/g,
 },
 {
 kind: 'design-doc-index-reference',
 severity: 'info',
 pattern: /\bdocs\/\d{2}(?=[\s§)./，、；;：:／]|$)/g,
 },
 {
 kind: 'agent-state-reference',
 severity: 'info',
 pattern: /(^|[\s'"`])(?:\.omc|\.claude|\.codex|\.agents)(?=\/|[\s'"`]|$)/g,
 },
 {
 kind: 'production-sourcemap-reference',
 severity: 'high',
 pattern: new RegExp(`source${'Mapping'}URL`, 'g'),
 },
 {
 kind: 'secret-literal',
 severity: 'high',
 pattern: /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g,
 },
];

function isTextFile(path) {
 return textFilePattern.test(path) || extensionlessTextFiles.has(path);
}

function lineNumberForIndex(content, index) {
 let line = 1;
 for (let cursor = 0; cursor < index; cursor += 1) {
 if (content.charCodeAt(cursor) === 10) line += 1;
 }
 return line;
}

function summarizeMatch(value) {
	 if (/^(?:sk-|ghp_|github_pat_|AKIA)/.test(value)) return `${value.slice(0, 6)}...redacted`;
	 return value.trim();
}

function scanFileContent(path, content) {
 const findings = [];
 for (const rule of findingRules) {
 for (const match of content.matchAll(rule.pattern)) {
 const reviewedGuardrail = rule.severity === 'info' && reviewedGuardrailPathPattern.test(path);
 findings.push({
 path,
 line: lineNumberForIndex(content, match.index ?? 0),
 kind: rule.kind,
 severity: rule.severity,
 reviewStatus: reviewedGuardrail ? 'reviewed-guardrail' : 'actionable',
 match: summarizeMatch(match[0]),
 });
 }
 }
 return findings;
}

export function auditPublicContentFiles(files) {
 const findings = [];
 const counts = {
 filesScanned: 0,
 findings: 0,
 high: 0,
 info: 0,
 actionable: 0,
 reviewedGuardrail: 0,
 byKind: Object.fromEntries(findingKinds.map((kind) => [kind, 0])),
 };

for (const file of files) {
 if (!isTextFile(file.path)) continue;
 counts.filesScanned += 1;
 const fileFindings = scanFileContent(file.path, file.content);
 findings.push(...fileFindings);
 }

for (const finding of findings) {
 counts.findings += 1;
 counts[finding.severity] += 1;
 if (finding.reviewStatus === 'reviewed-guardrail') counts.reviewedGuardrail += 1;
 else counts.actionable += 1;
 counts.byKind[finding.kind] += 1;
 }

return { counts, findings };
}

function listPublicTextFiles() {
	 return execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
	 .split('\0')
	 .filter(Boolean)
	 .filter((path) => !shouldSkipPublicTreeFile(path))
	 .filter((path) => existsSync(path) && statSync(path).isFile() && isTextFile(path));
}

export function auditPublicContentFromWorktree() {
	 const files = listPublicTextFiles().map((path) => ({ path, content: readFileSync(path, 'utf8') }));
	 return auditPublicContentFiles(files);
}

export function shouldFailPublicContentAudit(report, options = {}) {
 return Boolean(options.failOnHighRisk && report.counts.high > 0);
}

function formatFindings(findings) {
 if (!findings.length) return ' - none';
 return findings.slice(0, 40).map((finding) => ` - ${finding.severity} ${finding.kind} ${finding.reviewStatus}: ${finding.path}:${finding.line} ${finding.match}`).join('\n');
}

function formatReport(report) {
 return [
 'Public content audit',
 '',
 'Content findings:',
 ` files-scanned: ${report.counts.filesScanned}`,
 ...severityOrder.map((severity) => ` ${severity}: ${report.counts[severity]}`),
 ` actionable: ${report.counts.actionable}`,
 ` reviewed-guardrail: ${report.counts.reviewedGuardrail}`,
 ...findingKinds.map((kind) => ` ${kind}: ${report.counts.byKind[kind]}`),
 '',
 'Findings:',
 formatFindings(report.findings),
 '',
 'High-risk findings fail the portfolio preflight; actionable info findings need release review, while reviewed-guardrail findings are expected self-check references in public governance tests/tools.',
 ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	 const report = auditPublicContentFromWorktree();
 console.log(jsonOutput ? JSON.stringify(report, null, 2) : formatReport(report));

if (shouldFailPublicContentAudit(report, { failOnHighRisk })) {
 console.error('Refusing to continue because high-risk public content findings are present. Remove secrets or production sourcemap references before publication.');
 process.exit(1);
 }
}
