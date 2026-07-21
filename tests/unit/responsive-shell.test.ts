import { describe, expect, it } from 'vitest';
import { createResponsiveShell, type ResponsiveShellElement, type ResponsiveShellRoot, type SemanticGameState } from '@app/responsiveShell';
import type { GameCommand } from '@app/semanticInputRouter';

class FakeElement implements ResponsiveShellElement {
  readonly writes: string[] = [];
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  private value: string | null;

  constructor(
    private readonly attributes: Readonly<Record<string, string>> = {},
    initialText: string | null = ''
  ) {
    this.value = initialText;
  }

  get textContent(): string | null {
    return this.value;
  }

  set textContent(value: string | null) {
    this.value = value;
    this.writes.push(value ?? '');
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, init: Readonly<Record<string, unknown>> = {}): Event {
    const event = Object.assign(new Event(type, { cancelable: true }), init);
    for (const listener of this.listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener.call(this, event);
      else listener.handleEvent(event);
    }
    return event;
  }

  listenerCount(): number {
    return Array.from(this.listeners.values()).reduce((total, listeners) => total + listeners.size, 0);
  }
}

class FakeRoot implements ResponsiveShellRoot {
  readonly queriedSelectors: string[] = [];

  constructor(
    private readonly buttons: readonly FakeElement[],
    private readonly semanticNodes: Readonly<Record<string, FakeElement>>
  ) {}

  querySelector(selector: string): ResponsiveShellElement | null {
    return this.semanticNodes[selector] ?? null;
  }

  querySelectorAll(selector: string): ArrayLike<ResponsiveShellElement> {
    this.queriedSelectors.push(selector);
    return selector === 'button[data-game-command]' ? this.buttons : [];
  }
}

function commandButton(command: string): FakeElement {
  return new FakeElement({ 'data-game-command': command });
}

function createFixture() {
  const buttons = Object.fromEntries(['move-up', 'move-down', 'move-left', 'move-right', 'primary', 'cancel', 'secondary', 'menu', 'farm', 'inventory', 'cultivation', 'map', 'furnace', 'journey', 'pause', 'settings', 'end-day', 'unknown'].map(command => [command, commandButton(command)])) as Record<string, FakeElement>;
  const semanticNodes = {
    '#game-instructions': new FakeElement({}, '使用当前页面控件。'),
    '#game-surface': new FakeElement({}, '当前页面将在载入后显示。'),
    '#game-status': new FakeElement({}, '游戏正在载入。'),
    '#game-objective': new FakeElement({}, '当前目标将在载入后显示。'),
    '#game-actions': new FakeElement({}, '可用操作将在载入后显示。'),
    '#game-panel': new FakeElement({}, '当前没有打开面板。'),
    '#game-announcement': new FakeElement({}, '')
  };
  return { buttons, semanticNodes, root: new FakeRoot(Object.values(buttons), semanticNodes) };
}

