const forbiddenPathPatterns = [/^docs\//, /^assets\/references\//, /^\.public-tree\//, /^\.omc\//, /^\.claude\//, /^\.codex\//, /^\.agents\//, /^dist\//, /^coverage\//, /^playwright-report\//, /^test-results\//, /^node_modules\//, /^\.git\//, /^\.tmp\.playwright-.*\.config\.ts$/, /(^|\/)\.env($|\.)/, /\.map$/];

const privateDesignPathPatterns = [/^docs\//, /^assets\/ART-ASSETS-STATUS\.md$/, /^assets\/references\//];

const localStatePathPatterns = [/^\.omc\//, /^\.claude\//, /^\.codex\//, /^\.agents\//];

const generatedPathPatterns = [/^\.public-tree\//, /^dist\//, /^coverage\//, /^playwright-report\//, /^test-results\//, /^node_modules\//, /^\.tmp\.playwright-.*\.config\.ts$/, /\.map$/];

const secretPathPatterns = [/(^|\/)\.env($|\.)/];

const forbiddenExact = new Set(['AGENTS.md', 'CLAUDE.md', 'assets/ART-ASSETS-STATUS.md']);

export const allowedPublicMarkdown = new Set(['README.md', 'CHANGELOG.md', 'CONTENT-LICENSE.md', 'CONTRIBUTING.md', 'SECURITY.md']);

export function isAllowedGithubMarkdown(file) {
  return file === '.github/pull_request_template.md' || file.startsWith('.github/ISSUE_TEMPLATE/');
}

export function isPublicAllowedMarkdown(file) {
  return allowedPublicMarkdown.has(file) || isAllowedGithubMarkdown(file);
}

export function isPrivateDesignPath(file) {
  if (forbiddenExact.has(file)) return true;
  if (file.endsWith('.md') && !isPublicAllowedMarkdown(file)) return true;
  return privateDesignPathPatterns.some(pattern => pattern.test(file));
}

export function isLocalStatePath(file) {
  return localStatePathPatterns.some(pattern => pattern.test(file));
}

export function isGeneratedPath(file) {
  return generatedPathPatterns.some(pattern => pattern.test(file));
}

export function isSecretRiskPath(file) {
  return secretPathPatterns.some(pattern => pattern.test(file));
}

export function shouldSkipPublicTreeFile(file) {
  if (file.endsWith('.md') && !isPublicAllowedMarkdown(file)) return true;
  return forbiddenExact.has(file) || forbiddenPathPatterns.some(pattern => pattern.test(file));
}

export function classifyPublicWorktreePath(file) {
  if (isSecretRiskPath(file)) return 'secret-risk';
  if (isLocalStatePath(file)) return 'local-state';
  if (isGeneratedPath(file)) return 'generated';
  if (isPrivateDesignPath(file)) return 'private-design';
  if (!shouldSkipPublicTreeFile(file)) return 'public-candidate';
  return 'private-excluded';
}
