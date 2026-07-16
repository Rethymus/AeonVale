import { describe, expect, it } from 'vitest';
import { advanceDay, applyAction, createSimContext, createWorld, DEFAULT_BALANCE, greenhouseCareBonus, greenhouseClimateCareGainBonus, greenhouseClimate, greenhouseCultivationBalance, getGreenhouseSeedGrant, getGreenhouseRumor, getLocationServiceAvailability, getLocationServiceOptions, greenhouseNurseryCapacity, greenhouseCareStreak, greenhouseClimateNeglectBuffer, greenhouseProtectedGrowthMultiplier, greenhouseProtectedHarvestBonus, greenhouseProtectedHealthDelta, greenhouseNurserySlotsRemaining, greenhouseNurseryTier, greenhouseProtectedCropCount, greenhouseVisitFlag, hasUpgrade, performUpgrade, simulateDay, tendGreenhouse, tileAt, type GameState, type SimContext } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import { mutateItem } from '@sim/world/player';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('暖棚传闻池 ', () => {
  it('扩容为 7 类后，getGreenhouseRumor 在两周内覆盖全部条目', () => {
    const { state } = setup();
    const seen = new Set<string>();
    for (let day = 1; day <= 14; day += 1) {
      state.day = day;
      seen.add(getGreenhouseRumor(state).id);
    }
    expect(seen.size).toBe(7);
    for (const id of ['winter-bed', 'seed-tray', 'quiet-rain', 'mortal-season', 'off-season-stock', 'climate-tuning', 'old-vine-frame']) {
      expect(seen.has(id)).toBe(true);
    }
  });
});

