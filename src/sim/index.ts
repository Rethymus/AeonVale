/**
 * sim 层公共入口：simulateDay（日级推进）/ advanceDay（仅日终）/ applyAction（即时动作）+ 再导出。
 *
 * 渲染层/app 用 applyAction 即时响应玩家按键、用 advanceDay 在"结束当日"时推进；
 * 无头/bot 用 simulateDay 一次推进一整日。纯函数（除对 state 的确定性变更 + 注入 rng）。
 */
import type { GameState } from './world/state';
import { clearEvents, emit } from './world/state';
import type { DayInput, PlayerAction } from './world/input';
import type { SimContext } from './world/context';
import { applyAction as applyActionImpl } from './farm/actions';
import { applyFarmDayEnd, growthPerDay, qiFactor, soilFactor, seasonFactor, herbQiDemand } from './farm/farmSystem';
import { tickCelestial } from './celestial/celestialSystem';
import { tickBeasts } from './celestial/beastSystem';
import { deriveStreams, type RngStreams } from './world/rng';
import { DEFAULT_BALANCE, type BalanceParams } from './params';
import { MILLI } from './world/types';
import type { ContentRegistry } from '@content/defs';

/** 构造模拟上下文（注入 RNG/参数/内容）。同 seed ⇒ 同 RNG 流 ⇒ 确定性。 */
export function createSimContext(
  seed: number | string,
  content: ContentRegistry,
  params: BalanceParams = DEFAULT_BALANCE,
): SimContext {
  return { rng: deriveStreams(seed), params, content };
}

/** 从已有 state 的 masterSeed 重建 ctx（读档后继续，RNG 从快照恢复）。 */
export function createSimContextFromState(
  state: GameState,
  content: ContentRegistry,
  params: BalanceParams = DEFAULT_BALANCE,
): SimContext {
  const rng = deriveStreams(state.masterSeed);
  const rs = state.rngSnapshot;
  rng.world.restore(rs.world ?? 0);
  rng.growth.restore(rs.growth ?? 0);
  rng.lightning.restore(rs.lightning ?? 0);
  rng.alchemy.restore(rs.alchemy ?? 0);
  rng.celestial.restore(rs.celestial ?? 0);
  rng.beast.restore(rs.beast ?? 0);
  rng.drop.restore(rs.drop ?? 0);
  return { rng, params, content };
}

/** 把 RNG 流快照存回 state（便于中途存档/回放）。 */
function snapshotRng(state: GameState, ctx: SimContext): void {
  for (const k of Object.keys(ctx.rng) as (keyof RngStreams)[]) {
    if (k === 'master') continue;
    const stream = ctx.rng[k];
    if (stream && typeof stream === 'object' && 'snapshot' in stream) {
      state.rngSnapshot[k] = (stream as unknown as { snapshot(): number }).snapshot();
    }
  }
}

/** 日终结算：天象推进 + 农场结算（生长/灵气/土壤）+ 妖兽潮因果链。天象调制当日 growth/qi。 */
function resolveDayEnd(state: GameState, ctx: SimContext): void {
  const mods = tickCelestial(state, ctx);
  applyFarmDayEnd(state, ctx, mods.growthMod, mods.qiMod);
  tickBeasts(state, ctx); // 灵气潮汐→灵草成熟→引来妖兽啃食（docs/07 §3.1 / M4 因果链）
}

/** 即时应用一个玩家动作（渲染层按键响应用）。不清事件、不推进日。 */
export function applyAction(state: GameState, action: PlayerAction, ctx: SimContext): void {
  applyActionImpl(state, action, ctx);
  checkGameEnd(state, ctx);
}

/** 死亡检查：HP≤0 → 陨于天劫；丹毒满 → 暴毙。达成则置 gameOver（docs/02 失败态）。 */
export function checkGameEnd(state: GameState, ctx: SimContext): void {
  if (state.gameOver) return;
  const cap = ctx.params.pillPoison.cap * 1000;
  if (state.player.hp <= 0) {
    state.ending = 'tribulation-death';
    state.gameOver = true;
    emit(state, 'ending', { ending: 'tribulation-death' });
  } else if (state.player.pillPoison >= cap) {
    state.ending = 'poison-death';
    state.gameOver = true;
    emit(state, 'ending', { ending: 'poison-death' });
  }
}

/**
 * 结束当日（app 的"过夜"）：日终结算 + 次日清晨体力恢复 + RNG 快照。
 * 渲染层在白昼用 applyAction 即时操作，按"过夜"键调用本函数推进。
 */
export function advanceDay(state: GameState, ctx: SimContext): void {
  resolveDayEnd(state, ctx);
  state.player.stamina = ctx.params.player.staminaCap * MILLI; // 次日清晨
  checkGameEnd(state, ctx);
  snapshotRng(state, ctx);
}

/** 无头/bot：一次推进一整日（清晨恢复 → 动作 → 日终结算），返回当日事件。 */
export function simulateDay(state: GameState, input: DayInput, ctx: SimContext): GameState['events'] {
  clearEvents(state);
  state.player.stamina = ctx.params.player.staminaCap * MILLI; // 当日清晨
  for (const a of input.actions) applyActionImpl(state, a, ctx);
  resolveDayEnd(state, ctx);
  snapshotRng(state, ctx);
  return state.events;
}

// —— 公共再导出 ——
export * from './world/state';
export { Rng, deriveStreams, hashStr } from './world/rng';
export type { RngStreams, RngState } from './world/rng';
export * from './world/types';
export type { PlayerAction, DayInput } from './world/input';
export type { SimContext } from './world/context';
export { applyFarmDayEnd, growthPerDay, qiFactor, soilFactor, seasonFactor, herbQiDemand, careFactor } from './farm/farmSystem';
export { applyPill } from './alchemy/pillSystem';
export { brewPills, resolveBrew } from './alchemy/alchemySystem';
export { placeArray, arrayModifierFor } from './tribulation/arrays';
export { tickBeasts, qiTideActive } from './celestial/beastSystem';
export { DEFAULT_BALANCE } from './params';
export type { BalanceParams } from './params';
export type { GameState } from './world/state';
