import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('src/app/app.css', 'utf8');
const main = readFileSync('src/app/main.ts', 'utf8');

type ParsedAttributes = Record<string, string | true>;

interface ParsedTag {
  readonly name: string;
  readonly attributes: ParsedAttributes;
  readonly start: number;
  readonly end: number;
}

function parseAttributes(source: string): ParsedAttributes {
  const attributes: ParsedAttributes = {};
  for (const match of source.matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) {
    const name = match[1];
    if (!name) continue;
    attributes[name] = match[2] ?? true;
  }
  return attributes;
}

function parseOpeningTags(source: string): ParsedTag[] {
  return [...source.matchAll(/<([a-z][a-z0-9-]*)\b([^>]*)>/gi)].map(match => ({
    name: match[1]!.toLowerCase(),
    attributes: parseAttributes(match[2] ?? ''),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length
  }));
}

function surfaceBlocks(): Array<ParsedTag & { readonly surface: string; readonly close: number }> {
  return parseOpeningTags(html)
    .filter(tag => typeof tag.attributes['data-app-surface'] === 'string')
    .map(tag => {
      const surface = String(tag.attributes['data-app-surface']);
      const closeTag = `</${tag.name}>`;
      const close = html.indexOf(closeTag, tag.end);
      return { ...tag, surface, close: close < 0 ? tag.end : close + closeTag.length };
    });
}

