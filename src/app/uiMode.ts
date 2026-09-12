import type { AppScreen } from './appFlowMachine';

export const UI_MODES = ['loading', 'boot-error', 'title', 'narration', 'roguelite-proto', 'portrait-blocked'] as const;

export type UiMode = (typeof UI_MODES)[number];

/** Derives the one main attention mode that may be visible for this frame. */
export function deriveUiMode(screen: AppScreen): UiMode {
  switch (screen) {
    case 'boot':
      return 'loading';
    case 'boot-error':
      return 'boot-error';
    case 'title':
      return 'title';
    case 'narration':
      return 'narration';
    case 'roguelite-proto':
      return 'roguelite-proto';
  }
}
