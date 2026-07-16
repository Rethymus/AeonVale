import { gameCommandFromTouch, type GameCommand, type TouchInput } from './semanticInputRouter';

export interface ResponsiveShellElement {
  textContent: string | null;
  getAttribute(name: string): string | null;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

export interface ResponsiveShellRoot {
  querySelector(selector: string): ResponsiveShellElement | null;
  querySelectorAll(selector: string): ArrayLike<ResponsiveShellElement>;
}

export interface SemanticGameState {
  readonly instructions?: string;
  readonly surface?: string;
  readonly status: string;
  readonly objective: string;
  readonly actions: string;
  readonly panel: string;
  readonly announcement: string;
}

export interface ResponsiveShellController {
  updateSemanticState(state: SemanticGameState): void;
  destroy(): void;
}

export interface ResponsiveShellOptions {
  readonly dispatch: (command: GameCommand) => void;
  readonly root?: ResponsiveShellRoot | null;
}

interface ListenerBinding {
  readonly element: ResponsiveShellElement;
  readonly type: 'pointerdown' | 'click';
  readonly listener: EventListener;
}

const SEMANTIC_SELECTORS = {
  instructions: '#game-instructions',
  surface: '#game-surface',
  status: '#game-status',
  objective: '#game-objective',
  actions: '#game-actions',
  panel: '#game-panel',
  announcement: '#game-announcement'
} as const;

function defaultRoot(): ResponsiveShellRoot | null {
  if (typeof document === 'undefined') return null;
  return document as unknown as ResponsiveShellRoot;
}

function touchInputFor(commandName: string | null): TouchInput | null {
  switch (commandName) {
    case 'move-up':
      return { control: 'move', direction: 'up' };
    case 'move-down':
      return { control: 'move', direction: 'down' };
    case 'move-left':
      return { control: 'move', direction: 'left' };
    case 'move-right':
      return { control: 'move', direction: 'right' };
    case 'primary':
      return { control: 'confirm' };
    case 'secondary':
      return { control: 'cycle', direction: 'next' };
    case 'menu':
      return { control: 'open', target: 'pause' };
    case 'farm':
      return { control: 'open', target: 'menu' };
    case 'inventory':
      return { control: 'open', target: 'inventory' };
    case 'cultivation':
      return { control: 'open', target: 'cultivation' };
    case 'map':
      return { control: 'open', target: 'map' };
    case 'alchemy':
      return { control: 'open', target: 'alchemy' };
    case 'journey':
      return { control: 'open', target: 'journey' };
    case 'pause':
      return { control: 'open', target: 'pause' };
    case 'settings':
      return { control: 'open', target: 'settings' };
    case 'end-day':
      return { control: 'end-day' };
    default:
      return null;
  }
}

function pointerButton(event: Event): number | null {
  const value = (event as Event & { readonly button?: unknown }).button;
  return typeof value === 'number' ? value : null;
}

function clickDetail(event: Event): number {
  const value = (event as Event & { readonly detail?: unknown }).detail;
  return typeof value === 'number' ? value : 0;
}

function setTextIfChanged(element: ResponsiveShellElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

export function createResponsiveShell(options: ResponsiveShellOptions): ResponsiveShellController {
  const root = options.root === undefined ? defaultRoot() : options.root;
  const bindings: ListenerBinding[] = [];
  const pointerDispatched = new WeakSet<object>();
  let destroyed = false;

  const semanticElements = {
    instructions: root?.querySelector(SEMANTIC_SELECTORS.instructions) ?? null,
    surface: root?.querySelector(SEMANTIC_SELECTORS.surface) ?? null,
    status: root?.querySelector(SEMANTIC_SELECTORS.status) ?? null,
    objective: root?.querySelector(SEMANTIC_SELECTORS.objective) ?? null,
    actions: root?.querySelector(SEMANTIC_SELECTORS.actions) ?? null,
    panel: root?.querySelector(SEMANTIC_SELECTORS.panel) ?? null,
    announcement: root?.querySelector(SEMANTIC_SELECTORS.announcement) ?? null
  };

  const dispatchTouchInput = (input: TouchInput | null): void => {
    if (destroyed || !input) return;
    const command = gameCommandFromTouch(input);
    if (command) options.dispatch(command);
  };

  for (const button of Array.from(root?.querySelectorAll('button[data-game-command]') ?? [])) {
    const input = touchInputFor(button.getAttribute('data-game-command'));
    const onPointerDown: EventListener = event => {
      if (!input || (pointerButton(event) ?? 0) !== 0) return;
      pointerDispatched.add(button);
      event.preventDefault();
      dispatchTouchInput(input);
    };
    const onClick: EventListener = event => {
      if (!input) return;
      event.preventDefault();
      const followedPointer = pointerDispatched.delete(button);
      if (followedPointer && clickDetail(event) > 0) return;
      dispatchTouchInput(input);
    };

    button.addEventListener('pointerdown', onPointerDown);
    button.addEventListener('click', onClick);
    bindings.push({ element: button, type: 'pointerdown', listener: onPointerDown }, { element: button, type: 'click', listener: onClick });
  }

  return {
    updateSemanticState(state: SemanticGameState): void {
      if (destroyed) return;
      if (state.instructions !== undefined) setTextIfChanged(semanticElements.instructions, state.instructions);
      if (state.surface !== undefined) setTextIfChanged(semanticElements.surface, state.surface);
      setTextIfChanged(semanticElements.status, state.status);
      setTextIfChanged(semanticElements.objective, state.objective);
      setTextIfChanged(semanticElements.actions, state.actions);
      setTextIfChanged(semanticElements.panel, state.panel);
      setTextIfChanged(semanticElements.announcement, state.announcement);
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const binding of bindings) binding.element.removeEventListener(binding.type, binding.listener);
      bindings.length = 0;
    }
  };
}
