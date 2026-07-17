import { describe, expect, it } from 'vitest';
import { APP_FLOW_FOCUS_TARGETS, createAppFlowState, transitionAppFlow, type AppFlowEvent, type AppFlowState } from '@app/appFlowMachine';
import { createAppFlowViewController, deriveAppFlowPresentation, type AppFlowViewElement, type AppFlowViewEventTarget, type AppFlowViewRoot } from '@app/appFlowView';

class FakeElement implements AppFlowViewElement {
  hidden = true;
  inert = true;
  disabled = false;
  textContent: string | null = '';
  focused = 0;
  readonly children: FakeElement[] = [];
  private readonly attributes = new Map<string, string>();
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  constructor(
    readonly id: string,
    attributes: Readonly<Record<string, string>> = {},
    private readonly root?: FakeRoot
  ) {
    for (const [name, value] of Object.entries(attributes)) this.attributes.set(name, value);
  }

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  focus(): void {
    this.focused += 1;
    if (this.root) this.root.activeElement = this;
  }

  contains(target: unknown): boolean {
    return target === this || this.children.includes(target as FakeElement);
  }

  querySelectorAll(selector: string): ArrayLike<AppFlowViewElement> {
    if (selector === '[data-flow-focusable]') return this.children.filter(child => !child.disabled && child.getAttribute('data-flow-focusable') === 'true');
    return [];
  }

