import { describe, expect, it } from 'vitest';
import { createResponsiveShell, type ResponsiveShellElement, type ResponsiveShellRoot, type SemanticGameState } from '@app/responsiveShell';

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

  constructor(private readonly semanticNodes: Readonly<Record<string, FakeElement>>) {}

  querySelector(selector: string): ResponsiveShellElement | null {
    return this.semanticNodes[selector] ?? null;
  }

  querySelectorAll(selector: string): ArrayLike<ResponsiveShellElement> {
    this.queriedSelectors.push(selector);
    return [];
  }
}

function createFixture() {
  const semanticNodes = {
    '#game-instructions': new FakeElement({}, '使用当前页面控件。'),
    '#game-surface': new FakeElement({}, '当前页面将在载入后显示。'),
    '#game-status': new FakeElement({}, '游戏正在载入。'),
    '#game-objective': new FakeElement({}, '当前目标将在载入后显示。'),
    '#game-actions': new FakeElement({}, '可用操作将在载入后显示。'),
    '#game-panel': new FakeElement({}, '当前没有打开面板。'),
    '#game-announcement': new FakeElement({}, '')
  };
  return { semanticNodes, root: new FakeRoot(semanticNodes) };
}

function semanticState(overrides: Partial<SemanticGameState> = {}): SemanticGameState {
  return {
    instructions: '使用 Tab 浏览当前页面控件，Enter 或 Space 激活。',
    surface: '当前页面：标题。',
    status: '当前状态：标题菜单。',
    objective: '当前目标：开始一段本地旅程。',
    actions: '当前可用动作：开始游戏；设置。',
    panel: '当前没有打开面板。',
    announcement: '',
    ...overrides
  };
}

describe('responsive shell', () => {
  it('can be created without a real document and remains an inert safe shell', () => {
    const shell = createResponsiveShell();
    expect(() => shell.updateSemanticState(semanticState())).not.toThrow();
    expect(() => shell.destroy()).not.toThrow();
  });

  it('binds no command listeners: touch routing retired with the legacy world (docs/21 §8.28)', () => {
    const { root, semanticNodes } = createFixture();
    const shell = createResponsiveShell({ root });
    for (const node of Object.values(semanticNodes)) expect(node.listenerCount()).toBe(0);
    shell.destroy();
  });

  it('updates semantic text only when each field actually changes', () => {
    const { root, semanticNodes } = createFixture();
    const shell = createResponsiveShell({ root });

    shell.updateSemanticState(semanticState());
    const writesAfterFirst = Object.values(semanticNodes).reduce((total, node) => total + node.writes.length, 0);
    expect(writesAfterFirst).toBeGreaterThan(0);

    // 相同输入零写入
    shell.updateSemanticState(semanticState());
    const writesAfterRepeat = Object.values(semanticNodes).reduce((total, node) => total + node.writes.length, 0);
    expect(writesAfterRepeat).toBe(writesAfterFirst);

    // 仅 objective 变化时只写 objective
    shell.updateSemanticState(semanticState({ objective: '当前目标：参悟第一道劫兆。' }));
    expect(semanticNodes['#game-objective']!.writes.at(-1)).toContain('参悟第一道劫兆');
    const surfaceWrites = semanticNodes['#game-surface']!.writes.length;
    shell.updateSemanticState(semanticState({ objective: '当前目标：参悟第一道劫兆。' }));
    expect(semanticNodes['#game-surface']!.writes.length).toBe(surfaceWrites);
    shell.destroy();
  });

  it('destroy removes every listener, is idempotent, and stops later semantic writes', () => {
    const { root, semanticNodes } = createFixture();
    const shell = createResponsiveShell({ root });
    shell.updateSemanticState(semanticState());
    shell.destroy();
    shell.destroy();

    const writesBefore = Object.values(semanticNodes).reduce((total, node) => total + node.writes.length, 0);
    shell.updateSemanticState(semanticState({ status: '当前状态：已销毁。' }));
    const writesAfter = Object.values(semanticNodes).reduce((total, node) => total + node.writes.length, 0);
    expect(writesAfter).toBe(writesBefore);
  });
});
