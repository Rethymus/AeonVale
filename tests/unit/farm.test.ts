import { describe, it, expect } from 'vitest';
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, tileAt } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('种田 sim (docs/08 / docs/14 §4)', () => {
  it('翻地 → 播种 → 浇水供灵 → 成熟 → 收获 闭环', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'seed.mossling', 5);

    simulateDay(state, { actions: [{ kind: 'till', at: { x: 1, y: 1 } }] }, ctx);
    let tile = tileAt(state, 1, 1);
    expect(tile?.tilled).toBe(true);

    simulateDay(
      state,
      {
        actions: [
          { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' },
          { kind: 'water', at: { x: 1, y: 1 } },
          { kind: 'channel-qi', at: { x: 1, y: 1 } },
        ],
      },
      ctx,
    );
    tile = tileAt(state, 1, 1);
    expect(tile?.cropId).not.toBe(null);
    expect(state.crops.size).toBe(1);

    // 推进至成熟
    let mature = false;
    for (let d = 0; d < 12; d++) {
      simulateDay(
        state,
        { actions: [{ kind: 'water', at: { x: 1, y: 1 } }, { kind: 'channel-qi', at: { x: 1, y: 1 } }] },
        ctx,
      );
      const crop = state.crops.get(tileAt(state, 1, 1)!.id);
      if (crop?.stage === 'mature') {
        mature = true;
        break;
      }
    }
    expect(mature).toBe(true);

    // 收获
    const before = itemCount(state.player, 'herb.mossling');
    simulateDay(state, { actions: [{ kind: 'harvest', at: { x: 1, y: 1 } }] }, ctx);
    expect(itemCount(state.player, 'herb.mossling')).toBeGreaterThan(before);
    expect(state.crops.size).toBe(0);
  });

  it('缺照料（不浇水不供灵）的灵草生长极慢', () => {
    const { state: sA, ctx: cA } = setup();
    const { state: sB, ctx: cB } = setup();
    mutateItem(sA.player, 'seed.mossling', 1);
    mutateItem(sB.player, 'seed.mossling', 1);
    for (const s of [sA, sB]) {
      simulateDay(s, { actions: [{ kind: 'till', at: { x: 2, y: 2 } }] }, cA);
      simulateDay(s, { actions: [{ kind: 'sow', at: { x: 2, y: 2 }, seedId: 'seed.mossling' }] }, cA);
    }
    // A 每日照料，B 放任
    for (let d = 0; d < 5; d++) {
      simulateDay(
        sA,
        { actions: [{ kind: 'water', at: { x: 2, y: 2 } }, { kind: 'channel-qi', at: { x: 2, y: 2 } }] },
        cA,
      );
      simulateDay(sB, { actions: [] }, cB);
    }
    const gA = sA.crops.get(tileAt(sA, 2, 2)!.id)!.growth;
    const gB = sB.crops.get(tileAt(sB, 2, 2)!.id)!.growth;
    expect(gA).toBeGreaterThan(gB); // 照料组生长严格多于放任组（A 多数已成熟封顶 40000）
  });

  it('生食灵草积累丹毒（docs/06 §1.1）', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.frostmarrow', 3); // 二阶寒草，rawPoison 8000
    const before = state.player.pillPoison;
    simulateDay(state, { actions: [{ kind: 'eat-raw', herbDefId: 'herb.frostmarrow' }] }, ctx);
    expect(state.player.pillPoison).toBeGreaterThan(before);
  });

  it('季节推进（28 日/季）', () => {
    const { state, ctx } = setup();
    const startSeason = state.season;
    for (let d = 0; d < DEFAULT_BALANCE.time.daysPerSeason; d++) {
      simulateDay(state, { actions: [] }, ctx);
    }
    expect(state.season).not.toBe(startSeason);
  });

  it('体力每日恢复', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'seed.mossling', 10);
    // 消耗体力
    simulateDay(state, { actions: [{ kind: 'till', at: { x: 0, y: 0 } }, { kind: 'till', at: { x: 0, y: 1 } }, { kind: 'till', at: { x: 0, y: 2 } }] }, ctx);
    expect(state.player.stamina).toBeLessThan(DEFAULT_BALANCE.player.staminaCap * 1000);
    simulateDay(state, { actions: [] }, ctx);
    expect(state.player.stamina).toBe(DEFAULT_BALANCE.player.staminaCap * 1000);
  });

  it('过夜休养回血 5%（docs/08 生存性）', () => {
    const { state, ctx } = setup();
    state.player.hp = 40_000; // 40%
    state.player.maxHp = 100_000;
    simulateDay(state, { actions: [] }, ctx);
    expect(state.player.hp).toBeGreaterThan(40_000); // 回血了
    expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
  });

  it('程序化地形：地图含水域/岩石等多样性地形（docs/08 §3.3）', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 7, width: 12, height: 12, content: reg, params: DEFAULT_BALANCE });
    const soilCounts: Record<string, number> = {};
    for (const t of s.tiles) soilCounts[t.soilType] = (soilCounts[t.soilType] ?? 0) + 1;
    expect(soilCounts['loam']).toBeGreaterThan(0);
    expect(Object.keys(soilCounts).length).toBeGreaterThan(1); // 不止 loam
  });

  it('同种子 → 同地形（确定性）', () => {
    const reg = buildRegistry();
    const a = createWorld({ seed: 99, width: 10, height: 10, content: reg, params: DEFAULT_BALANCE });
    const b = createWorld({ seed: 99, width: 10, height: 10, content: reg, params: DEFAULT_BALANCE });
    expect(a.tiles.map((t) => t.soilType)).toEqual(b.tiles.map((t) => t.soilType));
  });

  it('静修：耗体力回血+清毒', () => {
    const { state, ctx } = setup();
    state.player.hp = 50_000;
    state.player.pillPoison = 30_000;
    const stamBefore = state.player.stamina;
    simulateDay(state, { actions: [{ kind: 'rest' }] }, ctx);
    expect(state.player.hp).toBeGreaterThan(50_000); // 回血
    expect(state.player.pillPoison).toBeLessThan(30_000); // 清毒
    // 体力消耗在当日清晨重置前已扣（rest 耗 30），但 simulateDay 清晨先重置→动作→日终不再重置
    // 故 rest 消耗体现在 stamBefore(满) - 30*1000
    expect(state.player.stamina).toBe(stamBefore - 30 * 1000);
  });
});