  getAttribute(name: string): string | null {
    if (name === 'id') return this.id;
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
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

class FakeRoot implements AppFlowViewRoot, AppFlowViewEventTarget {
  activeElement: FakeElement | null = null;
  readonly surfaces = new Map<string, FakeElement>();
  readonly elements = new Map<string, FakeElement>();
  readonly buttons: FakeElement[] = [];
  private readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  addSurface(surface: string): FakeElement {
    const element = new FakeElement(`surface-${surface}`, { 'data-app-surface': surface }, this);
    this.surfaces.set(surface, element);
    this.elements.set(`#surface-${surface}`, element);
    return element;
  }

  addElement(id: string, attributes: Readonly<Record<string, string>> = {}): FakeElement {
    const element = new FakeElement(id, attributes, this);
    element.hidden = false;
    element.inert = false;
    this.elements.set(`#${id}`, element);
    return element;
  }

  addButton(surface: string, id: string, action: string): FakeElement {
    const button = this.addElement(id, {
      'data-flow-action': action,
      'data-flow-focusable': 'true'
    });
    this.surfaces.get(surface)?.append(button);
    this.buttons.push(button);
    return button;
  }

  addFocusable(surface: string, id: string): FakeElement {
    const element = this.addElement(id, { 'data-flow-focusable': 'true' });
    this.surfaces.get(surface)?.append(element);
    return element;
  }

  querySelector(selector: string): AppFlowViewElement | null {
    const surface = selector.match(/^\[data-app-surface="(.+)"\]$/)?.[1];
    if (surface) return this.surfaces.get(surface) ?? null;
    if (selector === APP_FLOW_FOCUS_TARGETS.world) return this.elements.get('#game-canvas') ?? null;
    if (selector === '[data-flow-action="continue-game"]') return this.buttons.find(button => button.getAttribute('data-flow-action') === 'continue-game') ?? null;
    return this.elements.get(selector) ?? null;
  }

  querySelectorAll(selector: string): ArrayLike<AppFlowViewElement> {
    if (selector === '[data-app-surface]') return [...this.surfaces.values()];
    if (selector === 'button[data-flow-action]') return this.buttons;
    return [];
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
}

const SURFACES = ['loading', 'boot-error', 'world', 'title', 'prologue', 'settings', 'pause', 'inventory', 'map', 'cultivation', 'alchemy', 'tribulation', 'aftermath', 'ending', 'portrait-blocked'] as const;

function createFixture() {
  const root = new FakeRoot();
  for (const surface of SURFACES) root.addSurface(surface);
  const canvas = root.addElement('game-canvas');
  root.surfaces.get('world')?.append(canvas);
  const orientationHeading = root.addElement('orientation-heading', { tabindex: '-1' });
  root.surfaces.get('portrait-blocked')?.append(orientationHeading);
  root.addElement('flow-continue-status');
  const buildLabel = root.addElement('flow-title-version');

  const buttons = {
    bootErrorReload: root.addButton('boot-error', 'flow-boot-error-reload', 'reload-page'),
    newGame: root.addButton('title', 'flow-title-new-game', 'start-new-game'),
    continueGame: root.addButton('title', 'flow-title-continue', 'continue-game'),
    settings: root.addButton('title', 'flow-title-settings', 'open-settings'),
    prologueContinue: root.addButton('prologue', 'flow-prologue-continue', 'finish-prologue'),
    prologueSkip: root.addButton('prologue', 'flow-prologue-skip', 'skip-prologue'),
    settingsClose: root.addButton('settings', 'flow-settings-close', 'close-overlay'),
    pauseClose: root.addButton('pause', 'flow-pause-resume', 'close-overlay'),
    inventoryClose: root.addButton('inventory', 'flow-inventory-close', 'close-overlay'),
    mapClose: root.addButton('map', 'flow-map-close', 'close-overlay'),
    cultivationClose: root.addButton('cultivation', 'flow-cultivation-close', 'close-overlay'),
    alchemyHeat: root.addFocusable('alchemy', 'flow-alchemy-heat'),
    alchemyPrimary: root.addFocusable('alchemy', 'flow-alchemy-primary'),
    alchemyClose: root.addButton('alchemy', 'flow-alchemy-return', 'close-alchemy'),
    tribulationPrimary: root.addFocusable('tribulation', 'flow-tribulation-primary'),
    tribulationPause: root.addButton('tribulation', 'flow-tribulation-pause', 'open-pause'),
    aftermathContinue: root.addButton('aftermath', 'flow-aftermath-continue', 'continue-aftermath'),
    endingReturn: root.addButton('ending', 'flow-ending-return', 'return-title')
  };

  return { root, buttons, canvas, buildLabel };
}

function visibleSurfaces(root: FakeRoot): string[] {
  return [...root.surfaces.entries()].filter(([, surface]) => !surface.hidden).map(([name]) => name);
}

function runFlow(events: readonly AppFlowEvent[]): AppFlowState {
  return events.reduce(transitionAppFlow, createAppFlowState());
}

describe('app flow DOM presentation', () => {
  it('maps every flow state and overlay to one concrete surface', () => {
    const cases: Array<[AppFlowState, string]> = [
      [createAppFlowState(), 'loading'],
      [runFlow([{ type: 'boot-error' }]), 'boot-error'],
      [runFlow([{ type: 'boot-ready' }]), 'title'],
      [runFlow([{ type: 'boot-ready' }, { type: 'start-new-game' }]), 'prologue'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }]), 'world'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'open-alchemy' }]), 'alchemy'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'start-tribulation' }]), 'tribulation'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'start-tribulation' }, { type: 'finish-tribulation' }]), 'aftermath'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'show-ending' }]), 'ending'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'open-overlay', overlay: 'inventory' }]), 'inventory'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'open-overlay', overlay: 'map' }]), 'map'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'open-overlay', overlay: 'cultivation' }]), 'cultivation'],
      [runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'open-overlay', overlay: 'pause' }]), 'pause'],
      [runFlow([{ type: 'boot-ready' }, { type: 'open-overlay', overlay: 'settings' }]), 'settings']
    ];

    for (const [flow, surface] of cases) {
      expect(deriveAppFlowPresentation({ flow })).toMatchObject({ surface });
    }
    expect(deriveAppFlowPresentation({ flow: cases.at(-1)![0], portraitBlocked: true })).toMatchObject({
      mode: 'portrait-blocked',
      surface: 'portrait-blocked',
      focusTarget: APP_FLOW_FOCUS_TARGETS.orientation
    });
  });

  it('keeps the world surface while deriving one authoritative legacy attention mode', () => {
    const { root, buttons } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root, continueAvailable: true });
    controller.dispatch({ type: 'boot-ready' });
    buttons.continueGame.emit('click');

    controller.setWorldAttention({ panelActive: true });
    expect(controller.getPresentation()).toMatchObject({ surface: 'world', mode: 'panel' });
    const panelEscape = root.emit('keydown', { key: 'Escape' });
    expect(panelEscape.defaultPrevented).toBe(false);
    expect(controller.getState()).toMatchObject({ screen: 'world', overlay: null });
    controller.setWorldAttention({ panelActive: true, locationActive: true, dialogueActive: true });
    expect(controller.getPresentation()).toMatchObject({ surface: 'world', mode: 'dialogue' });
    controller.setWorldAttention({});
    expect(controller.getPresentation()).toMatchObject({ surface: 'world', mode: 'world' });
    controller.destroy();
  });

  it('shows boot failures as the only surface, focuses recovery, and delegates reload', () => {
    const { root, buttons } = createFixture();
    let reloadRequests = 0;
    const controller = createAppFlowViewController({
      root,
      keyboardTarget: root,
      onReloadRequest: () => {
        reloadRequests += 1;
      }
    });

    controller.dispatch({ type: 'boot-error' });

    expect(controller.getPresentation()).toMatchObject({
      mode: 'boot-error',
      surface: 'boot-error',
      focusTarget: APP_FLOW_FOCUS_TARGETS.bootError
    });
    expect(visibleSurfaces(root)).toEqual(['boot-error']);
    expect(root.activeElement).toBe(buttons.bootErrorReload);
    buttons.bootErrorReload.emit('click');
    expect(reloadRequests).toBe(1);
    expect(controller.getState().screen).toBe('boot-error');
    controller.destroy();
  });

  it('shows exactly one surface, marks the rest inert, and focuses the page target', () => {
    const { root, buttons } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root });

    expect(visibleSurfaces(root)).toEqual(['loading']);
    controller.dispatch({ type: 'boot-ready' });

    expect(visibleSurfaces(root)).toEqual(['title']);
    expect(buttons.newGame.focused).toBe(1);
    expect(root.surfaces.get('title')?.inert).toBe(false);
    expect(root.surfaces.get('title')?.getAttribute('aria-hidden')).toBe('false');
    expect(root.surfaces.get('world')?.inert).toBe(true);
    expect(root.surfaces.get('world')?.getAttribute('aria-hidden')).toBe('true');
    controller.destroy();
  });

  it('binds native actions, keeps continue hidden until a save exists, and reports accepted transitions', () => {
    const { root, buttons, buildLabel } = createFixture();
    const transitions: AppFlowEvent[] = [];
    const controller = createAppFlowViewController({
      root,
      keyboardTarget: root,
      onStateChange: (_next, _previous, event) => transitions.push(event)
    });

    controller.dispatch({ type: 'boot-ready' });
    expect(buttons.continueGame.disabled).toBe(true);
    expect(buttons.continueGame.hidden).toBe(true);
    expect(root.querySelector('#flow-continue-status')?.textContent).toContain('暂无存档');
    buttons.continueGame.emit('click');
    expect(controller.getState().screen).toBe('title');

    controller.setContinueAvailable(true);
    controller.setBuildLabel('版本 test-revision · 本地构建');
    expect(buttons.continueGame.disabled).toBe(false);
    expect(buttons.continueGame.hidden).toBe(false);
    expect(buildLabel.textContent).toBe('版本 test-revision · 本地构建');
    buttons.newGame.emit('click');
    expect(controller.getState().screen).toBe('prologue');
    buttons.prologueSkip.emit('click');
    expect(controller.getState().screen).toBe('world');
    expect(transitions.map(event => event.type)).toEqual(['boot-ready', 'start-new-game', 'skip-prologue']);
    controller.destroy();
  });

  it('uses Escape to pause and resume World and Tribulation, and to leave Alchemy', () => {
    const { root, buttons, canvas } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root, continueAvailable: true });
    controller.dispatch({ type: 'boot-ready' });
    buttons.continueGame.emit('click');

    const pauseWorld = root.emit('keydown', { key: 'Escape' });
    expect(pauseWorld.defaultPrevented).toBe(true);
    expect(controller.getState()).toMatchObject({ screen: 'world', overlay: 'pause' });
    expect(root.activeElement).toBe(buttons.pauseClose);
    root.emit('keydown', { key: 'Escape' });
    expect(controller.getState()).toMatchObject({ screen: 'world', overlay: null });
    expect(root.activeElement).toBe(canvas);

    controller.dispatch({ type: 'start-tribulation' });
    const pauseTribulation = root.emit('keydown', { key: 'Escape' });
    expect(pauseTribulation.defaultPrevented).toBe(true);
    expect(controller.getState()).toMatchObject({ screen: 'tribulation', overlay: 'pause' });
    root.emit('keydown', { key: 'Escape' });
    expect(controller.getState()).toMatchObject({ screen: 'tribulation', overlay: null });
    expect(root.activeElement).toBe(buttons.tribulationPrimary);

    controller.dispatch({ type: 'open-overlay', overlay: 'settings', returnFocus: APP_FLOW_FOCUS_TARGETS.world });
    expect(root.activeElement).toBe(buttons.settingsClose);
    buttons.settingsClose.emit('click');
    expect(controller.getState()).toMatchObject({ screen: 'tribulation', overlay: null });
    expect(root.activeElement).toBe(buttons.tribulationPrimary);

    controller.dispatch({ type: 'finish-tribulation' });
    buttons.aftermathContinue.emit('click');
    controller.dispatch({ type: 'open-alchemy' });
    const leaveAlchemy = root.emit('keydown', { key: 'Escape' });
    expect(leaveAlchemy.defaultPrevented).toBe(true);
    expect(controller.getState()).toMatchObject({ screen: 'world', overlay: null });
    expect(root.activeElement).toBe(canvas);
    controller.destroy();
  });

  it('captures an overlay trigger, closes on Escape, and restores focus to that trigger', () => {
    const { root, buttons } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root });

    controller.dispatch({ type: 'boot-ready' });
    buttons.settings.emit('click');
    expect(controller.getState()).toMatchObject({ screen: 'title', overlay: 'settings' });
    expect(visibleSurfaces(root)).toEqual(['settings']);
    expect(buttons.settingsClose.focused).toBe(1);

    const escape = root.emit('keydown', { key: 'Escape' });
    expect(escape.defaultPrevented).toBe(true);
    expect(controller.getState()).toMatchObject({ screen: 'title', overlay: null });
    expect(visibleSurfaces(root)).toEqual(['title']);
    expect(root.activeElement).toBe(buttons.settings);
    controller.destroy();
  });

  it('routes the reserved alchemy, tribulation, aftermath, and ending page actions', () => {
    const { root, buttons } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root, continueAvailable: true });
    controller.dispatch({ type: 'boot-ready' });
    buttons.continueGame.emit('click');

    controller.dispatch({ type: 'open-alchemy' });
    expect(visibleSurfaces(root)).toEqual(['alchemy']);
    expect(root.activeElement).toBe(buttons.alchemyPrimary);
    buttons.alchemyClose.emit('click');
    expect(controller.getState().screen).toBe('world');

    controller.dispatch({ type: 'start-tribulation' });
    expect(root.activeElement).toBe(buttons.tribulationPrimary);
    buttons.tribulationPause.emit('click');
    expect(visibleSurfaces(root)).toEqual(['pause']);
    buttons.pauseClose.emit('click');
    expect(controller.getState()).toMatchObject({ screen: 'tribulation', overlay: null });

    controller.dispatch({ type: 'finish-tribulation' });
    expect(visibleSurfaces(root)).toEqual(['aftermath']);
    buttons.aftermathContinue.emit('click');
    expect(controller.getState().screen).toBe('world');

    controller.dispatch({ type: 'show-ending' });
    expect(visibleSurfaces(root)).toEqual(['ending']);
    buttons.endingReturn.emit('click');
    expect(controller.getState().screen).toBe('title');
    controller.destroy();
  });

  it('re-focuses the configured target after it becomes enabled on the current surface', () => {
    const { root, buttons, canvas } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root, continueAvailable: true });
    controller.dispatch({ type: 'boot-ready' });
    buttons.continueGame.emit('click');
    buttons.alchemyPrimary.disabled = true;

    controller.dispatch({ type: 'open-alchemy' });

    expect(root.activeElement).toBe(buttons.alchemyHeat);
    buttons.alchemyPrimary.disabled = false;
    controller.refocusCurrentSurface();
    expect(root.activeElement).toBe(buttons.alchemyPrimary);

    buttons.alchemyPrimary.hidden = true;
    controller.refocusCurrentSurface();
    expect(root.activeElement).toBe(buttons.alchemyHeat);

    controller.dispatch({ type: 'close-alchemy' });
    controller.refocusCurrentSurface();
    expect(root.activeElement).toBe(canvas);
    controller.destroy();
  });

  it('wraps Tab last-to-first and Shift+Tab first-to-last with multiple focusable buttons', () => {
    const { root, buttons } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root });
    controller.dispatch({ type: 'boot-ready' });

    buttons.settings.focus();
    const forward = root.emit('keydown', { key: 'Tab', shiftKey: false });
    expect(forward.defaultPrevented).toBe(true);
    expect(root.activeElement).toBe(buttons.newGame);

    buttons.newGame.focus();
    const backward = root.emit('keydown', { key: 'Tab', shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(root.activeElement).toBe(buttons.settings);
    controller.destroy();
  });

  it('blocks page actions while portrait-gated and restores the underlying presentation afterward', () => {
    const { root, buttons } = createFixture();
    const transitions: AppFlowEvent[] = [];
    const controller = createAppFlowViewController({
      root,
      keyboardTarget: root,
      onStateChange: (_next, _previous, event) => transitions.push(event)
    });
    controller.dispatch({ type: 'boot-ready' });

    controller.setPortraitBlocked(true);
    expect(visibleSurfaces(root)).toEqual(['portrait-blocked']);
    expect(root.activeElement?.id).toBe('orientation-heading');
    buttons.newGame.emit('click');
    const blockedEscape = root.emit('keydown', { key: 'Escape' });
    expect(controller.getState().screen).toBe('title');
    expect(transitions.map(event => event.type)).toEqual(['boot-ready']);
    expect(blockedEscape.defaultPrevented).toBe(true);

    controller.setPortraitBlocked(false);
    expect(visibleSurfaces(root)).toEqual(['title']);
    expect(root.activeElement).toBe(buttons.newGame);
    controller.destroy();
  });

  it('removes action and keyboard listeners when destroyed', () => {
    const { root, buttons } = createFixture();
    const controller = createAppFlowViewController({ root, keyboardTarget: root });
    controller.dispatch({ type: 'boot-ready' });
    expect(buttons.newGame.listenerCount()).toBeGreaterThan(0);

    controller.destroy();
    buttons.newGame.emit('click');

    expect(buttons.newGame.listenerCount()).toBe(0);
    expect(controller.getState().screen).toBe('title');
  });
});
