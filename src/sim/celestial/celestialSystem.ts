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
import { stageQiCap } from '@sim/progression/progression';

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
  const pool = defs.filter((d) => !d.forced); // 强制(forced)事件不走随机抽样（docs/15 §4）
  const weighted = pool
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

/**
 * 在四阶修为达到上限时启动一次紫雷前兆；可中断普通天象，但不会重启已存在的前兆。
 * 返回本次是否启动，供即时引劫入口阻止绕过七日预警。
 */
export function startPurpleOmenIfDue(state: GameState, ctx: SimContext): boolean {
  if (state.flags.has('purple-omen-fired') || state.player.stage !== 4 || state.player.cultivation < stageQiCap(4, ctx.params)) {
    return false;
  }

  const def = ctx.content.events.get('event.purple-omen');
  if (!def || state.activeEvent?.defId === def.id) return false;

  if (state.activeEvent) emit(state, 'celestial-end', { defId: state.activeEvent.defId });
  state.activeEvent = {
    defId: def.id,
    displayName: def.displayName,
    daysLeft: def.durationDays,
    growthMod: def.growthMod,
    qiMod: def.qiMod,
  };
  state.flags.add('purple-omen-fired');
  emit(state, 'celestial-start', { defId: def.id, displayName: def.displayName, type: def.type });
  return true;
}

/** 推进天象状态（到期/触发），返回当日调制倍率。 */
export function tickCelestial(state: GameState, ctx: SimContext): CelestialMods {
  // 1. 到期。紫雷前兆结束当天不立刻抽取普通天象。
  let purpleOmenExpired = false;
  if (state.activeEvent) {
    state.activeEvent.daysLeft -= 1;
    if (state.activeEvent.daysLeft <= 0) {
      purpleOmenExpired = state.activeEvent.defId === 'event.purple-omen';
      emit(state, 'celestial-end', { defId: state.activeEvent.defId });
      state.activeEvent = null;
    }
  }
  // 1b. 强制天象：stage4 修为满 → 紫雷前兆（仅触发一次，解锁终局线，docs/15 §4）
  startPurpleOmenIfDue(state, ctx);
  // 2. 无激活时按门概率抽样触发（docs/14 §7 eventGateProbability）
  if (!purpleOmenExpired && !state.activeEvent && ctx.rng.celestial.chance(ctx.params.celestial.eventGateProbability)) {
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