describe('responsive shell', () => {
  it('can be created without a real document and remains an inert safe shell', () => {
    const commands: GameCommand[] = [];
    const shell = createResponsiveShell({ dispatch: command => commands.push(command) });
    expect(() => shell.updateSemanticState({ status: '运行中', objective: '翻地', actions: '行动', panel: '无', announcement: '' })).not.toThrow();
    expect(() => shell.destroy()).not.toThrow();
    expect(commands).toEqual([]);
  });

  it('binds native command buttons to direction, primary, secondary, and menu commands', () => {
    const fixture = createFixture();
    const commands: GameCommand[] = [];
    const shell = createResponsiveShell({ root: fixture.root, dispatch: command => commands.push(command) });

    fixture.buttons['move-up']!.emit('click');
    fixture.buttons['move-down']!.emit('click');
    fixture.buttons['move-left']!.emit('click');
    fixture.buttons['move-right']!.emit('click');
    fixture.buttons.primary!.emit('click');
    fixture.buttons.cancel!.emit('click');
    fixture.buttons.secondary!.emit('click');
    fixture.buttons.menu!.emit('click');
    fixture.buttons.farm!.emit('click');
    fixture.buttons.inventory!.emit('click');
    fixture.buttons.cultivation!.emit('click');
    fixture.buttons.map!.emit('click');
    fixture.buttons.furnace!.emit('click');
    fixture.buttons.journey!.emit('click');
    fixture.buttons.pause!.emit('click');
    fixture.buttons.settings!.emit('click');
    fixture.buttons['end-day']!.emit('click');
    fixture.buttons.unknown!.emit('click');

    expect(commands).toEqual([{ kind: 'move', direction: 'up' }, { kind: 'move', direction: 'down' }, { kind: 'move', direction: 'left' }, { kind: 'move', direction: 'right' }, { kind: 'confirm' }, { kind: 'cancel' }, { kind: 'cycle', direction: 'next' }, { kind: 'open', target: 'pause' }, { kind: 'open', target: 'menu' }, { kind: 'open', target: 'inventory' }, { kind: 'open', target: 'cultivation' }, { kind: 'open', target: 'map' }, { kind: 'open', target: 'furnace' }, { kind: 'open', target: 'journey' }, { kind: 'open', target: 'pause' }, { kind: 'open', target: 'settings' }, { kind: 'end-day' }]);
    expect(fixture.root.queriedSelectors).toContain('button[data-game-command]');
    shell.destroy();
  });

  it('dispatches pointer input directly without constructing keyboard events or double-firing click', () => {
    const fixture = createFixture();
    const commands: GameCommand[] = [];
    let keyboardEventConstructions = 0;
    const previousKeyboardEvent = Object.getOwnPropertyDescriptor(globalThis, 'KeyboardEvent');
    Object.defineProperty(globalThis, 'KeyboardEvent', {
      configurable: true,
      value: class {
        constructor() {
          keyboardEventConstructions += 1;
        }
      }
    });

    try {
      const shell = createResponsiveShell({ root: fixture.root, dispatch: command => commands.push(command) });
      fixture.buttons.primary!.emit('pointerdown', { button: 0 });
      fixture.buttons.primary!.emit('click', { detail: 1 });
      fixture.buttons['move-up']!.emit('pointerdown', { button: 2 });

      expect(commands).toEqual([{ kind: 'confirm' }]);
      expect(keyboardEventConstructions).toBe(0);
      shell.destroy();
    } finally {
      if (previousKeyboardEvent) Object.defineProperty(globalThis, 'KeyboardEvent', previousKeyboardEvent);
      else Reflect.deleteProperty(globalThis, 'KeyboardEvent');
    }
  });

  it('does not let a stale pointer marker swallow later keyboard activation', () => {
    const fixture = createFixture();
    const commands: GameCommand[] = [];
    const shell = createResponsiveShell({ root: fixture.root, dispatch: command => commands.push(command) });

    fixture.buttons.menu!.emit('pointerdown', { button: 0 });
    fixture.buttons.menu!.emit('click', { detail: 0 });

    expect(commands).toEqual([
      { kind: 'open', target: 'pause' },
      { kind: 'open', target: 'pause' }
    ]);
    shell.destroy();
  });

  it('updates semantic text only when each field actually changes', () => {
    const fixture = createFixture();
    const shell = createResponsiveShell({ root: fixture.root, dispatch: () => undefined });
    const state: SemanticGameState = {
      instructions: '使用方向键移动',
      surface: '世界',
      status: '第 1 日，气血充足',
      objective: '面对空地翻出第一块灵田',
      actions: '移动、行动、菜单',
      panel: '当前没有打开面板',
      announcement: '旅程开始'
    };

    shell.updateSemanticState(state);
    shell.updateSemanticState(state);

    expect(fixture.semanticNodes['#game-surface'].writes).toEqual(['世界']);
    expect(fixture.semanticNodes['#game-instructions'].writes).toEqual(['使用方向键移动']);
    expect(fixture.semanticNodes['#game-status'].writes).toEqual(['第 1 日，气血充足']);
    expect(fixture.semanticNodes['#game-objective'].writes).toEqual(['面对空地翻出第一块灵田']);
    expect(fixture.semanticNodes['#game-actions'].writes).toEqual(['移动、行动、菜单']);
    expect(fixture.semanticNodes['#game-panel'].writes).toEqual(['当前没有打开面板']);
    expect(fixture.semanticNodes['#game-announcement'].writes).toEqual(['旅程开始']);

    shell.updateSemanticState({ ...state, instructions: '使用 Tab 浏览', surface: '背包', objective: '查看背包', panel: '已打开面板：背包', announcement: '浇水成功' });
    expect(fixture.semanticNodes['#game-instructions'].writes).toEqual(['使用方向键移动', '使用 Tab 浏览']);
    expect(fixture.semanticNodes['#game-surface'].writes).toEqual(['世界', '背包']);
    expect(fixture.semanticNodes['#game-status'].writes).toHaveLength(1);
    expect(fixture.semanticNodes['#game-actions'].writes).toHaveLength(1);
    expect(fixture.semanticNodes['#game-objective'].writes).toEqual(['面对空地翻出第一块灵田', '查看背包']);
    expect(fixture.semanticNodes['#game-panel'].writes).toEqual(['当前没有打开面板', '已打开面板：背包']);
    expect(fixture.semanticNodes['#game-announcement'].writes).toEqual(['旅程开始', '浇水成功']);
    shell.destroy();
  });

  it('destroy removes every listener, is idempotent, and stops later semantic writes', () => {
    const fixture = createFixture();
    const commands: GameCommand[] = [];
    const shell = createResponsiveShell({ root: fixture.root, dispatch: command => commands.push(command) });
    expect(Object.values(fixture.buttons).every(button => button.listenerCount() > 0)).toBe(true);

    shell.destroy();
    shell.destroy();
    fixture.buttons.menu!.emit('click');
    shell.updateSemanticState({ status: '已销毁', objective: '无', actions: '无', panel: '无', announcement: '无' });

    expect(commands).toEqual([]);
    expect(Object.values(fixture.buttons).every(button => button.listenerCount() === 0)).toBe(true);
    expect(fixture.semanticNodes['#game-status'].writes).toEqual([]);
  });
});
