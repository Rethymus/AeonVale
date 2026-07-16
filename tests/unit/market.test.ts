import { describe, expect, it } from 'vitest';
import { createSimContext, createWorld, DEFAULT_BALANCE, getMarketDemands, marketDemandForItem, type GameState, type SimContext } from '@sim';
import { buildRegistry } from '@content/registry';

function setup(stage = 0, seed = 17): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 state.player.stage = stage as GameState['player']['stage'];
 return { state, ctx };
}

describe('市场需求溢价', () => {
 it('根据当日委托与特别订单生成确定性的需求列表', () => {
 const { state } = setup(1);

expect(getMarketDemands(state)).toEqual([
 expect.objectContaining({ itemId: 'herb.dewroot', source: 'commission' }),
 expect.objectContaining({ itemId: 'herb.mossling', source: 'special-order' }),
 ]);
 });

it('可查询单个物品的当日需求', () => {
 const { state } = setup(1);

expect(marketDemandForItem(state, 'herb.dewroot')).toMatchObject({ itemId: 'herb.dewroot', source: 'commission' });
 expect(marketDemandForItem(state, 'item.array-core')).toBeNull;
 });
});

