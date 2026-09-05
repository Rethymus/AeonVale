export type AppScreen = 'boot' | 'boot-error' | 'title' | 'prologue' | 'world' | 'tribulation' | 'aftermath' | 'ending' | 'narration' | 'roguelite-proto';

export type AppOverlay = 'inventory' | 'cultivation' | 'map' | 'pause' | 'settings' | 'codex';

export type AppFocusSelector = `#${string}`;

export const APP_FLOW_FOCUS_TARGETS = {
  loading: '#game-loading',
  bootError: '#flow-boot-error-reload',
  titleNewGame: '#flow-title-new-game',
  titleContinue: '#flow-title-continue',
  titleSettings: '#flow-title-settings',
  titleNarration: '#flow-title-narration',
  prologue: '#prologue-vn-stage',
  narration: '#narration-stage',
  rogueliteProto: '#roguelite-proto-root',
  world: '#game-canvas',
  tribulation: '#flow-tribulation-primary',
  aftermath: '#flow-aftermath-continue',
  ending: '#flow-ending-return',
  inventory: '#flow-inventory-close',
  cultivation: '#flow-cultivation-close',
  map: '#flow-map-close',
  pause: '#flow-pause-resume',
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

export type AppFlowEvent = { type: 'boot-ready' } | { type: 'boot-error' } | { type: 'start-new-game' } | { type: 'continue-game' } | { type: 'finish-prologue' } | { type: 'skip-prologue' } | { type: 'enter-loaded-world' } | { type: 'start-tribulation' } | { type: 'finish-tribulation' } | { type: 'continue-aftermath' } | { type: 'show-ending' } | { type: 'return-title' } | { type: 'start-narration' } | { type: 'return-title-from-narration' } | { type: 'start-roguelite-proto' } | { type: 'return-title-from-roguelite-proto' } | { type: 'open-overlay'; overlay: AppOverlay; returnFocus?: AppFocusSelector } | { type: 'close-overlay' };

const WORLD_OVERLAYS: readonly AppOverlay[] = ['inventory', 'cultivation', 'map', 'pause', 'settings'];
const GAMEPLAY_OVERLAYS: readonly AppOverlay[] = ['pause', 'settings'];

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
    case 'prologue':
      return APP_FLOW_FOCUS_TARGETS.prologue;
    case 'world':
      return APP_FLOW_FOCUS_TARGETS.world;
    case 'tribulation':
      return APP_FLOW_FOCUS_TARGETS.tribulation;
    case 'aftermath':
      return APP_FLOW_FOCUS_TARGETS.aftermath;
    case 'ending':
      return APP_FLOW_FOCUS_TARGETS.ending;
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
  if (screen === 'world') return WORLD_OVERLAYS.includes(overlay);
  if (screen === 'prologue' || screen === 'tribulation' || screen === 'aftermath') {
    return GAMEPLAY_OVERLAYS.includes(overlay);
  }
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
    case 'start-new-game':
      return state.screen === 'title' ? moveTo('prologue') : state;
    case 'continue-game':
      return state.screen === 'title' ? moveTo('roguelite-proto') : state;
    case 'finish-prologue':
    case 'skip-prologue':
      return state.screen === 'prologue' ? moveTo('world') : state;
    case 'enter-loaded-world':
      // 测试门专用：boot 已加载存档时跳过序章直接入世界（不触发 start-new-game 的清档）。
      return state.screen === 'title' ? moveTo('world') : state;
    case 'start-tribulation':
      return state.screen === 'world' ? moveTo('tribulation') : state;
    case 'finish-tribulation':
      return state.screen === 'tribulation' ? moveTo('aftermath') : state;
    case 'continue-aftermath':
      return state.screen === 'aftermath' ? moveTo('world') : state;
    case 'show-ending':
      return state.screen === 'world' || state.screen === 'tribulation' || state.screen === 'aftermath' ? moveTo('ending') : state;
    case 'return-title':
      return state.screen === 'ending' ? moveTo('title') : state;
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