describe('暖棚留世循环', () => {
  it('未留世时暖棚服务关闭，留世后开放', () => {
    const { state } = setup();
    expect(getLocationServiceAvailability(state, 'greenhouse', 'greenhouse-tending')).toEqual({ open: false, reason: '留世后开放' });
    expect(getLocationServiceOptions(state, 'greenhouse')).toEqual([]);

    state.postAscension.mode = 'stayed-in-world';
    expect(getLocationServiceAvailability(state, 'greenhouse', 'greenhouse-tending')).toEqual({ open: true, reason: null });
    expect(getLocationServiceOptions(state, 'greenhouse').map(option => option.command)).toEqual(['show-greenhouse']);
  });

  it('留世后可在暖棚每日养护一次并获得育苗与地力回暖收益', () => {
    const { state, ctx } = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.player.stamina = 100 * MILLI;
    state.season = 'winter';
    const tendedTiles = state.tiles.filter(tile => tile.blockType === 'none').slice(0, 2);
    tendedTiles[0]!.tilled = true;
    tendedTiles[0]!.fertility = 40 * MILLI;
    tendedTiles[0]!.qiDensity = 25 * MILLI;
    tendedTiles[1]!.tilled = true;
    tendedTiles[1]!.fertility = 60 * MILLI;
    tendedTiles[1]!.qiDensity = 30 * MILLI;

    const grant = getGreenhouseSeedGrant(state);
    const result = tendGreenhouse(state, ctx);

    expect(result.ok).toBe(true);
    expect(result.grantedSeedId).toBe(grant.itemId);
    expect(result.grantedSeedCount).toBe(grant.count);
    expect(result.nurseryTier).toBe(0);
    expect(result.revivedTiles).toBe(2);
    expect(state.player.inventory[grant.itemId]?.count ?? 0).toBe(grant.count);
    expect(state.player.stamina).toBe(80 * MILLI);
    expect(tendedTiles[0]?.fertility).toBe(48 * MILLI);
    expect(tendedTiles[0]?.qiDensity).toBe(31 * MILLI);
    expect(tendedTiles[1]?.fertility).toBe(68 * MILLI);
    expect(tendedTiles[1]?.qiDensity).toBe(36 * MILLI);
    expect(state.flags.has(greenhouseVisitFlag(state.day))).toBe(true);
    expect(state.events.at(-1)).toMatchObject({
      type: 'greenhouse-tend',
      payload: {
        rumorId: result.rumor.id,
        grantedSeedId: grant.itemId,
        grantedSeedCount: grant.count,
        revivedTiles: 2,
        fertilityGainPerTile: 8 * MILLI,
        qiGainPerTile: 6 * MILLI,
        staminaCost: 20 * MILLI,
        nurseryTier: 0
      }
    });
    expect(roundTripEqual(state)).toBe(true);
  });

  it('暖棚苗床扩建后会解锁离季灵苗并强化回养收益', () => {
    const { state, ctx } = setup();
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.player.stamina = 100 * MILLI;
    state.season = 'winter';
    state.day = 2;
    state.seasonDay = 2;
    const tendedTile = state.tiles.find(tile => tile.blockType === 'none')!;
    tendedTile.tilled = true;
    tendedTile.fertility = 40 * MILLI;
    tendedTile.qiDensity = 25 * MILLI;
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(hasUpgrade(state, 'greenhouse-nursery-1')).toBe(true);
    expect(greenhouseNurseryTier(state)).toBe(1);

    const grant = getGreenhouseSeedGrant(state);
    const result = tendGreenhouse(state, ctx);

    expect(grant.itemId).toBe('seed.sunmoss');
    expect(grant.count).toBe(3);
    expect(result).toMatchObject({
      ok: true,
      grantedSeedId: 'seed.sunmoss',
      grantedSeedCount: 3,
      nurseryTier: 1,
      nurseryCapacity: 3,
      nurserySlotsRemaining: 3,
      fertilityGainPerTile: 12 * MILLI,
      qiGainPerTile: 9 * MILLI
    });
    expect(greenhouseNurseryCapacity(state)).toBe(3);
    expect(greenhouseNurserySlotsRemaining(state)).toBe(3);
    expect(tendedTile.fertility).toBe(52 * MILLI);
    expect(tendedTile.qiDensity).toBe(34 * MILLI);
    expect(state.player.inventory['seed.sunmoss']?.count ?? 0).toBe(3);
  });

  it('暖棚二阶扩建会继续提升苗床阶数、槽位与养护收益', () => {
    const { state, ctx } = setup(13);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.player.stamina = 100 * MILLI;
    state.season = 'winter';
    state.day = 5;
    state.seasonDay = 5;
    const tendedTile = state.tiles.find(tile => tile.blockType === 'none')!;
    tendedTile.tilled = true;
    tendedTile.fertility = 40 * MILLI;
    tendedTile.qiDensity = 25 * MILLI;
    mutateItem(state.player, 'item.spirit-stone', 44);
    mutateItem(state.player, 'item.array-core', 3);
    mutateItem(state.player, 'item.recipe-fragment', 3);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(greenhouseNurseryTier(state)).toBe(2);

    const grant = getGreenhouseSeedGrant(state);
    const result = tendGreenhouse(state, ctx);

    expect(grant.itemId).toBe('seed.sunmoss');
    expect(grant.count).toBe(4);
    expect(result).toMatchObject({
      ok: true,
      grantedSeedId: 'seed.sunmoss',
      grantedSeedCount: 4,
      nurseryTier: 2,
      nurseryCapacity: 4,
      nurserySlotsRemaining: 4,
      fertilityGainPerTile: 16 * MILLI,
      qiGainPerTile: 12 * MILLI
    });
    expect(greenhouseNurseryCapacity(state)).toBe(4);
    expect(greenhouseNurserySlotsRemaining(state)).toBe(4);
    expect(tendedTile.fertility).toBe(56 * MILLI);
    expect(tendedTile.qiDensity).toBe(37 * MILLI);
    expect(state.player.inventory['seed.sunmoss']?.count ?? 0).toBe(4);
  });

  it('暖棚三阶扩建会把离季苗床提升到五槽，并继续强化养护收益', () => {
    const { state, ctx } = setup(17);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.player.stamina = 100 * MILLI;
    state.season = 'winter';
    state.day = 8;
    state.seasonDay = 8;
    const tendedTile = state.tiles.find(tile => tile.blockType === 'none')!;
    tendedTile.tilled = true;
    tendedTile.fertility = 40 * MILLI;
    tendedTile.qiDensity = 25 * MILLI;
    mutateItem(state.player, 'item.spirit-stone', 80);
    mutateItem(state.player, 'item.array-core', 6);
    mutateItem(state.player, 'item.recipe-fragment', 6);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.sunmoss', 4);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-3').ok).toBe(true);
    expect(greenhouseNurseryTier(state)).toBe(3);

    const grant = getGreenhouseSeedGrant(state);
    const result = tendGreenhouse(state, ctx);

    expect(grant.itemId).toBe('seed.sunmoss');
    expect(grant.count).toBe(5);
    expect(result).toMatchObject({
      ok: true,
      grantedSeedId: 'seed.sunmoss',
      grantedSeedCount: 5,
      nurseryTier: 3,
      nurseryCapacity: 5,
      nurserySlotsRemaining: 5,
      fertilityGainPerTile: 20 * MILLI,
      qiGainPerTile: 15 * MILLI
    });
    expect(greenhouseNurseryCapacity(state)).toBe(5);
    expect(greenhouseNurserySlotsRemaining(state)).toBe(5);
    expect(tendedTile.fertility).toBe(60 * MILLI);
    expect(tendedTile.qiDensity).toBe(40 * MILLI);
    expect(state.player.inventory['seed.sunmoss']?.count ?? 0).toBe(5);
  });

  it('暖棚棚温越稳，养护奖励会随跨日经营上升', () => {
    const { state, ctx } = setup(23);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.player.stamina = 100 * MILLI;
    state.season = 'winter';
    state.day = 6;
    state.seasonDay = 6;
    state.stayingWorld.greenhouseClimate = 72 * MILLI;
    state.stayingWorld.greenhouseCareStreak = 4;
    const tendedTile = state.tiles.find(tile => tile.blockType === 'none')!;
    tendedTile.tilled = true;
    tendedTile.fertility = 40 * MILLI;
    tendedTile.qiDensity = 25 * MILLI;

    const grant = getGreenhouseSeedGrant(state);
    const bonus = greenhouseCareBonus(state);
    const result = tendGreenhouse(state, ctx);

    expect(greenhouseClimate(state)).toBe(72 * MILLI);
    expect(greenhouseCareStreak(state)).toBe(4);
    expect(bonus).toEqual({ seedBonus: 1, fertilityBonus: 4 * MILLI, qiBonus: 3 * MILLI });
    expect(grant.count).toBe(3);
    expect(result).toMatchObject({
      ok: true,
      grantedSeedCount: 3,
      fertilityGainPerTile: 12 * MILLI,
      qiGainPerTile: 9 * MILLI,
      greenhouseClimate: 72 * MILLI,
      greenhouseCareStreak: 4
    });
    expect(tendedTile.fertility).toBe(52 * MILLI);
    expect(tendedTile.qiDensity).toBe(34 * MILLI);
  });

  it('暖棚高阶扩建会把高棚温收益继续放大', () => {
    const { state, ctx } = setup(24);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.player.stamina = 100 * MILLI;
    state.season = 'winter';
    state.day = 8;
    state.seasonDay = 8;
    state.stayingWorld.greenhouseClimate = 86 * MILLI;
    state.stayingWorld.greenhouseCareStreak = 5;
    mutateItem(state.player, 'item.spirit-stone', 80);
    mutateItem(state.player, 'item.array-core', 6);
    mutateItem(state.player, 'item.recipe-fragment', 6);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.sunmoss', 4);
    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-3').ok).toBe(true);

    const tendedTile = state.tiles.find(tile => tile.blockType === 'none')!;
    tendedTile.tilled = true;
    tendedTile.fertility = 40 * MILLI;
    tendedTile.qiDensity = 25 * MILLI;

    const bonus = greenhouseCareBonus(state);
    const grant = getGreenhouseSeedGrant(state);
    const result = tendGreenhouse(state, ctx);

    expect(bonus).toEqual({ seedBonus: 3, fertilityBonus: 5 * MILLI, qiBonus: 4 * MILLI });
    expect(grant.count).toBe(8);
    expect(greenhouseClimateCareGainBonus(state)).toBe(3 * MILLI);
    expect(greenhouseClimateNeglectBuffer(state)).toBe(4 * MILLI);
    expect(result).toMatchObject({
      ok: true,
      grantedSeedCount: 8,
      fertilityGainPerTile: 25 * MILLI,
      qiGainPerTile: 19 * MILLI,
      greenhouseClimate: 86 * MILLI,
      greenhouseCareStreak: 5
    });
    expect(tendedTile.fertility).toBe(65 * MILLI);
    expect(tendedTile.qiDensity).toBe(44 * MILLI);
  });

  it('同日不可重复养护，未留世、体力不足或背包已满也会拒绝', () => {
    const { state, ctx } = setup();
    const pre = tendGreenhouse(state, ctx);
    expect(pre).toMatchObject({ ok: false, reason: '唯有留世后方能把暖棚当作四时育苗之所' });

    state.postAscension.mode = 'stayed-in-world';
    state.player.stamina = 19 * MILLI;
    const tired = tendGreenhouse(state, ctx);
    expect(tired).toMatchObject({ ok: false, reason: '体力不足' });

    state.player.stamina = 100 * MILLI;
    state.player.inventoryCapacity = 0;
    const full = tendGreenhouse(state, ctx);
    expect(full).toMatchObject({ ok: false, reason: '背包已满' });

    state.player.inventoryCapacity = 16;
    expect(tendGreenhouse(state, ctx).ok).toBe(true);
    const repeat = tendGreenhouse(state, ctx);
    expect(repeat).toMatchObject({ ok: false, reason: '今日已养护过暖棚' });
  });

  it('离季灵苗需要暖棚苗床与当日养护后才能播种，并作为暖棚苗持续生长', () => {
    const { state, ctx } = setup(9);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 2;
    state.seasonDay = 2;
    mutateItem(state.player, 'seed.sunmoss', 2);
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.sunmoss' }, ctx);
    expect(tileAt(state, 1, 1)?.cropId).toBeNull;

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.sunmoss' }, ctx);
    expect(tileAt(state, 1, 1)?.cropId).toBeNull;

    state.player.stamina = 100 * MILLI;
    expect(tendGreenhouse(state, ctx).ok).toBe(true);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.sunmoss' }, ctx);
    applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'channel-qi', at: { x: 1, y: 1 } }, ctx);

    const tile = tileAt(state, 1, 1)!;
    const crop = state.crops.get(tile.id);
    expect(crop?.greenhouseProtected).toBe(true);
    expect(crop?.stage).not.toBe('withered');
    expect(state.player.inventory['seed.sunmoss']?.count ?? 0).toBe(4);

    for (let d = 0; d < 5; d++) {
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
    }

    const grownCrop = state.crops.get(tile.id);
    expect(grownCrop).toBeDefined;
    expect(grownCrop?.growth ?? 0).toBeGreaterThan(0);
    expect(grownCrop?.stage).not.toBe('withered');
  });

  it('高棚温会持续提高暖棚苗的跨日生长速度与健康恢复', () => {
    const { state, ctx } = setup(29);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 9;
    state.seasonDay = 9;
    state.player.stamina = 100 * MILLI;
    state.stayingWorld.greenhouseClimate = 86 * MILLI;
    state.stayingWorld.greenhouseCareStreak = 5;
    mutateItem(state.player, 'seed.sunmoss', 2);
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(tendGreenhouse(state, ctx).ok).toBe(true);
    expect(greenhouseProtectedGrowthMultiplier(state)).toBe(1.2);
    expect(greenhouseProtectedHealthDelta(state)).toBe(2 * MILLI);

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.sunmoss' }, ctx);
    const tile = tileAt(state, 1, 1)!;
    const crop = state.crops.get(tile.id)!;
    crop.health = 92 * MILLI;

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

    const grownCrop = state.crops.get(tile.id)!;
    expect(grownCrop.growth).toBeGreaterThan(2_400);
    expect(grownCrop.health).toBe(94 * MILLI);
    expect(grownCrop.stage).toBe('sprout');
  });

  it('棚温失守时暖棚苗会变慢并在长期失养后枯萎', () => {
    const { state, ctx } = setup(31);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 9;
    state.seasonDay = 9;
    state.player.stamina = 100 * MILLI;
    state.stayingWorld.greenhouseClimate = 12 * MILLI;
    state.stayingWorld.greenhouseCareStreak = 0;
    mutateItem(state.player, 'seed.sunmoss', 2);
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(tendGreenhouse(state, ctx).ok).toBe(true);
    expect(greenhouseProtectedGrowthMultiplier(state)).toBe(0.45);
    expect(greenhouseProtectedHealthDelta(state)).toBe(-16 * MILLI);

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.sunmoss' }, ctx);
    const tile = tileAt(state, 1, 1)!;
    const crop = state.crops.get(tile.id)!;
    crop.health = 14 * MILLI;

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

    const witheredCrop = state.crops.get(tile.id)!;
    expect(witheredCrop.growth).toBe(0);
    expect(witheredCrop.health).toBe(0);
    expect(witheredCrop.stage).toBe('withered');
    expect(state.events.some(event => event.type === 'crop-withered')).toBe(true);
  });

  it('高棚温的暖棚苗在成熟收获时会兑现额外品质与加产', () => {
    const { state, ctx } = setup(37);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 12;
    state.seasonDay = 12;
    state.player.stamina = 100 * MILLI;
    state.stayingWorld.greenhouseClimate = 86 * MILLI;
    state.stayingWorld.greenhouseCareStreak = 5;
    mutateItem(state.player, 'seed.sunmoss', 2);
    mutateItem(state.player, 'item.spirit-stone', 80);
    mutateItem(state.player, 'item.array-core', 6);
    mutateItem(state.player, 'item.recipe-fragment', 6);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.sunmoss', 4);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-3').ok).toBe(true);
    expect(tendGreenhouse(state, ctx).ok).toBe(true);

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.sunmoss' }, ctx);

    const tile = tileAt(state, 1, 1)!;
    const crop = state.crops.get(tile.id)!;
    const herb = ctx.content.herbs.get('herb.sunmoss')!;
    tile.fertility = 48 * MILLI;
    tile.qiDensity = 43 * MILLI;
    crop.growth = herb.growthThreshold;
    crop.stage = 'mature';
    crop.health = 76 * MILLI;

    expect(greenhouseProtectedHarvestBonus(state)).toEqual({ qualityScoreBonus: 0.22, yieldBonus: 2 });

    applyAction(state, { kind: 'harvest', at: { x: 1, y: 1 } }, ctx);

    const harvest = state.events.find(event => event.type === 'harvest');
    expect(harvest?.payload).toMatchObject({
      defId: 'herb.sunmoss',
      quality: 'spirit',
      greenhouseProtected: true,
      greenhouseQualityScoreBonus: 0.22,
      greenhouseYieldBonus: 2,
      bonusYield: 3
    });
    expect(state.player.qualityInventory.spirit?.['herb.sunmoss']).toBe(4);
  });

  it('普通田地成熟灵草不会吃到暖棚收获加成', () => {
    const { state, ctx } = setup(41);
    const herb = ctx.content.herbs.get('herb.mossling')!;

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    mutateItem(state.player, 'seed.mossling', 1);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' }, ctx);

    const tile = tileAt(state, 1, 1)!;
    const crop = state.crops.get(tile.id)!;
    tile.fertility = 48 * MILLI;
    tile.qiDensity = 43 * MILLI;
    crop.growth = herb.growthThreshold;
    crop.stage = 'mature';
    crop.health = 76 * MILLI;

    applyAction(state, { kind: 'harvest', at: { x: 1, y: 1 } }, ctx);

    const harvest = state.events.find(event => event.type === 'harvest');
    expect(harvest?.payload).toMatchObject({
      defId: 'herb.mossling',
      greenhouseProtected: false,
      greenhouseQualityScoreBonus: 0,
      greenhouseYieldBonus: 0,
      bonusYield: 0
    });
    expect(state.player.qualityInventory.mortal?.['herb.mossling']).toBe(1);
  });

  it('暖棚混种会抬高次日棚温回升，连续同种旧床会拉低养护收益', () => {
    const { state, ctx } = setup(43);
    state.postAscension.mode = 'stayed-in-world';
    state.player.stage = 7;
    state.season = 'winter';
    state.day = 12;
    state.seasonDay = 12;
    state.player.stamina = 100 * MILLI;
    state.stayingWorld.greenhouseClimate = 60 * MILLI;
    mutateItem(state.player, 'item.spirit-stone', 80);
    mutateItem(state.player, 'item.array-core', 6);
    mutateItem(state.player, 'item.recipe-fragment', 6);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.sunmoss', 4);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-3').ok).toBe(true);

    const beds = [
      { x: 1, y: 1, defId: 'herb.sunmoss', repeat: 3 },
      { x: 2, y: 1, defId: 'herb.balmleaf', repeat: 0 },
      { x: 3, y: 1, defId: 'herb.mistfern', repeat: 2 }
    ];

    for (const [index, bed] of beds.entries()) {
      applyAction(state, { kind: 'till', at: { x: bed.x, y: bed.y } }, ctx);
      const tile = tileAt(state, bed.x, bed.y)!;
      tile.consecutiveSameCropSeasons = bed.repeat;
      const herb = ctx.content.herbs.get(bed.defId)!;
      const cropId = 900 + index;
      tile.cropId = cropId;
      state.crops.set(tile.id, {
        id: cropId,
        defId: bed.defId,
        tileId: tile.id,
        growth: Math.floor(herb.growthThreshold / 2),
        health: 90 * MILLI,
        stage: 'growing',
        plantedDay: state.day,
        property: { ...herb.baseProperty },
        tempered: false,
        greenhouseProtected: true
      });
    }

    expect(greenhouseCultivationBalance(state)).toEqual({
      diversityBonus: 2 * MILLI,
      monoculturePenalty: 2 * MILLI
    });

    expect(tendGreenhouse(state, ctx).ok).toBe(true);
    advanceDay(state, ctx);

    expect(state.stayingWorld.greenhouseClimate).toBe(70 * MILLI);
    expect(state.events.find(event => event.type === 'staying-world-day-evaluated')?.payload).toMatchObject({
      greenhouseCultivationDiversityBonus: 2 * MILLI,
      greenhouseCultivationMonoculturePenalty: 2 * MILLI,
      greenhouseClimate: 70 * MILLI,
      greenhouseCareStreak: 1
    });
  });

  it('同地重复收同种灵草才会累积连作计数，换种后重置', () => {
    const { state, ctx } = setup(47);
    state.player.stamina = 100 * MILLI;
    mutateItem(state.player, 'seed.mossling', 2);
    mutateItem(state.player, 'seed.dewroot', 1);

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' }, ctx);

    const tile = tileAt(state, 1, 1)!;
    const mossling = ctx.content.herbs.get('herb.mossling')!;
    let crop = state.crops.get(tile.id)!;
    crop.growth = mossling.growthThreshold;
    crop.stage = 'mature';

    applyAction(state, { kind: 'harvest', at: { x: 1, y: 1 } }, ctx);
    expect(tile.consecutiveSameCropSeasons).toBe(1);
    expect(tile.lastHarvestedCropDefId).toBe('herb.mossling');

    state.player.stamina = 100 * MILLI;
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' }, ctx);
    crop = state.crops.get(tile.id)!;
    crop.growth = mossling.growthThreshold;
    crop.stage = 'mature';

    applyAction(state, { kind: 'harvest', at: { x: 1, y: 1 } }, ctx);
    expect(tile.consecutiveSameCropSeasons).toBe(2);
    expect(tile.lastHarvestedCropDefId).toBe('herb.mossling');

    state.player.stamina = 100 * MILLI;
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.dewroot' }, ctx);
    const dewroot = ctx.content.herbs.get('herb.dewroot')!;
    crop = state.crops.get(tile.id)!;
    crop.growth = dewroot.growthThreshold;
    crop.stage = 'mature';

    applyAction(state, { kind: 'harvest', at: { x: 1, y: 1 } }, ctx);
    expect(tile.consecutiveSameCropSeasons).toBe(1);
    expect(tile.lastHarvestedCropDefId).toBe('herb.dewroot');
  });

  it('暖棚苗床容量满后会拒绝新增离季灵苗', () => {
    const { state, ctx } = setup(11);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 4;
    state.seasonDay = 4;
    state.player.stamina = 100 * MILLI;
    mutateItem(state.player, 'seed.sunmoss', 5);
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(tendGreenhouse(state, ctx)).toMatchObject({ ok: true, nurseryCapacity: 3, nurserySlotsRemaining: 3 });

    const spots = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 3 }
    ];

    for (const spot of spots) {
      applyAction(state, { kind: 'till', at: spot }, ctx);
    }

    state.player.stamina = 100 * MILLI;

    for (const spot of spots.slice(0, 3)) {
      applyAction(state, { kind: 'sow', at: spot, seedId: 'seed.sunmoss' }, ctx);
    }

    expect(greenhouseProtectedCropCount(state)).toBe(3);
    expect(greenhouseNurserySlotsRemaining(state)).toBe(0);

    applyAction(state, { kind: 'sow', at: spots[3]!, seedId: 'seed.sunmoss' }, ctx);

    expect(tileAt(state, 2, 3)?.cropId).toBeNull;
    expect(greenhouseProtectedCropCount(state)).toBe(3);
    expect(state.player.inventory['seed.sunmoss']?.count ?? 0).toBe(2);
  });

  it('暖棚二阶苗床容量提升到四槽，并在满槽后拒绝第五株离季灵苗', () => {
    const { state, ctx } = setup(15);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 6;
    state.seasonDay = 6;
    state.player.stamina = 100 * MILLI;
    mutateItem(state.player, 'seed.balmleaf', 6);
    mutateItem(state.player, 'item.spirit-stone', 44);
    mutateItem(state.player, 'item.array-core', 3);
    mutateItem(state.player, 'item.recipe-fragment', 3);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(tendGreenhouse(state, ctx)).toMatchObject({ ok: true, nurseryTier: 2, nurseryCapacity: 4, nurserySlotsRemaining: 4 });

    const spots = [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 }
    ];

    for (const spot of spots) {
      applyAction(state, { kind: 'till', at: spot }, ctx);
    }

    state.player.stamina = 100 * MILLI;

    for (const spot of spots.slice(0, 4)) {
      applyAction(state, { kind: 'sow', at: spot, seedId: 'seed.balmleaf' }, ctx);
    }

    expect(greenhouseProtectedCropCount(state)).toBe(4);
    expect(greenhouseNurserySlotsRemaining(state)).toBe(0);

    applyAction(state, { kind: 'sow', at: spots[4]!, seedId: 'seed.balmleaf' }, ctx);

    expect(tileAt(state, 3, 3)?.cropId).toBeNull;
    expect(greenhouseProtectedCropCount(state)).toBe(4);
    expect(state.player.inventory['seed.balmleaf']?.count ?? 0).toBe(2);
  });

  it('暖棚三阶苗床容量提升到五槽，并在满槽后拒绝第六株离季灵苗', () => {
    const { state, ctx } = setup(19);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 10;
    state.seasonDay = 10;
    state.player.stamina = 100 * MILLI;
    mutateItem(state.player, 'seed.balmleaf', 7);
    mutateItem(state.player, 'item.spirit-stone', 80);
    mutateItem(state.player, 'item.array-core', 6);
    mutateItem(state.player, 'item.recipe-fragment', 6);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.sunmoss', 4);

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-3').ok).toBe(true);
    expect(tendGreenhouse(state, ctx)).toMatchObject({ ok: true, nurseryTier: 3, nurseryCapacity: 5, nurserySlotsRemaining: 5 });

    const spots = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 3, y: 2 }
    ];

    for (const spot of spots) {
      applyAction(state, { kind: 'till', at: spot }, ctx);
    }

    state.player.stamina = 100 * MILLI;

    for (const spot of spots.slice(0, 5)) {
      applyAction(state, { kind: 'sow', at: spot, seedId: 'seed.balmleaf' }, ctx);
    }

    expect(greenhouseProtectedCropCount(state)).toBe(5);
    expect(greenhouseNurserySlotsRemaining(state)).toBe(0);
    const beforeRejected = state.player.inventory['seed.balmleaf']?.count ?? 0;

    applyAction(state, { kind: 'sow', at: spots[5]!, seedId: 'seed.balmleaf' }, ctx);

    expect(tileAt(state, 3, 2)?.cropId).toBeNull;
    expect(greenhouseProtectedCropCount(state)).toBe(5);
    expect(state.player.inventory['seed.balmleaf']?.count ?? 0).toBe(beforeRejected);
  });
});
