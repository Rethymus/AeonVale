/**
 * sim 层公共入口：simulateDay（日级种田推进）+ SimContext 构造 + 关键再导出。
 *
 * 一个 simulateDay = 一个游戏日：先按序执行玩家动作（翻地/播种/浇水/供灵/收获），
 * 再日终结算（生长/灵气/土壤/体力/丹毒/季节）。纯函数（除对 state 的确定性变更 + 注入 rng）。
 *
 * 天劫的实时 tick 推进（simulateTick）在 M2 引入；M1 以日为粒度（星露谷式）。
 */
import type { GameState } from './world/state';
import { clearEvents } from './world/state';
import type { DayInput } from './world/input';
import type { SimContext } from './world/context';
import { applyAction } from './farm/actions';
import { applyFarmDayEnd, growthPerDay, qiFactor, soilFactor, seasonFactor, herbQiDemand } from './farm/farmSystem';
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

/** 从已有 state 的 masterSeed 重建 ctx（用于读档后继续，RNG 从快照恢复）。 */
export function createSimContextFromState(
  state: GameState,
  content: ContentRegistry,
  params: BalanceParams = DEFAULT_BALANCE,
): SimContext {
  const rng = deriveStreams(state.masterSeed);
  const rs = state.rngSnapshot;
  // 从存档快照恢复各流推进位置（显式列举，避免索引类型体操）
  rng.world.restore(rs.world ?? 0);
  rng.growth.restore(rs.growth ?? 0);
  rng.lightning.restore(rs.lightning ?? 0);
  rng.alchemy.restore(rs.alchemy ?? 0);
  rng.celestial.restore(rs.celestial ?? 0);
  rng.beast.restore(rs.beast ?? 0);
  rng.drop.restore(rs.drop ?? 0);
  return { rng, params, content };
}

/**
 * 推进一个游戏日。返回当日产出的事件列表。
 * 这是种田核心推进；无头模拟每日调用一次。
 */
export function simulateDay(state: GameState, input: DayInput, ctx: SimContext): GameState['events'] {
  clearEvents(state);
  // 清晨：体力恢复（过夜语义，docs/08 §1.3）
  state.player.stamina = ctx.params.player.staminaCap * MILLI;
  for (const a of input.actions) applyAction(state, a, ctx);
  applyFarmDayEnd(state, ctx);
  // 把 RNG 流快照存回 state（便于中途存档）
  for (const k of Object.keys(ctx.rng) as (keyof RngStreams)[]) {
    if (k === 'master') continue;
    const stream = ctx.rng[k];
    if (stream && typeof stream === 'object' && 'snapshot' in stream) {
      state.rngSnapshot[k] = (stream as unknown as { snapshot(): number }).snapshot();
    }
  }
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
export { DEFAULT_BALANCE } from './params';
export type { BalanceParams } from './params';
export type { GameState } from './world/state';
