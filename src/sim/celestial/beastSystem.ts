/**
 * 妖兽潮系统（docs/07 §3.1 天骄降世 climax / docs/18 M4 退出标准）。
 *
 * 因果链：灵气潮汐（event.qi-tide）活跃 → 灵草生长×1.5 疯长成熟 → 引来妖兽群抢食。
 * 这是 M4「天象奇遇引擎」的核心交付：事件不是一次性 buff，而是触发可复现的连锁后果。
 *
 * 行为：
 * - 触发：qi-tide 活跃 + 存在成熟作物 + 无活跃妖兽潮 + rng.beast 命中 surgeChancePerDay。
 *   生成 beastsRemaining ∈ [countMin, countMaxBase+stage]，持续 surgeDurationDays 日。
 * - 啃食：妖兽群停留至到时，每日啃食 min(妖兽数, 成熟作物) 株（摧毁作物 + 清空地块）。
 *   妖兽数在潮期间恒定（不因吃饱而离去），使 surgeDurationDays 成为有意义的威胁旋钮。
 * - 退去：surgeDurationDays 到时（即便仍有作物）或某日无食可吃（妖兽不空守空田）。
 *   被动退去无内丹；内丹仅由玩家主动猎妖获得（docs/07 §3.4.3）。
 *
 * 确定性（C3）：触发与计数均走 ctx.rng.beast 流；无 Math.random / 无 IO / 无渲染。
 */
import type { GameState, BeastSurge } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';

/** 妖兽潮触发的因果前提：仅灵气潮汐活跃时才可能引兽。 */
export function qiTideActive(state: GameState): boolean {
  return state.activeEvent?.defId === 'event.qi-tide';
}

/** 当前田间的成熟作物（tileId, crop）列表，按 tileId 升序保证确定性啃食顺序。 */
function matureCrops(state: GameState): Array<{ tileId: number; defId: string }> {
  const out: Array<{ tileId: number; defId: string }> = [];
  for (const [tileId, crop] of state.crops) {
    if (crop.stage === 'mature') out.push({ tileId, defId: crop.defId });
  }
  out.sort((a, b) => a.tileId - b.tileId);
  return out;
}

/**
 * 推进妖兽潮：若活跃则啃食成熟作物并结算退去；否则按因果链尝试触发。
 * 在 resolveDayEnd 中于 applyFarmDayEnd 之后调用（保证当日新成熟的作物可被啃食）。
 */
export function tickBeasts(state: GameState, ctx: SimContext): BeastSurge | null {
  const bs = state.beastSurge;
  if (bs) {
    // ── 啃食阶段：妖兽群每日啃食 min(妖兽数, 成熟作物) 株，停留至到时或无食 ──
    const prey = matureCrops(state);
    const eaten = Math.min(bs.beastsRemaining, prey.length);
    for (let i = 0; i < eaten; i++) {
      const { tileId, defId } = prey[i]!;
      const tile = state.tiles[tileId];
      if (tile) tile.cropId = null;
      state.crops.delete(tileId);
      emit(state, 'beast-eat-crop', { defId, tileId });
    }
    bs.daysLeft -= 1;
    // 退去：到时（daysLeft≤0）或今日无食可吃（妖兽不空守空田）。被动退去不授予猎妖战利品。
    if (bs.daysLeft <= 0 || prey.length === 0) {
      emit(state, 'beast-surge-end', { beastsRemaining: bs.beastsRemaining });
      state.beastSurge = null;
    }
    return state.beastSurge;
  }

  // ── 触发阶段：灵气潮汐 + 成熟作物 + 概率 ──
  if (!qiTideActive(state)) return null;
  if (matureCrops(state).length === 0) return null;
  const p = ctx.params.celestial.beast;
  if (!ctx.rng.beast.chance(p.surgeChancePerDay)) return null;

  const countMax = p.countMaxBase + state.player.stage;
  const count = ctx.rng.beast.intRange(p.countMin, countMax + 1); // [countMin, countMax]
  state.beastSurge = { beastsRemaining: count, daysLeft: p.surgeDurationDays };
  emit(state, 'beast-surge-start', { count, durationDays: p.surgeDurationDays });
  return state.beastSurge;
}
