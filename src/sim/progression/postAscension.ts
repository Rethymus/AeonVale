import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { createDefaultPostAscensionState } from '@sim/world/state';
import { clearTribulationCountdown } from './bodyCultivation';
import { startStayingWorld } from './stayingWorld';

export type AscensionChoice = 'ascend-away' | 'stay-in-world';

export function triggerAscensionChoice(state: GameState): boolean {
  if (state.gameOver) return false;
  state.postAscension ??= createDefaultPostAscensionState();
  if (state.postAscension.mode !== 'none') return false;
  state.postAscension.mode = 'choice-pending';
  state.postAscension.ascensionDay = state.day;
  emit(state, 'ascension-choice-available', { day: state.day });
  return true;
}

export function resolveAscensionChoice(state: GameState, choice: AscensionChoice): boolean {
  if (state.postAscension.mode !== 'choice-pending') return false;

  if (choice === 'ascend-away') {
    state.postAscension.mode = 'ascended-away';
    state.postAscension.victoryRecorded = true;
    state.ending = 'ascension';
    state.gameOver = true;
    emit(state, 'ending', { ending: 'ascension' });
    return true;
  }

  state.postAscension.mode = 'stayed-in-world';
  state.postAscension.victoryRecorded = true;
  clearTribulationCountdown(state);
  startStayingWorld(state);
  emit(state, 'ascension-choice-resolved', { choice });
  emit(state, 'post-ascension-stay-started', { day: state.day });
  return true;
}
