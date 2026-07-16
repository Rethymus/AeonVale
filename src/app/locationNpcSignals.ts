import { getActiveLocationDirectory, getCurrentNpcQuest, getLocationEncounters, type GameState } from '@sim';
import type { LocationEncounter, LocationStatus } from '@sim/world/locations';

export interface LocationNpcSignals {
  birthdayNames: string[];
  questNames: string[];
  questReadyNames: string[];
}

export interface PriorityLocationNpcSignal {
  location: LocationStatus;
  signals: LocationNpcSignals;
}

export function collectLocationNpcSignals(state: GameState, encounters: readonly LocationEncounter[]): LocationNpcSignals {
  return {
    birthdayNames: encounters.filter(entry => entry.birthday).map(entry => entry.npcName),
    questNames: encounters.filter(entry => Boolean(getCurrentNpcQuest(state, entry.npcId))).map(entry => entry.npcName),
    questReadyNames: encounters.filter(entry => Boolean(getCurrentNpcQuest(state, entry.npcId)?.completed)).map(entry => entry.npcName)
  };
}

function signalPriority(signals: LocationNpcSignals): number {
  if (signals.questReadyNames.length > 0) return 3;
  if (signals.questNames.length > 0) return 2;
  if (signals.birthdayNames.length > 0) return 1;
  return 0;
}

function signalStrength(signals: LocationNpcSignals): number {
  if (signals.questReadyNames.length > 0) return signals.questReadyNames.length;
  if (signals.questNames.length > 0) return signals.questNames.length;
  if (signals.birthdayNames.length > 0) return signals.birthdayNames.length;
  return 0;
}

export function formatLocationNpcSignalLine(signals?: LocationNpcSignals, prefix = '动向'): string {
  if (!signals) return `${prefix}：今日以常规来往为主`;
  if (signals.questReadyNames.length > 0) return `${prefix}：${signals.questReadyNames.join('、')} 的人物差事可领取`;
  if (signals.questNames.length > 0) return `${prefix}：${signals.questNames.join('、')} 这里有可推进的人物差事`;
  if (signals.birthdayNames.length > 0) return `${prefix}：${signals.birthdayNames.join('、')} 今日生辰，带礼更值`;
  return `${prefix}：今日以常规来往为主`;
}

export function firstPriorityLocationNpcSignal(state: GameState): PriorityLocationNpcSignal | null {
  let best: PriorityLocationNpcSignal | null = null;
  let bestPriority = 0;
  let bestStrength = 0;

  for (const location of getActiveLocationDirectory(state)) {
    const signals = collectLocationNpcSignals(state, getLocationEncounters(state, location.id));
    const priority = signalPriority(signals);
    if (priority <= 0) continue;

    const strength = signalStrength(signals);
    if (priority < bestPriority) continue;
    if (priority === bestPriority && strength < bestStrength) continue;
    if (priority === bestPriority && strength === bestStrength && best && location.displayName.localeCompare(best.location.displayName, 'zh-CN') >= 0) {
      continue;
    }

    best = { location, signals };
    bestPriority = priority;
    bestStrength = strength;
  }

  return best;
}
