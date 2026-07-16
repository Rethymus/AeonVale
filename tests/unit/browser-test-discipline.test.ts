import { readFileSync, readdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const BROWSER_TEST_DIR = resolve(process.cwd(), 'tests/browser');
const PLAYWRIGHT_ACTION_APIS = new Set(['blur', 'check', 'clear', 'click', 'dblclick', 'dispatchEvent', 'down', 'dragTo', 'fill', 'focus', 'goBack', 'goForward', 'goto', 'hover', 'insertText', 'move', 'press', 'pressSequentially', 'reload', 'screenshot', 'scrollIntoViewIfNeeded', 'selectOption', 'selectText', 'setChecked', 'setInputFiles', 'tap', 'type', 'uncheck', 'up', 'waitFor', 'waitForFunction', 'waitForLoadState', 'waitForSelector', 'waitForTimeout', 'wheel']);

interface BareApiReference {
  api: string;
  column: number;
  file: string;
  line: number;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (ts.isAsExpression(expression) || ts.isAwaitExpression(expression) || ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isVoidExpression(expression)) {
    return unwrapExpression(expression.expression);
  }
  return expression;
}

function isAssertionOrActionApi(name: string): boolean {
  return /^to[A-Z]/.test(name) || PLAYWRIGHT_ACTION_APIS.has(name);
}

function findBareApiReferences(file: string, sourceText: string): BareApiReference[] {
  const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings: BareApiReference[] = [];

  function visit(node: ts.Node): void {
    if (ts.isExpressionStatement(node)) {
      const expression = unwrapExpression(node.expression);
      if (ts.isPropertyAccessExpression(expression) && isAssertionOrActionApi(expression.name.text)) {
        const position = source.getLineAndCharacterOfPosition(expression.name.getStart(source));
        findings.push({
          api: expression.name.text,
          column: position.character + 1,
          file,
          line: position.line + 1
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

describe('browser test discipline', () => {
  it('detects bare assertion and action method references without flagging calls', () => {
    const bare = findBareApiReferences('fixture.ts', ["await expect(page.locator('canvas')).toBeVisible;", "await page.locator('canvas').click;", 'expect(value).not.toBeNull;', "await expect(page.locator('canvas')).toBeVisible();", "await page.locator('canvas').click();", 'expect(value).not.toBeNull();'].join('\n'));

    expect(bare.map(finding => finding.api)).toEqual(['toBeVisible', 'click', 'toBeNull']);
  });

  it('calls assertion and action APIs in every browser test', () => {
    const files = readdirSync(BROWSER_TEST_DIR, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
      .map(entry => resolve(BROWSER_TEST_DIR, entry.name))
      .sort();
    const findings = files.flatMap(file => findBareApiReferences(file, readFileSync(file, 'utf8')));
    const report = findings.map(finding => `${relative(process.cwd(), finding.file)}:${finding.line}:${finding.column} references ${finding.api} without calling it`).join('\n');

    expect(findings, report).toEqual([]);
  });
});
