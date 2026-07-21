import type { GameState } from '@sim';
import { computePrepScore } from '@sim/progression/progression';

function carriedItemCount(state: GameState, itemId: string): number {
  return state.player.inventory[itemId]?.count ?? 0;
}

export function hasWardPillReady(state: GameState): boolean {
  return state.player.wardMitigation > 0 || carriedItemCount(state, 'pill.ward-basic') > 0 || carriedItemCount(state, 'pill.ward-greater') > 0 || carriedItemCount(state, 'pill.ward-heaven') > 0;
}

export function activeTribulationArrayCount(state: GameState): number {
  return [...state.arrays.values()].filter(array => array.active).length;
}

export function tribulationPrepStatusLine(state: GameState): string {
  const activeArrays = activeTribulationArrayCount(state);
  const pillReady = hasWardPillReady(state);
  const arrayReady = activeArrays >= 2;
  const prepPercent = Math.round(computePrepScore(state) * 100);
  const pillStatus = pillReady ? '丹药已备' : '缺承雷丹';
  const arrayStatus = arrayReady ? `阵法已成(${activeArrays}/2)` : `阵法未成(${activeArrays}/2)`;

  if (pillReady && arrayReady) {
    return `备劫：${pillStatus}｜${arrayStatus}｜准备度${prepPercent}%｜可引劫，仍可先服丹确认。`;
  }
  if (pillReady) {
    return `备劫：${pillStatus}｜${arrayStatus}｜准备度${prepPercent}%｜先补引雷/绝缘阵再引劫。`;
  }
  if (arrayReady) {
    return `备劫：${pillStatus}｜${arrayStatus}｜准备度${prepPercent}%｜先炼或服承雷丹再引劫。`;
  }
  return `备劫：${pillStatus}｜${arrayStatus}｜准备度${prepPercent}%｜先补承雷丹与两座阵法。`;
}

export function tribulationPrepFocusReason(state: GameState): string {
  const status = tribulationPrepStatusLine(state).replace(/^备劫：/, '');
  return `体魄已至极限，${status}`;
}
