import { APP_FLOW_FOCUS_TARGETS, createAppFlowState, transitionAppFlow, type AppFlowEvent, type AppFlowState, type AppFocusSelector } from './appFlowMachine';
import { deriveUiMode, type UiMode, type UiModeInput } from './uiMode';

export const APP_SURFACE_IDS = ['loading', 'boot-error', 'world', 'title', 'prologue', 'settings', 'pause', 'inventory', 'map', 'cultivation', 'alchemy', 'tribulation', 'aftermath', 'ending', 'portrait-blocked'] as const;

export type AppSurfaceId = (typeof APP_SURFACE_IDS)[number];

export const APP_SURFACE_LABELS: Readonly<Record<AppSurfaceId, string>> = {
  loading: '载入中',
  'boot-error': '载入失败',
  world: '农庄世界',
  title: '标题',
  prologue: '序章',
  settings: '设置',
  pause: '暂停',
  inventory: '背包',
  map: '地点',
  cultivation: '修行',
  alchemy: '炼丹',
  tribulation: '教学天劫',
  aftermath: '战后结算',
  ending: '结局',
  'portrait-blocked': '请横置设备'
};

export const DEFAULT_BUILD_LABEL = '版本 0.1.0 · 试玩构建';

export type AppFlowPresentationInput = UiModeInput & { readonly continueAvailable?: boolean };
export type AppWorldAttention = Pick<UiModeInput, 'dialogueActive' | 'panelActive' | 'locationActive'>;

export interface AppFlowPresentation {
  readonly mode: UiMode;
  readonly surface: AppSurfaceId;
  readonly focusTarget: AppFocusSelector;
  readonly continueAvailable: boolean;
}

