/**
 * 天象奇遇引擎（docs/07 / docs/14 §7）。
 *
 * 底层权重算法周期触发"天象大事件"——凡人无法改大势，但大环境波动直接打击小农庄。
 * 每日：到期事件结束 → 无激活时按 eventGateProbability 抽样触发新事件 → 其 growthMod/qiMod 调制当日农场。
 * 确定性：所有抽样走 ctx.rng.celestial 流。
 */
import type { GameState, ActiveCelestialEvent } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { CelestialEventDef } from '@content/defs';
import type { Rng } from '@sim/world/rng';

const REPEAT_PENALTY = 0.4;

/**
 * 按天象基础权重抽样；近 3 次已触发的同类事件权重 ×0.4（docs/14 §7）。
 * 零权重事件永不入池；同 RNG 状态 + 同定义/历史 ⇒ 同结果。
 */
export function selectCelestialEvent(
  defs: readonly CelestialEventDef[],
  recentEventIds: readonly string[],
  rng: Rng,
): CelestialEventDef | null {
  const recentStart = Math.max(0, recentEventIds.length - 3);
  for (const def of defs) {
    if (!Number.isFinite(def.weight) || def.weight < 0) {
      throw new Error(`selectCelestialEvent: invalid weight for ${def.id}`);
    }
  }
  const weighted = defs
    .map((def) => {
      let isRecent = false;
      for (let i = recentStart; i < recentEventIds.length; i++) {
        if (recentEventIds[i] === def.id) { isRecent = true; break; }
      }
      return { item: def, weight: def.weight * (isRecent ? REPEAT_PENALTY : 1) };
    })
    .filter(({ weight }) => weight > 0);
  return weighted.length > 0 ? rng.weighted(weighted) : null;
}

export interface CelestialMods {
  growthMod: number;
  qiMod: number;
  active: ActiveCelestialEvent | null;
}

/** 推进天象状态（到期/触发），返回当日调制倍率。 */
export function tickCelestial(state: GameState, ctx: SimContext): CelestialMods {
  // 1. 到期
  if (state.activeEvent) {
    state.activeEvent.daysLeft -= 1;
    if (state.activeEvent.daysLeft <= 0) {
      emit(state, 'celestial-end', { defId: state.activeEvent.defId });
      state.activeEvent = null;
    }
  }
  // 2. 无激活时按门概率抽样触发（docs/14 §7 eventGateProbability）
  if (!state.activeEvent && ctx.rng.celestial.chance(ctx.params.celestial.eventGateProbability)) {
    const defs = [...ctx.content.events.values()];
    const pick = selectCelestialEvent(defs, state.recentCelestialEventIds, ctx.rng.celestial);
    if (pick) {
      state.activeEvent = {
        defId: pick.id,
        displayName: pick.displayName,
        daysLeft: pick.durationDays,
        growthMod: pick.growthMod,
        qiMod: pick.qiMod,
      };
      state.recentCelestialEventIds.push(pick.id);
      if (state.recentCelestialEventIds.length > 3) state.recentCelestialEventIds.shift();
      emit(state, 'celestial-start', { defId: pick.id, displayName: pick.displayName, type: pick.type });
    }
  }
  return {
    growthMod: state.activeEvent?.growthMod ?? 1,
    qiMod: state.activeEvent?.qiMod ?? 1,
    active: state.activeEvent,
  };
}
