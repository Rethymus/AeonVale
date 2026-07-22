import type { AppFlowState, AppScreen } from './appFlowMachine';

export const UI_MODES = ['loading', 'boot-error', 'title', 'prologue', 'world', 'dialogue', 'panel', 'location', 'pause', 'tribulation', 'aftermath', 'ending', 'narration', 'roguelite-proto', 'portrait-blocked'] as const;

export type UiMode = (typeof UI_MODES)[number];

export interface UiModeInput {
  flow: AppFlowState;
  portraitBlocked?: boolean;
  dialogueActive?: boolean;
  panelActive?: boolean;
  locationActive?: boolean;
}

export type UiLayerVisibility = Record<UiMode, boolean>;

function modeForScreen(screen: Exclude<AppScreen, 'world' | 'ending'>): UiMode {
  switch (screen) {
    case 'boot':
      return 'loading';
    case 'boot-error':
      return 'boot-error';
    case 'title':
      return 'title';
    case 'prologue':
      return 'prologue';
    case 'tribulation':
      return 'tribulation';
    case 'aftermath':
      return 'aftermath';
    case 'narration':
      return 'narration';
    case 'roguelite-proto':
      return 'roguelite-proto';
  }
}

/** Derives the one main attention mode that may be visible for this frame. */
export function deriveUiMode(input: UiModeInput): UiMode {
  if (input.portraitBlocked) return 'portrait-blocked';
  if (input.flow.screen === 'ending') return 'ending';
  if (input.flow.overlay === 'pause') return 'pause';

  if (input.flow.screen !== 'world') {
    if (input.flow.overlay === 'map') return 'location';
    if (input.flow.overlay != null) return 'panel';
    return modeForScreen(input.flow.screen);
  }

  if (input.flow.overlay === 'map') return 'location';
  if (input.flow.overlay != null) return 'panel';
  if (input.dialogueActive) return 'dialogue';
  if (input.panelActive) return 'panel';
  if (input.locationActive) return 'location';
  return 'world';
}

export function visibleUiLayers(mode: UiMode): UiLayerVisibility {
  return Object.fromEntries(UI_MODES.map(candidate => [candidate, candidate === mode])) as UiLayerVisibility;
}