function cssDeclarations(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = css.match(new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`))?.[1] ?? '';
  return Object.fromEntries(
    body
      .split(';')
      .map(entry => entry.trim())
      .filter(Boolean)
      .map(entry => {
        const split = entry.indexOf(':');
        return [entry.slice(0, split).trim(), entry.slice(split + 1).trim()];
      })
  );
}

function minimumPixels(value: string | undefined): number {
  return Number(value?.match(/^(\d+(?:\.\d+)?)px$/)?.[1] ?? Number.NaN);
}

describe('public demo application shell', () => {
  it('declares a viewport-safe responsive game shell', () => {
    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('href="./src/app/app.css"');
    expect(html).toContain('id="game-shell"');
    expect(html).toContain('id="app"');
  });

  it('provides an accessible portrait orientation gate', () => {
    expect(html).toContain('id="orientation-gate"');
    expect(html).toContain('role="status"');
    expect(html).toContain('请横置设备');
    expect(html).toContain('id="orientation-save-status"');
    expect(html).not.toContain('当前进度会安全保留');
  });

  it('provides stable save-health status nodes without claiming persistence before runtime checks it', () => {
    // 旧世界退役（docs/21 §8.28）：pause surface 已删，状态节点收敛为标题/设置/方向门。
    for (const id of ['flow-title-save-notice', 'flow-settings-save-status', 'orientation-save-status']) {
      expect(html).toContain(`id="${id}"`);
    }
    expect(html).not.toContain('id="flow-pause-save-status"');
    expect(html).toContain('id="flow-title-save-notice" class="flow-note" role="status" aria-live="polite" aria-atomic="true" hidden');
    expect(html).not.toContain('当前进度已保留');
    expect(html).not.toContain('当前进度会安全保留');
  });

  it('uses labeled native controls for runtime settings', () => {
    expect(html).toContain('for="flow-settings-master-volume"');
    expect(html).toMatch(/id="flow-settings-master-volume"[^>]*type="range"/);
    expect(html).toMatch(/id="flow-settings-master-volume"[^>]*min="0"[^>]*max="100"[^>]*value="35"/);
    expect(html).toContain('id="flow-settings-volume-output"');
    expect(html).toContain('for="flow-settings-reduced-motion"');
    expect(html).toMatch(/id="flow-settings-reduced-motion"[^>]*type="checkbox"/);
    expect(html).toContain('id="flow-settings-runtime-persistence-status"');
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });

  it('retires touch command buttons with the legacy world (docs/21 §8.28)', () => {
    expect(html).not.toContain('data-game-command=');
    expect(html).not.toContain('id="touch-controls"');
  });

  it('exposes title-only shell controls after the world navigation retirement', () => {
    expect(html).toContain('id="flow-continue-status"');
    // world HUD 编排已随 renderer 退役，DOM 不再存在
    for (const dead of ['id="world-command-bar"', 'id="objective-rail"', 'id="fate-status-strip"', 'id="world-vital-strip"', 'data-hud-density', 'data-demo-action']) {
      expect(html).not.toContain(dead);
    }
    expect(html).not.toContain('data-game-command=');
    expect(html).toContain('id="flow-title-new-game"');
    expect(html).toContain('id="flow-title-settings"');
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });

  it('exposes a semantic status mirror outside the canvas', () => {
    expect(html).toContain('id="game-surface"');
    expect(html).toContain('id="game-status"');
    expect(html).toContain('id="game-objective"');
    expect(html).toContain('id="game-actions"');
    expect(html).toContain('id="game-panel"');
    expect(html).toContain('aria-live="polite"');
  });

  it('keeps production presentation synchronization independent from debug snapshot publication', () => {
    const syncStart = main.indexOf('function syncAppPresentation');
    const debugStart = main.indexOf('function publishDebugSnapshot');
    const refreshStart = main.indexOf('function refreshAppPresentation');
    const syncSource = main.slice(syncStart, debugStart);
    const debugSource = main.slice(debugStart, refreshStart);

    expect(syncStart).toBeGreaterThanOrEqual(0);
    expect(debugStart).toBeGreaterThan(syncStart);
    expect(refreshStart).toBeGreaterThan(debugStart);
    // 旧世界退役（docs/21 §8.27）：world HUD DOM 编排已删，同步函数只剩语义壳层喂数。
    expect(syncSource).toContain('updateSemanticState');
    expect(syncSource).not.toContain('setWorldAttention');
    expect(syncSource).not.toContain('commandBar.hidden');
    expect(syncSource).not.toContain('objectiveRail.hidden');
    expect(syncSource).not.toContain('fateStatusStrip.hidden');
    expect(debugSource).not.toContain('setWorldAttention');
    expect(debugSource).not.toContain('commandBar.hidden');
    expect(debugSource).not.toContain('objectiveRail.hidden');
    expect(debugSource).not.toContain('fateStatusStrip.hidden');
    expect(debugSource).not.toContain('updateSemanticState');
  });

  it('contains real focusable DOM surfaces for the complete application flow', () => {
    const surfaces = new Set(surfaceBlocks().map(surface => surface.surface));
    // 旧世界退役（docs/21 §8.28）：壳层只剩 8 个活 surface。
    expect(surfaces).toEqual(new Set(['loading', 'boot-error', 'title', 'narration', 'roguelite-proto', 'codex', 'settings', 'portrait-blocked']));

    for (const action of ['reload-page', 'start-roguelite-proto', 'continue-game', 'open-settings', 'close-overlay']) {
      expect(html).toContain(`data-flow-action="${action}"`);
    }
    for (const retired of ['open-pause', 'continue-aftermath', 'return-title', 'finish-prologue', 'skip-prologue', 'start-new-game']) {
      expect(html).not.toContain(`data-flow-action="${retired}"`);
    }

    expect(html).toContain('id="flow-title-new-game"');
    expect(html).toContain('id="flow-title-continue"');
    expect(html).toContain('id="flow-title-settings"');
    expect(html).not.toContain('id="prologue-vn"');
    expect(html).toContain('aria-describedby="flow-continue-status"');
    expect(html).toMatch(/id="flow-title-continue"[^>]*disabled/);
  });

  it('starts with only loading active and every other surface isolated', () => {
    const surfaces = surfaceBlocks();
    const active = surfaces.filter(surface => surface.attributes.hidden !== true && surface.attributes.inert !== true && surface.attributes['aria-hidden'] === 'false');
    expect(active.map(surface => surface.surface)).toEqual(['loading']);

    for (const surface of surfaces.filter(surface => surface.surface !== 'loading')) {
      expect(surface.attributes.hidden, surface.surface).toBe(true);
      expect(surface.attributes.inert, surface.surface).toBe(true);
      expect(surface.attributes['aria-hidden'], surface.surface).toBe('true');
    }
  });

  it('assigns every flow button to one parsed surface with native button semantics', () => {
    const surfaces = surfaceBlocks();
    const buttons = parseOpeningTags(html).filter(tag => tag.name === 'button' && typeof tag.attributes['data-flow-action'] === 'string');
    expect(buttons.length).toBeGreaterThanOrEqual(5);

    for (const button of buttons) {
      const owner = surfaces.find(surface => button.start > surface.start && button.end < surface.close);
      expect(owner?.surface, String(button.attributes.id)).toBeTruthy();
      expect(button.attributes.type).toBe('button');
      expect(button.attributes.id).toEqual(expect.any(String));
      expect(button.attributes['data-flow-focusable']).toBe('true');
    }

    const ownerByAction = new Map(buttons.map(button => [String(button.attributes['data-flow-action']), surfaces.find(surface => button.start > surface.start && button.end < surface.close)?.surface]));
    expect(ownerByAction.get('reload-page')).toBe('boot-error');
    expect(ownerByAction.get('start-roguelite-proto')).toBe('title');
    expect(ownerByAction.get('continue-game')).toBe('title');
    expect(ownerByAction.get('open-settings')).toBe('title');
  });

  it('provides readable boot recovery and a concrete title build label', () => {
    const errorBlock = surfaceBlocks().find(surface => surface.surface === 'boot-error');
    expect(errorBlock?.attributes.role).toBe('alertdialog');
    const errorMarkup = errorBlock ? html.slice(errorBlock.start, errorBlock.close) : '';
    expect(errorMarkup).toContain('刷新页面');
    expect(errorMarkup).toContain('WebGL');
    expect(errorMarkup).toContain('兼容');

    const version = html.match(/<[^>]+id="flow-title-version"[^>]*>([^<]+)</)?.[1]?.trim();
    expect(version).toBe('版本 0.1.0 · 试玩构建');
  });

  it('mounts the farmstead key art as the title backdrop instead of a text-only menu shell', () => {
    const titleBlock = surfaceBlocks().find(surface => surface.surface === 'title');
    const titleMarkup = titleBlock ? html.slice(titleBlock.start, titleBlock.close) : '';

    expect(titleMarkup).toContain('class="title-backdrop"');
    expect(titleMarkup).toContain('class="title-backdrop-art"');
    expect(titleMarkup).toContain('src="./maps/map.farmstead-courtyard-v1.png"');
    expect(titleMarkup).toContain('fetchpriority="high"');
  });

  it('retires the prologue surface with the legacy world (docs/21 §8.28)', () => {
    expect(html).not.toContain('data-app-surface="prologue"');
    expect(html).not.toContain('id="prologue-vn"');
  });

  it('uses native dialog semantics and named return buttons for blocking overlays', () => {
    // 活 overlay：boot-error（alertdialog）、codex、settings
    expect(html.match(/role="dialog"/g)?.length ?? 0).toBe(2);
    expect(html).toContain('role="alertdialog"');
    expect(html).not.toContain('onclick=');
    expect(html).not.toContain('tabindex="1"');
  });

  it('uses dynamic viewport and safe-area responsive CSS', () => {
    expect(css).toContain('100dvh');
    expect(css).toContain('env(safe-area-inset-top');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('calc(100dvh * 16 / 9)');
    expect(css).toContain('(orientation: portrait)');
    expect(css).toContain('(pointer: coarse)');
    expect(css).toContain('min-width: 44px');
    expect(css).toContain('min-height: 44px');
    expect(css).toContain('[data-app-surface][hidden]');
    expect(css).toContain('text-wrap: balance');
    expect(css).toContain('text-wrap: pretty');
    expect(css).toContain(":root[data-reduced-motion='true']");
    expect(css).toContain('transition-duration: 0.01ms !important');
    expect(css).not.toMatch(/gradient\s*\(/i);
    expect(css).not.toMatch(/animation\s*:/i);
    // 旧世界退役（docs/21 §8.29）：行囊/丹炉 overlay 已删，.inv-* 死样式清除。
    expect(css).not.toContain('.inv-craft-projection');
    expect(css).not.toContain('.inv-furnace-range');
    expect(css).not.toContain("data-heat-band='ideal'");
  });

  it('computes safe-area placement and 44px minimum controls from parsed CSS rules', () => {
    const root = cssDeclarations(':root');
    expect(root['--safe-top']).toBe('env(safe-area-inset-top, 0px)');
    expect(root['--safe-right']).toBe('env(safe-area-inset-right, 0px)');
    expect(root['--safe-bottom']).toBe('env(safe-area-inset-bottom, 0px)');
    expect(root['--safe-left']).toBe('env(safe-area-inset-left, 0px)');

    const surface = cssDeclarations('.flow-surface');
    expect(surface.inset).toBe('var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)');

    const flowButton = cssDeclarations('.flow-button');
    expect(minimumPixels(flowButton['min-width'])).toBeGreaterThanOrEqual(44);
    expect(minimumPixels(flowButton['min-height'])).toBeGreaterThanOrEqual(44);

    // 旧世界退役（docs/21 §8.28）：#app 不再是 flow surface，仅是画布容器。
    const appDiv = parseOpeningTags(html).find(tag => tag.attributes.id === 'app');
    expect(appDiv?.attributes['data-app-surface']).toBeUndefined();
    expect(cssDeclarations('[data-app-surface][hidden]').display).toBe('none !important');
  });
});
