import { describe, it, expect } from 'vitest';
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, tileAt, placeArray, applyFarmDayEnd } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';
import { MILLI } from '@sim/world/types';
import type { GameState, GuardBeast } from '@sim/world/state';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('种田 sim ', () => {
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
          { kind: 'channel-qi', at: { x: 1, y: 1 } }
        ]
      },
      ctx
    );
    tile = tileAt(state, 1, 1);
    expect(tile?.cropId).not.toBe(null);
    expect(state.crops.size).toBe(1);

    // 推进至成熟
    let mature = false;
    for (let d = 0; d < 12; d++) {
      simulateDay(
        state,
        {
          actions: [
            { kind: 'water', at: { x: 1, y: 1 } },
            { kind: 'channel-qi', at: { x: 1, y: 1 } }
          ]
        },
        ctx
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

  it('储物戒满时无法收获，灵草保留在地里且不扣体力', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-stone', 1);
    state.player.inventoryCapacity = 1;

    const tile = tileAt(state, 1, 1)!;
    tile.tilled = true;
    tile.cropId = 99;
    state.crops.set(tile.id, {
      id: 99,
      defId: 'herb.mossling',
      tileId: tile.id,
      growth: 100_000,
      health: 100_000,
      stage: 'mature',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
      tempered: false
    });

    const staminaBefore = state.player.stamina;
    simulateDay(state, { actions: [{ kind: 'harvest', at: { x: 1, y: 1 } }] }, ctx);

    expect(tileAt(state, 1, 1)!.cropId).toBe(99);
    expect(state.crops.has(tile.id)).toBe(true);
    expect(itemCount(state.player, 'herb.mossling')).toBe(0);
    expect(state.player.stamina).toBe(staminaBefore);

    state.player.inventoryCapacity = 3;
    simulateDay(state, { actions: [{ kind: 'harvest', at: { x: 1, y: 1 } }] }, ctx);

    expect(tileAt(state, 1, 1)!.cropId).toBe(null);
    expect(itemCount(state.player, 'herb.mossling')).toBeGreaterThan(0);
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
        {
          actions: [
            { kind: 'water', at: { x: 2, y: 2 } },
            { kind: 'channel-qi', at: { x: 2, y: 2 } }
          ]
        },
        cA
      );
      simulateDay(sB, { actions: [] }, cB);
    }
    const gA = sA.crops.get(tileAt(sA, 2, 2)!.id)!.growth;
    const gB = sB.crops.get(tileAt(sB, 2, 2)!.id)!.growth;
    expect(gA).toBeGreaterThan(gB); // 照料组生长严格多于放任组（A 多数已成熟封顶 40000）
  });

  it('生食灵草积累丹毒', () => {
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
    simulateDay(
      state,
      {
        actions: [
          { kind: 'till', at: { x: 0, y: 0 } },
          { kind: 'till', at: { x: 0, y: 1 } },
          { kind: 'till', at: { x: 0, y: 2 } }
        ]
      },
      ctx
    );
    expect(state.player.stamina).toBeLessThan(DEFAULT_BALANCE.player.staminaCap * 1000);
    simulateDay(state, { actions: [] }, ctx);
    expect(state.player.stamina).toBe(DEFAULT_BALANCE.player.staminaCap * 1000);
  });

  it('过夜休养回血 5%', () => {
    const { state, ctx } = setup();
    state.player.hp = 40_000; // 40%
    state.player.maxHp = 100_000;
    simulateDay(state, { actions: [] }, ctx);
    expect(state.player.hp).toBeGreaterThan(40_000); // 回血了
    expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
  });

  it('程序化地形：地图含水域/岩石等多样性地形', () => {
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
    expect(a.tiles.map(t => t.soilType)).toEqual(b.tiles.map(t => t.soilType));
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

  it('绝缘阵为覆盖农田保湿并减轻失养伤苗', () => {
    const { state: withArray, ctx: withArrayCtx } = setup();
    const { state: baseline, ctx: baselineCtx } = setup();

    mutateItem(withArray.player, 'seed.mossling', 1);
    simulateDay(withArray, { actions: [{ kind: 'till', at: { x: 2, y: 2 } }] }, withArrayCtx);
    simulateDay(withArray, { actions: [{ kind: 'sow', at: { x: 2, y: 2 }, seedId: 'seed.mossling' }] }, withArrayCtx);

    mutateItem(baseline.player, 'seed.mossling', 1);
    simulateDay(baseline, { actions: [{ kind: 'till', at: { x: 2, y: 2 } }] }, baselineCtx);
    simulateDay(baseline, { actions: [{ kind: 'sow', at: { x: 2, y: 2 }, seedId: 'seed.mossling' }] }, baselineCtx);

    placeArray(withArray, 'array.insulation', 2, 2, withArrayCtx, { free: true });
    const withArrayTileId = tileAt(withArray, 2, 2)!.id;
    const baselineTileId = tileAt(baseline, 2, 2)!.id;
    withArray.crops.get(withArrayTileId)!.health = 80 * MILLI;
    baseline.crops.get(baselineTileId)!.health = 80 * MILLI;

    simulateDay(withArray, { actions: [] }, withArrayCtx);
    simulateDay(baseline, { actions: [] }, baselineCtx);

    expect(tileAt(withArray, 2, 2)!.moisture).toBeGreaterThan(tileAt(baseline, 2, 2)!.moisture);
    expect(withArray.crops.get(withArrayTileId)!.health).toBeGreaterThan(baseline.crops.get(baselineTileId)!.health);
  });

  it('引雷阵让覆盖范围内的金属性灵草地块更易聚灵', () => {
    const { state: withArray, ctx: withArrayCtx } = setup();
    const { state: baseline, ctx: baselineCtx } = setup();

    for (const current of [withArray, baseline]) {
      const tile = tileAt(current, 3, 3)!;
      tile.tilled = true;
      tile.qiDensity = 20 * MILLI;
      current.crops.set(tile.id, {
        id: 1,
        defId: 'herb.metalpine',
        tileId: tile.id,
        growth: 0,
        health: 100 * MILLI,
        stage: 'seed',
        plantedDay: 1,
        property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
        tempered: false
      });
      tile.cropId = 1;
    }

    placeArray(withArray, 'array.lightning-rod', 3, 3, withArrayCtx, { free: true });

    simulateDay(
      withArray,
      {
        actions: [
          { kind: 'water', at: { x: 3, y: 3 } },
          { kind: 'channel-qi', at: { x: 3, y: 3 } }
        ]
      },
      withArrayCtx
    );
    simulateDay(
      baseline,
      {
        actions: [
          { kind: 'water', at: { x: 3, y: 3 } },
          { kind: 'channel-qi', at: { x: 3, y: 3 } }
        ]
      },
      baselineCtx
    );

    expect(tileAt(withArray, 3, 3)!.qiDensity).toBeGreaterThan(tileAt(baseline, 3, 3)!.qiDensity);
  });

  it('引雷阵覆盖的成熟金属性灵草过熟衰减减半（诱饵田回报）', () => {
    const { state: withArray, ctx: withArrayCtx, reg } = setup();
    const { state: baseline, ctx: baselineCtx } = setup();
    const threshold = reg.herbs.get('herb.metalpine')!.growthThreshold;
    for (const current of [withArray, baseline]) {
      const tile = tileAt(current, 3, 3)!;
      tile.tilled = true;
      current.crops.set(tile.id, {
        id: 1,
        defId: 'herb.metalpine',
        tileId: tile.id,
        growth: threshold,
        health: 100 * MILLI,
        stage: 'mature',
        plantedDay: 1,
        property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
        tempered: false
      });
      tile.cropId = 1;
    }
    placeArray(withArray, 'array.lightning-rod', 3, 3, withArrayCtx, { free: true });

    simulateDay(withArray, { actions: [] }, withArrayCtx);
    simulateDay(baseline, { actions: [] }, baselineCtx);

    const withGrowth = withArray.crops.get(tileAt(withArray, 3, 3)!.id)!.growth;
    const baseGrowth = baseline.crops.get(tileAt(baseline, 3, 3)!.id)!.growth;
    expect(withGrowth).toBeGreaterThan(baseGrowth); // 覆盖株过熟衰减更慢
    expect(withGrowth - baseGrowth).toBe(1_500); // 半个 overripeDecay(3*MILLI) = 1500
  });

  it('绝缘阵覆盖的空地块灵气自然再生亦有微益（控场稳气）', () => {
    const { state: withArray, ctx: withArrayCtx } = setup();
    const { state: baseline, ctx: baselineCtx } = setup();
    for (const current of [withArray, baseline]) {
      const tile = tileAt(current, 2, 2)!;
      tile.tilled = true;
      tile.qiDensity = 10 * MILLI;
    }
    placeArray(withArray, 'array.insulation', 2, 2, withArrayCtx, { free: true });

    applyFarmDayEnd(withArray, withArrayCtx);
    applyFarmDayEnd(baseline, baselineCtx);

    expect(tileAt(withArray, 2, 2)!.qiDensity).toBeGreaterThan(tileAt(baseline, 2, 2)!.qiDensity);
  });

  it('引雷阵覆盖的成熟金属性灵草收获时受天雷淬炼（诱饵田回报）', () => {
    const { state, ctx, reg } = setup();
    const tile = tileAt(state, 3, 3)!;
    tile.tilled = true;
    const threshold = reg.herbs.get('herb.metalpine')!.growthThreshold;
    state.crops.set(tile.id, {
      id: 1,
      defId: 'herb.metalpine',
      tileId: tile.id,
      growth: threshold,
      health: 100 * MILLI,
      stage: 'mature',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });
    tile.cropId = 1;
    placeArray(state, 'array.lightning-rod', 3, 3, ctx, { free: true });

    simulateDay(state, { actions: [{ kind: 'harvest', at: { x: 3, y: 3 } }] }, ctx);

    expect(state.events.find(e => e.type === 'harvest')?.payload).toMatchObject({
      rodTempered: true,
      rodQualityScoreBonus: 0.12,
      rodYieldBonus: 1
    });
  });

  it('翻地会把焦土地翻回普通壤土，恢复经营主循环', () => {
    const { state, ctx } = setup();
    const tile = tileAt(state, 1, 1)!;
    tile.blockType = 'none';
    tile.soilType = 'scorched';
    tile.tilled = false;

    simulateDay(state, { actions: [{ kind: 'till', at: { x: 1, y: 1 } }] }, ctx);

    expect(tileAt(state, 1, 1)?.soilType).toBe('loam');
    expect(tileAt(state, 1, 1)?.tilled).toBe(true);
  });
});

