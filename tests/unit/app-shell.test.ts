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
    for (const id of ['flow-title-save-notice', 'flow-settings-save-status', 'flow-pause-save-status', 'orientation-save-status']) {
      expect(html).toContain(`id="${id}"`);
    }
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

  it('uses native named buttons for touch commands', () => {
    for (const command of ['move-up', 'move-left', 'move-down', 'move-right', 'primary', 'cancel', 'secondary', 'menu']) {
      expect(html).toContain(`data-game-command="${command}"`);
    }
    expect(html.match(/<button/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(html).toContain('aria-label="向上移动"');
    expect(html).toContain('aria-label="主要操作"');
    expect(html).toContain('aria-label="返回或关闭当前面板"');
    expect(html).toContain('aria-label="打开菜单"');
  });

  it('exposes native world navigation and complete public-demo controls', () => {
    expect(html).toContain('id="world-command-bar"');
    expect(html).toContain('id="objective-rail"');
    expect(html).toContain('data-hud-density="compact"');
    expect(html).toContain('id="objective-rail-primary"');
    expect(html).toContain('id="objective-rail-details"');
    expect(html).toContain('id="fate-status-strip"');
    expect(html).toContain('id="fate-rail-details"');
    expect(html).toContain('id="fate-rail-summary"');
    expect(html).toContain('id="fate-summary-pressure"');
    expect(html).toContain('id="fate-summary-celestial"');
    expect(html).toContain('id="world-vital-strip"');
    expect(html).toContain('id="world-vital-hp-label"');
    expect(html).toContain('id="world-vital-stamina-label"');
    expect(html).toContain('data-hud-secondary="true"');
    expect(html).toContain('id="flow-continue-status"');
    const objectiveStart = html.indexOf('id="objective-rail"');
    const objectiveClose = html.indexOf('</aside>', objectiveStart);
    const fateStart = html.indexOf('id="fate-status-strip"');
    expect(objectiveStart).toBeGreaterThanOrEqual(0);
    expect(objectiveClose).toBeGreaterThan(objectiveStart);
    expect(fateStart).toBeGreaterThan(objectiveClose);
    expect(html.slice(objectiveStart, objectiveClose)).not.toContain('id="fate-rail-details"');
    for (const command of ['journey', 'farm', 'inventory', 'map', 'cultivation', 'furnace', 'end-day', 'pause', 'settings']) {
      expect(html).toContain(`data-game-command="${command}"`);
    }
    expect(html).not.toContain('data-game-command="alchemy"');

    for (const action of ['take-pill', 'tribulation-primary', 'move-up', 'move-left', 'move-down', 'move-right']) {
      const button = parseOpeningTags(html).find(tag => tag.name === 'button' && tag.attributes['data-demo-action'] === action);
      expect(button?.attributes.type, action).toBe('button');
      expect(button?.attributes['data-flow-focusable'], action).toBe('true');
    }

    expect(html).toContain('data-app-slot="inventory"');
    expect(html).not.toContain('data-app-surface="alchemy"');
    expect(html).not.toContain('data-demo-action="alchemy-primary"');
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
    expect(syncSource).toContain('setWorldAttention');
    expect(syncSource).toContain('commandBar.hidden');
    expect(syncSource).toContain('objectiveRail.hidden');
    expect(syncSource).toContain('fateStatusStrip.hidden');
    expect(syncSource).toContain('updateSemanticState');
    expect(debugSource).not.toContain('setWorldAttention');
    expect(debugSource).not.toContain('commandBar.hidden');
    expect(debugSource).not.toContain('objectiveRail.hidden');
    expect(debugSource).not.toContain('fateStatusStrip.hidden');
    expect(debugSource).not.toContain('updateSemanticState');
  });

  it('contains real focusable DOM surfaces for the complete application flow', () => {
    const surfaces = new Set(surfaceBlocks().map(surface => surface.surface));
    expect(surfaces).toEqual(new Set(['world', 'loading', 'boot-error', 'title', 'prologue', 'narration', 'codex', 'settings', 'pause', 'inventory', 'map', 'cultivation', 'tribulation', 'aftermath', 'ending', 'portrait-blocked']));

    for (const action of ['reload-page', 'start-new-game', 'continue-game', 'open-settings', 'close-overlay', 'open-pause', 'continue-aftermath', 'return-title']) {
      expect(html).toContain(`data-flow-action="${action}"`);
    }

    expect(html).toContain('id="flow-title-new-game"');
    expect(html).toContain('id="flow-title-continue"');
    expect(html).toContain('id="flow-title-settings"');
    expect(html).toContain('id="prologue-vn"');
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
    expect(buttons.length).toBeGreaterThanOrEqual(12);

    for (const button of buttons) {
      const owner = surfaces.find(surface => button.start > surface.start && button.end < surface.close);
      expect(owner?.surface, String(button.attributes.id)).toBeTruthy();
      expect(button.attributes.type).toBe('button');
      expect(button.attributes.id).toEqual(expect.any(String));
      expect(button.attributes['data-flow-focusable']).toBe('true');
    }

    const ownerByAction = new Map(buttons.map(button => [String(button.attributes['data-flow-action']), surfaces.find(surface => button.start > surface.start && button.end < surface.close)?.surface]));
    expect(ownerByAction.get('reload-page')).toBe('boot-error');
    expect(ownerByAction.get('start-new-game')).toBe('title');
    expect(ownerByAction.get('continue-aftermath')).toBe('aftermath');
    expect(ownerByAction.get('return-title')).toBe('ending');
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

  it('mounts the branching visual-novel stage inside the prologue surface without static flow buttons', () => {
    const prologue = html.match(/<section[^>]+data-app-surface="prologue"[\s\S]*?<\/section>/)?.[0] ?? '';
    expect(prologue).not.toBe('');
    expect(prologue).toContain('id="flow-prologue-heading"');
    expect(prologue).toContain('id="prologue-vn"');
    expect(prologue).toContain('data-app-slot="prologue-vn"');
    // 静态阅读段落保持精简（kicker 之外由 VN 运行时渲染）。
    expect(prologue.match(/<p(?:\s|>)/g)?.length ?? 0).toBeLessThanOrEqual(3);
    // 控件交由 prologueVN 自管：静态面板不再放 finish/skip 的 data-flow-action 按钮。
    expect(prologue).not.toContain('data-flow-action="finish-prologue"');
    expect(prologue).not.toContain('data-flow-action="skip-prologue"');
  });

  it('uses native dialog semantics and named return buttons for blocking overlays', () => {
    expect(html.match(/role="dialog"/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(html.match(/aria-modal="true"/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
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
    expect(css).toContain('.inv-craft-projection');
    expect(css).toContain('.inv-furnace-range');
    expect(css).toContain("[data-heat-band='ideal']");
  });

  it('computes safe-area placement and 44px minimum controls from parsed CSS rules', () => {
    const root = cssDeclarations(':root');
    expect(root['--safe-top']).toBe('env(safe-area-inset-top, 0px)');
    expect(root['--safe-right']).toBe('env(safe-area-inset-right, 0px)');
    expect(root['--safe-bottom']).toBe('env(safe-area-inset-bottom, 0px)');
    expect(root['--safe-left']).toBe('env(safe-area-inset-left, 0px)');

    const surface = cssDeclarations('.flow-surface');
    expect(surface.inset).toBe('var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)');

    for (const selector of ['.flow-button', '.touch-button', '.world-command']) {
      const declarations = cssDeclarations(selector);
      expect(minimumPixels(declarations['min-width']), selector).toBeGreaterThanOrEqual(44);
      expect(minimumPixels(declarations['min-height']), selector).toBeGreaterThanOrEqual(44);
    }

    const objectiveSummary = cssDeclarations('.objective-rail-summary');
    expect(minimumPixels(objectiveSummary['min-height'])).toBeGreaterThanOrEqual(44);
    const fateSummary = cssDeclarations('.fate-summary');
    expect(minimumPixels(fateSummary['min-height'])).toBeGreaterThanOrEqual(44);
    expect(css).toContain('.objective-rail[hidden]');
    expect(css).toContain('.fate-status-strip[hidden]');
    expect(css).toContain('data-hud-density');

    const worldSurface = parseOpeningTags(html).find(tag => tag.attributes.id === 'app');
    expect(worldSurface?.attributes['data-app-surface']).toBe('world');
    expect(worldSurface?.attributes.class).not.toBe('app-surface');
    expect(cssDeclarations('[data-app-surface][hidden]').display).toBe('none !important');
    expect(css).not.toContain('#app:has(canvas) ~ #game-loading');
  });
});
