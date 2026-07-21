import { describe, expect, it } from 'vitest';
import { advanceDay, applyAction, applyMvpStarterKit, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_SECOND_WATER_FLAG, getOnboardingObjectiveId, getPublicDemoObjectiveId, tileAt } from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount } from '@sim/world/player';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  applyMvpStarterKit(state, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('首轮农务引导', () => {
  it('飞升选择与留世阶段不再被首轮农务目标锁住', () => {
    const { state } = setup();

    state.postAscension.mode = 'choice-pending';
    expect(getOnboardingObjectiveId(state)).toBeNull();

    state.postAscension.mode = 'stayed-in-world';
    expect(getOnboardingObjectiveId(state)).toBeNull();
  });

  it('按翻地 -> 播种 -> 浇水 -> 收获的 MVP 路径推进', () => {
    const { state, ctx } = setup();

    expect(getOnboardingObjectiveId(state)).toBe('first-till');

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-sow');

    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' }, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-water');

    applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-harvest');
  });

  it('成熟前持续保持收获导向，收获后继续引导到出货与过夜结算', () => {
    const { state, ctx } = setup();

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' }, ctx);
    applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);

    for (let day = 0; day < 12; day++) {
      advanceDay(state, ctx);
      if (getOnboardingObjectiveId(state) === 'first-harvest' && state.crops.get(tileAt(state, 1, 1)!.id)?.stage === 'mature') {
        break;
      }
      applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);
    }

    expect(state.crops.get(tileAt(state, 1, 1)!.id)?.stage).toBe('mature');
    expect(getOnboardingObjectiveId(state)).toBe('first-harvest');

    applyAction(state, { kind: 'harvest', at: { x: 1, y: 1 } }, ctx);
    expect(itemCount(state.player, 'herb.mossling')).toBeGreaterThan(0);
    expect(getOnboardingObjectiveId(state)).toBe('first-ship');

    applyAction(state, { kind: 'ship-item', itemId: 'herb.mossling', count: 1 }, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-sleep');

    advanceDay(state, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-market-restock');

    applyAction(state, { kind: 'buy-shop-item', itemId: 'seed.mossling', count: 1 }, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-second-sow');

    applyAction(state, { kind: 'till', at: { x: 2, y: 1 } }, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-second-sow');

    applyAction(state, { kind: 'sow', at: { x: 2, y: 1 }, seedId: 'seed.mossling' }, ctx);
    expect(getOnboardingObjectiveId(state)).toBe('first-second-water');

    applyAction(state, { kind: 'water', at: { x: 2, y: 1 } }, ctx);
    expect(state.tiles.find(tile => tile.x === 2 && tile.y === 1)?.wateredToday).toBe(true);
    expect(state.player.flags.has(FIRST_SECOND_WATER_FLAG)).toBe(true);
    expect(getOnboardingObjectiveId(state)).toBe('first-loop-complete');
  });
});

describe('序章门禁：修仙主循环不前移到 stage 0（R3-A 红线）', () => {
  // 守护 docs/02:88 序章设定与 docs/09 §1.1 stage 0→1 解锁：
  // 教学炼丹/天劫的放行门槛必须留在 FIRST_HARVEST_FLAG（onboarding.ts:58），
  // 不得为了让首日"更像修仙游戏"而把 stage 1 内容塞进凡骨序章。
  it('首收前公开试玩目标停留在农务内层，不提前放行炼丹/天劫', () => {
    const { state, ctx } = setup();
    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' }, ctx);
    applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);

    const objective = getPublicDemoObjectiveId(state);
    expect(objective).not.toBe('journey-alchemy');
    expect(objective).not.toBe('journey-tribulation');
    expect(objective).not.toBe('journey-aftermath');
    // 仍未首收 → 停在内层农务引导（first-*）或 null，绝不进入 journey-* 四幕
    expect(objective === null || (objective as string).startsWith('first-')).toBe(true);
  });

  it('首收后才放行到 journey-alchemy（教学炼丹门禁仍是 FIRST_HARVEST）', () => {
    const { state, ctx } = setup();
    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' }, ctx);
    applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);
    for (let day = 0; day < 12; day++) {
      advanceDay(state, ctx);
      if (state.crops.get(tileAt(state, 1, 1)!.id)?.stage === 'mature') break;
      applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);
    }
    applyAction(state, { kind: 'harvest', at: { x: 1, y: 1 } }, ctx);

    expect(getPublicDemoObjectiveId(state)).toBe('journey-alchemy');
  });
});
