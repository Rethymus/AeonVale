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

function setTextIfChanged(element: ResponsiveShellElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

export function createResponsiveShell(options: ResponsiveShellOptions = {}): ResponsiveShellController {
  const root = options.root === undefined ? defaultRoot() : options.root;
  const bindings: ListenerBinding[] = [];
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