describe('阵守巡守农庄共振 ', () => {
  function openTile(state: GameState) {
    const t = state.tiles.find(entry => entry.blockType === 'none');
    if (!t) throw new Error('expected an open tile');
    return t;
  }

  it('阵守巡守兽在绝缘阵覆盖内巡逻时，该地块日终湿度保留更多', () => {
    const mk = (patrol: boolean) => {
      const { state, ctx } = setup(7);
      const tile = openTile(state);
      tile.tilled = true;
      tile.moisture = 60 * MILLI;
      placeArray(state, 'array.insulation', tile.x, tile.y, ctx, { free: true });
      if (patrol) {
        state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond: 40, specialty: 'array-warden' });
        state.guardBeastPatrols.push({ beastId: 1, tileId: tile.id, assignedDay: state.day });
      }
      applyFarmDayEnd(state, ctx);
      return state.tiles[tile.id]!.moisture;
    };
    expect(mk(false)).toBe(55 * MILLI); // 60 − 10 + 5(绝缘阵基础保留)
    expect(mk(true)).toBe(57 * MILLI); // 再 +2(阵守共振基础)
  });

  it('精通阵守巡守兽提供更大的湿度共振收益', () => {
    const mk = (bond: number) => {
      const { state, ctx } = setup(7);
      const tile = openTile(state);
      tile.tilled = true;
      tile.moisture = 60 * MILLI;
      placeArray(state, 'array.insulation', tile.x, tile.y, ctx, { free: true });
      state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond, specialty: 'array-warden' });
      state.guardBeastPatrols.push({ beastId: 1, tileId: tile.id, assignedDay: state.day });
      applyFarmDayEnd(state, ctx);
      return state.tiles[tile.id]!.moisture;
    };
    expect(mk(40)).toBe(57 * MILLI); // 基础共振 +2
    expect(mk(85)).toBe(59 * MILLI); // 精通共振 +4
  });

  it('非阵守专长、无巡逻指派或无阵法覆盖时不产生共振', () => {
    const mk = (opts: { specialty: GuardBeast['specialty']; patrol: boolean; placeArr: boolean }) => {
      const { state, ctx } = setup(7);
      const tile = openTile(state);
      tile.tilled = true;
      tile.moisture = 60 * MILLI;
      if (opts.placeArr) placeArray(state, 'array.insulation', tile.x, tile.y, ctx, { free: true });
      if (opts.patrol) {
        state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond: 40, specialty: opts.specialty });
        state.guardBeastPatrols.push({ beastId: 1, tileId: tile.id, assignedDay: state.day });
      }
      applyFarmDayEnd(state, ctx);
      return state.tiles[tile.id]!.moisture;
    };
    expect(mk({ specialty: 'field-ward', patrol: true, placeArr: true })).toBe(55 * MILLI); // 错专长 → 无共振
    expect(mk({ specialty: 'array-warden', patrol: false, placeArr: true })).toBe(55 * MILLI); // 无巡逻指派 → 无共振
    expect(mk({ specialty: 'array-warden', patrol: true, placeArr: false })).toBe(50 * MILLI); // 无阵法覆盖（也无基础绝缘保留）
  });
});
