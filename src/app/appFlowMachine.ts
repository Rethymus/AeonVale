export type AppScreen = 'boot' | 'boot-error' | 'title' | 'narration' | 'roguelite-proto';

export type AppOverlay = 'settings' | 'codex';

export type AppFocusSelector = `#${string}`;

export const APP_FLOW_FOCUS_TARGETS = {
  loading: '#game-loading',
  bootError: '#flow-boot-error-reload',
  titleNewGame: '#flow-title-new-game',
  titleNarration: '#flow-title-narration',
  narration: '#narration-stage',
  rogueliteProto: '#roguelite-proto-root',
  settings: '#flow-settings-close',
  codex: '#flow-codex-close',
  orientation: '#orientation-heading'
} as const satisfies Record<string, AppFocusSelector>;

export interface AppFlowFocus {
  /** Focus target when this state becomes the active presentation. */
  initial: AppFocusSelector;
  /** Focus target to restore after the active overlay closes. */
  restore: AppFocusSelector | null;
}

export interface AppFlowState {
  screen: AppScreen;
  overlay: AppOverlay | null;
  focus: AppFlowFocus;
}

export type AppFlowEvent = { type: 'boot-ready' } | { type: 'boot-error' } | { type: 'continue-game' } | { type: 'start-narration' } | { type: 'return-title-from-narration' } | { type: 'start-roguelite-proto' } | { type: 'return-title-from-roguelite-proto' } | { type: 'open-overlay'; overlay: AppOverlay; returnFocus?: AppFocusSelector } | { type: 'close-overlay' };

export function createAppFlowState(): AppFlowState {
  return moveTo('boot');
}

function moveTo(screen: AppScreen): AppFlowState {
  return {
    screen,
    overlay: null,
    focus: { initial: appFocusTargetFor(screen, null), restore: null }
  };
}

export function appFocusTargetFor(screen: AppScreen, overlay: AppOverlay | null): AppFocusSelector {
  if (overlay) return APP_FLOW_FOCUS_TARGETS[overlay];

  switch (screen) {
    case 'boot':
      return APP_FLOW_FOCUS_TARGETS.loading;
    case 'boot-error':
      return APP_FLOW_FOCUS_TARGETS.bootError;
    case 'title':
      return APP_FLOW_FOCUS_TARGETS.titleNewGame;
    case 'narration':
      return APP_FLOW_FOCUS_TARGETS.narration;
    case 'roguelite-proto':
      return APP_FLOW_FOCUS_TARGETS.rogueliteProto;
  }
}

function validReturnFocusSelector(selector: AppFocusSelector | undefined): boolean {
  return selector === undefined || /^#[A-Za-z][A-Za-z0-9_-]*$/.test(selector);
}

function canOpenOverlay(screen: AppScreen, overlay: AppOverlay): boolean {
  if (screen === 'title') return overlay === 'settings';
  // 灵韵叙录内可开「叙录」图鉴覆盖层（docs/22 §11）。
  if (screen === 'narration') return overlay === 'codex';
  return false;
}

/**
 * Pure application-flow reducer. Invalid or conflicting transitions preserve
 * the original object so callers can reliably distinguish a rejected event.
 */
export function transitionAppFlow(state: AppFlowState, event: AppFlowEvent): AppFlowState {
  if (event.type === 'close-overlay') {
    if (state.overlay == null) return state;
    return {
      screen: state.screen,
      overlay: null,
      focus: {
        initial: state.focus.restore ?? appFocusTargetFor(state.screen, null),
        restore: null
      }
    };
  }

  if (event.type === 'open-overlay') {
    if (state.overlay != null || !canOpenOverlay(state.screen, event.overlay) || !validReturnFocusSelector(event.returnFocus)) return state;
    return {
      screen: state.screen,
      overlay: event.overlay,
      focus: {
        initial: appFocusTargetFor(state.screen, event.overlay),
        restore: event.returnFocus ?? state.focus.initial
      }
    };
  }

  if (state.overlay != null) return state;

  switch (event.type) {
    case 'boot-ready':
      return state.screen === 'boot' ? moveTo('title') : state;
    case 'boot-error':
      return state.screen === 'boot' ? moveTo('boot-error') : state;
    case 'continue-game':
      return state.screen === 'title' ? moveTo('roguelite-proto') : state;
    case 'start-narration':
      return state.screen === 'title' ? moveTo('narration') : state;
    case 'return-title-from-narration':
      return state.screen === 'narration' ? moveTo('title') : state;
    case 'start-roguelite-proto':
      return state.screen === 'title' ? moveTo('roguelite-proto') : state;
    case 'return-title-from-roguelite-proto':
      return state.screen === 'roguelite-proto' ? moveTo('title') : state;
  }
}