export interface AppFlowViewEventTarget {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export interface AppFlowViewElement extends AppFlowViewEventTarget {
  readonly id: string;
  hidden: boolean;
  inert: boolean;
  disabled?: boolean;
  textContent: string | null;
  focus(options?: FocusOptions): void;
  contains(target: unknown): boolean;
  querySelectorAll(selector: string): ArrayLike<AppFlowViewElement>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface AppFlowViewRoot extends AppFlowViewEventTarget {
  readonly activeElement?: AppFlowViewElement | null;
  querySelector(selector: string): AppFlowViewElement | null;
  querySelectorAll(selector: string): ArrayLike<AppFlowViewElement>;
}

export interface AppFlowViewControllerOptions {
  readonly root?: AppFlowViewRoot | null;
  readonly keyboardTarget?: AppFlowViewEventTarget | null;
  readonly initialState?: AppFlowState;
  readonly continueAvailable?: boolean;
  readonly portraitBlocked?: boolean;
  readonly buildLabel?: string;
  readonly onStateChange?: (next: AppFlowState, previous: AppFlowState, event: AppFlowEvent) => void;
  readonly onReloadRequest?: () => void;
}

export interface AppFlowViewController {
  getState(): AppFlowState;
  getPresentation(): AppFlowPresentation;
  dispatch(event: AppFlowEvent): AppFlowState;
  refocusCurrentSurface(): void;
  setContinueAvailable(available: boolean): void;
  setBuildLabel(label: string): void;
  setPortraitBlocked(blocked: boolean): void;
  setWorldAttention(attention: AppWorldAttention): void;
  destroy(): void;
}

type AppFlowAction = 'reload-page' | 'start-new-game' | 'continue-game' | 'open-settings' | 'finish-prologue' | 'skip-prologue' | 'close-overlay' | 'close-alchemy' | 'open-pause' | 'continue-aftermath' | 'return-title';

interface ListenerBinding {
  readonly target: AppFlowViewEventTarget;
  readonly type: string;
  readonly listener: EventListener;
}

function defaultRoot(): AppFlowViewRoot | null {
  if (typeof document === 'undefined') return null;
  return document as unknown as AppFlowViewRoot;
}

function defaultKeyboardTarget(): AppFlowViewEventTarget | null {
  if (typeof document === 'undefined') return null;
  return document;
}

function surfaceForFlow(flow: AppFlowState): AppSurfaceId {
  if (flow.overlay) return flow.overlay;
  return flow.screen === 'boot' ? 'loading' : flow.screen;
}

export function deriveAppFlowPresentation(input: AppFlowPresentationInput): AppFlowPresentation {
  if (input.portraitBlocked) {
    return {
      mode: 'portrait-blocked',
      surface: 'portrait-blocked',
      focusTarget: APP_FLOW_FOCUS_TARGETS.orientation,
      continueAvailable: input.continueAvailable === true
    };
  }

  return {
    mode: deriveUiMode(input),
    surface: surfaceForFlow(input.flow),
    focusTarget: input.flow.focus.initial,
    continueAvailable: input.continueAvailable === true
  };
}

function isFlowAction(value: string | null): value is AppFlowAction {
  switch (value) {
    case 'reload-page':
    case 'start-new-game':
    case 'continue-game':
    case 'open-settings':
    case 'finish-prologue':
    case 'skip-prologue':
    case 'close-overlay':
    case 'close-alchemy':
    case 'open-pause':
    case 'continue-aftermath':
    case 'return-title':
      return true;
    default:
      return false;
  }
}

function focusSelectorFor(element: AppFlowViewElement, fallback: AppFocusSelector): AppFocusSelector {
  return element.id ? (`#${element.id}` as AppFocusSelector) : fallback;
}

function eventForAction(action: Exclude<AppFlowAction, 'reload-page'>, trigger: AppFlowViewElement, state: AppFlowState): AppFlowEvent {
  switch (action) {
    case 'start-new-game':
      return { type: 'start-new-game' };
    case 'continue-game':
      return { type: 'continue-game' };
    case 'open-settings':
      return { type: 'open-overlay', overlay: 'settings', returnFocus: focusSelectorFor(trigger, state.focus.initial) };
    case 'finish-prologue':
      return { type: 'finish-prologue' };
    case 'skip-prologue':
      return { type: 'skip-prologue' };
    case 'close-overlay':
      return { type: 'close-overlay' };
    case 'close-alchemy':
      return { type: 'close-alchemy' };
    case 'open-pause':
      return { type: 'open-overlay', overlay: 'pause', returnFocus: focusSelectorFor(trigger, state.focus.initial) };
    case 'continue-aftermath':
      return { type: 'continue-aftermath' };
    case 'return-title':
      return { type: 'return-title' };
  }
}

function keyValue(event: Event): string | null {
  const value = (event as Event & { readonly key?: unknown }).key;
  return typeof value === 'string' ? value : null;
}

function shiftPressed(event: Event): boolean {
  return (event as Event & { readonly shiftKey?: unknown }).shiftKey === true;
}

function commandModifierPressed(event: Event): boolean {
  const keyboard = event as Event & { readonly altKey?: unknown; readonly ctrlKey?: unknown; readonly metaKey?: unknown };
  return keyboard.altKey === true || keyboard.ctrlKey === true || keyboard.metaKey === true;
}

function surfaceSelector(surface: AppSurfaceId): string {
  return `[data-app-surface="${surface}"]`;
}

export function createAppFlowViewController(options: AppFlowViewControllerOptions = {}): AppFlowViewController {
  const root = options.root === undefined ? defaultRoot() : options.root;
  const keyboardTarget = options.keyboardTarget === undefined ? defaultKeyboardTarget() : options.keyboardTarget;
  const surfaces = Array.from(root?.querySelectorAll('[data-app-surface]') ?? []);
  const bindings: ListenerBinding[] = [];
  let state = options.initialState ?? createAppFlowState();
  let portraitBlocked = options.portraitBlocked ?? false;
  let continueAvailable = options.continueAvailable ?? false;
  let buildLabel = options.buildLabel?.trim() || DEFAULT_BUILD_LABEL;
  let worldAttention: AppWorldAttention = {};
  let presentation = deriveAppFlowPresentation({ flow: state, portraitBlocked, continueAvailable, ...worldAttention });
  let renderedSurface: AppSurfaceId | null = null;
  let renderedFocusTarget: AppFocusSelector | null = null;
  let destroyed = false;

  function activeSurface(): AppFlowViewElement | null {
    return root?.querySelector(surfaceSelector(presentation.surface)) ?? null;
  }

  function focusPresentationTarget(): void {
    if (!root) return;
    const surface = activeSurface();
    if (!surface) return;
    const requested = root.querySelector(presentation.focusTarget);
    const canFocus = (candidate: AppFlowViewElement | null): candidate is AppFlowViewElement => candidate != null && surface.contains(candidate) && candidate.disabled !== true && candidate.hidden !== true && candidate.inert !== true;
    const fallback = Array.from(surface.querySelectorAll('[data-flow-focusable]')).find(candidate => canFocus(candidate));
    const target = canFocus(requested) ? requested : (fallback ?? (canFocus(surface) ? surface : null));
    target?.focus({ preventScroll: true });
  }

  function render(): void {
    if (destroyed) return;
    presentation = deriveAppFlowPresentation({ flow: state, portraitBlocked, continueAvailable, ...worldAttention });
    for (const surface of surfaces) {
      const active = surface.getAttribute('data-app-surface') === presentation.surface;
      surface.hidden = !active;
      surface.inert = !active;
      surface.setAttribute('aria-hidden', String(!active));
    }

    if (renderedSurface !== presentation.surface || renderedFocusTarget !== presentation.focusTarget) {
      renderedSurface = presentation.surface;
      renderedFocusTarget = presentation.focusTarget;
      focusPresentationTarget();
    }
  }

  function updateContinueControl(): void {
    const button = root?.querySelector('[data-flow-action="continue-game"]') ?? null;
    if (button) {
      // 无存档时隐藏整行，避免首进玩家把灰掉的「继续」当成主路径（player audit P1）
      button.disabled = !continueAvailable;
      button.hidden = !continueAvailable;
      button.setAttribute('aria-disabled', String(!continueAvailable));
    }
    const status = root?.querySelector('#flow-continue-status') ?? null;
    if (status) {
      // 有存档时不必占位；无存档时显示「暂无存档」指引
      status.textContent = continueAvailable ? '已找到可继续的本地旅程。' : '暂无存档 — 请从「新游戏」开始。';
      status.hidden = continueAvailable;
    }
  }

  function updateBuildLabel(): void {
    const element = root?.querySelector('#flow-title-version') ?? null;
    if (element) element.textContent = buildLabel;
  }

  function dispatch(event: AppFlowEvent): AppFlowState {
    if (destroyed || portraitBlocked) return state;
    const previous = state;
    const next = transitionAppFlow(previous, event);
    if (next === previous) return state;
    state = next;
    render();
    options.onStateChange?.(state, previous, event);
    return state;
  }

  function escapeEventForCurrentState(): AppFlowEvent | null {
    if (state.overlay != null) return { type: 'close-overlay' };
    if (state.screen === 'alchemy') return { type: 'close-alchemy' };
    if (state.screen === 'world') return presentation.mode === 'world' ? { type: 'open-overlay', overlay: 'pause' } : null;
    if (state.screen === 'tribulation') return { type: 'open-overlay', overlay: 'pause' };
    return null;
  }

  function trapFocus(event: Event): void {
    const surface = activeSurface();
    if (!surface || presentation.surface === 'world' || presentation.surface === 'loading') return;
    const focusable = Array.from(surface.querySelectorAll('[data-flow-focusable]')).filter(candidate => candidate.disabled !== true);
    if (focusable.length === 0) return;
    const current = root?.activeElement ?? null;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (focusable.length === 1 || !surface.contains(current) || (!shiftPressed(event) && current === last) || (shiftPressed(event) && current === first)) {
      event.preventDefault();
      event.stopPropagation();
      (shiftPressed(event) ? last : first).focus({ preventScroll: true });
    }
  }

  const onKeyDown: EventListener = event => {
    if (destroyed) return;
    if (portraitBlocked) {
      if (!commandModifierPressed(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const key = keyValue(event);
    if (key === 'Escape') {
      const escapeEvent = escapeEventForCurrentState();
      if (!escapeEvent) return;
      event.preventDefault();
      event.stopPropagation();
      dispatch(escapeEvent);
      return;
    }
    if (key === 'Tab') trapFocus(event);
  };

  if (keyboardTarget) {
    keyboardTarget.addEventListener('keydown', onKeyDown);
    bindings.push({ target: keyboardTarget, type: 'keydown', listener: onKeyDown });
  }

  for (const button of Array.from(root?.querySelectorAll('button[data-flow-action]') ?? [])) {
    const action = button.getAttribute('data-flow-action');
    if (!isFlowAction(action)) continue;
    const onClick: EventListener = event => {
      if (destroyed) return;
      if (portraitBlocked || button.disabled === true) {
        event.preventDefault();
        if (portraitBlocked) event.stopPropagation();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (action === 'reload-page') {
        options.onReloadRequest?.();
        return;
      }
      dispatch(eventForAction(action, button, state));
    };
    button.addEventListener('click', onClick);
    bindings.push({ target: button, type: 'click', listener: onClick });
  }

  updateContinueControl();
  updateBuildLabel();
  render();

  return {
    getState(): AppFlowState {
      return state;
    },
    getPresentation(): AppFlowPresentation {
      return presentation;
    },
    dispatch,
    refocusCurrentSurface(): void {
      if (destroyed) return;
      focusPresentationTarget();
    },
    setContinueAvailable(available: boolean): void {
      if (destroyed || continueAvailable === available) return;
      continueAvailable = available;
      updateContinueControl();
      render();
    },
    setBuildLabel(label: string): void {
      if (destroyed) return;
      buildLabel = label.trim() || DEFAULT_BUILD_LABEL;
      updateBuildLabel();
    },
    setPortraitBlocked(blocked: boolean): void {
      if (destroyed || portraitBlocked === blocked) return;
      portraitBlocked = blocked;
      render();
    },
    setWorldAttention(attention: AppWorldAttention): void {
      if (destroyed) return;
      const next = {
        dialogueActive: attention.dialogueActive === true,
        panelActive: attention.panelActive === true,
        locationActive: attention.locationActive === true
      };
      if (next.dialogueActive === worldAttention.dialogueActive && next.panelActive === worldAttention.panelActive && next.locationActive === worldAttention.locationActive) return;
      worldAttention = next;
      render();
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const binding of bindings) binding.target.removeEventListener(binding.type, binding.listener);
      bindings.length = 0;
    }
  };
}
