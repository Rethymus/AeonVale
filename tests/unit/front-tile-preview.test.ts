import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createSimContext, createWorld, DEFAULT_BALANCE, placeArray } from '@sim';
import type { Tile } from '@sim/farm/tile';
import { frontTilePreview } from '@app/frontTilePreview';

function tileAtXY(state: ReturnType<typeof createWorld>, x: number, y: number): Tile {
  const tile = state.tiles.find(entry => entry.x === x && entry.y === y);
  if (!tile) throw new Error(`missing tile at ${x},${y}`);
  return tile;
}

function clearCarriedSeeds(state: ReturnType<typeof createWorld>): void {
  for (const itemId of Object.keys(state.player.inventory)) {
    if (itemId.startsWith('seed.')) delete state.player.inventory[itemId];
  }
}

describe('front tile preview', () => {
  it('describes raw soil in front of the player as till-ready with its ground asset', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 31, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 1);
    tile.blockType = 'none';
    tile.soilType = 'loam';
    tile.tilled = false;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '未翻土地',
      details: '面前地块\n土质：普通壤土\n先翻地，再播种',
      assetId: 'tile.loam'
    });
  });

  it('uses the current ground asset for raw soil when the underlying soil type changes', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 39, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 1);
    tile.blockType = 'none';
    tile.soilType = 'dry-sand';
    tile.tilled = false;

    expect(frontTilePreview(state, reg)?.assetId).toBe('tile.dry-sand');
  });

  it('keeps insulation-covered raw soil on the insulated ground asset', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 45, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(45, reg, DEFAULT_BALANCE);
    state.player.position = { x: 1, y: 2 };
    state.player.facing = 'right';

    const coreTile = tileAtXY(state, 2, 1);
    coreTile.blockType = 'none';
    coreTile.soilType = 'insulated';
    coreTile.tilled = true;
    expect(placeArray(state, 'array.insulation', coreTile.x, coreTile.y, ctx, { free: true }).placed).toBe(true);

    const coveredTile = tileAtXY(state, 2, 2);
    coveredTile.blockType = 'none';
    coveredTile.soilType = 'loam';
    coveredTile.tilled = false;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '未翻土地',
      details: '面前地块\n土质：普通壤土\n先翻地，再播种',
      assetId: 'tile.insulated'
    });
  });

  it('surfaces scorched raw soil as a recoverable lightning scar with its tile art', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 40, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 1);
    tile.blockType = 'none';
    tile.soilType = 'scorched';
    tile.tilled = false;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '焦土地',
      details: '面前地块\n雷火灼过，暂难播种\n先翻新土层，再恢复耕作',
      assetId: 'tile.scorched'
    });
  });

  it('describes empty tilled soil as ready for sowing', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 32, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 1 };
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'down';

    const tile = tileAtXY(state, 1, 2);
    tile.blockType = 'none';
    tile.soilType = 'spirit-loam';
    tile.tilled = true;
    tile.moisture = 70_000;
    tile.qiDensity = 60_000;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '已翻灵田',
      details: '面前地块\n湿润：湿润｜灵气：充盈\n阵法护持：暂无｜现在可播种或补肥',
      assetId: 'icon.seed.mossling'
    });
  });

  it('routes empty tilled soil without carried seeds toward market restock instead of claiming sow is available', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 47, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    clearCarriedSeeds(state);
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'down';

    const tile = tileAtXY(state, 1, 2);
    tile.blockType = 'none';
    tile.soilType = 'spirit-loam';
    tile.tilled = true;
    tile.wateredToday = true;
    tile.moisture = 70_000;
    tile.channeledToday = true;
    tile.qiDensity = 60_000;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '已翻灵田',
      details: '面前地块\n湿润：湿润｜灵气：充盈\n阵法护持：暂无｜身上没有种子，先去集市补货',
      assetId: 'loc.valley-market'
    });
  });

  it('surfaces mature crops as harvest-ready with herb icon', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 33, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'left';

    const tile = tileAtXY(state, 0, 1);
    tile.blockType = 'none';
    tile.soilType = 'loam';
    tile.tilled = true;
    tile.cropId = tile.id;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.mossling',
      tileId: tile.id,
      growth: 100_000,
      health: 100_000,
      stage: 'mature',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
      tempered: false
    });

    expect(frontTilePreview(state, reg)).toEqual({
      title: '凡间青苔',
      details: '面前灵草\n阶段：成熟\n现在可收获',
      assetId: 'icon.herb.mossling'
    });
  });

  it('marks blocked terrain as non-farmable', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 34, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'up';

    const tile = tileAtXY(state, 1, 0);
    tile.soilType = 'rock';
    tile.blockType = 'tree';

    expect(frontTilePreview(state, reg)).toEqual({
      title: '岩地',
      details: '面前地块\n不可耕作\n先绕开或换一块田处理',
      assetId: 'tile.rock'
    });
  });

  it('uses current soil texture for dry tilled land', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 36, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'down';

    const tile = tileAtXY(state, 1, 2);
    tile.blockType = 'none';
    tile.soilType = 'spirit-loam';
    tile.tilled = true;
    tile.moisture = 10_000;
    tile.qiDensity = 30_000;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '已翻灵田',
      details: '面前地块\n湿润：偏干｜灵气：平稳\n阵法护持：暂无｜先补水，再播种或补肥',
      assetId: 'icon.item.water-pail'
    });
  });

  it('surfaces low-qi tilled soil with the array-core icon and next step', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 41, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'down';

    const tile = tileAtXY(state, 1, 2);
    tile.blockType = 'none';
    tile.soilType = 'spirit-loam';
    tile.tilled = true;
    tile.moisture = 70_000;
    tile.qiDensity = 10_000;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '已翻灵田',
      details: '面前地块\n湿润：湿润｜灵气：稀薄\n阵法护持：暂无｜先补灵，再播种或补肥',
      assetId: 'icon.item.array-core'
    });
  });

  it('marks insulation-covered tilled soil as protected in the preview summary', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 43, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
    state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 1 };
    const ctx = createSimContext(43, reg, DEFAULT_BALANCE);
    state.player.position = { x: 1, y: 2 };
    state.player.facing = 'right';

    const coreTile = tileAtXY(state, 2, 1);
    coreTile.blockType = 'none';
    coreTile.soilType = 'insulated';
    coreTile.tilled = true;
    expect(placeArray(state, 'array.insulation', coreTile.x, coreTile.y, ctx, { free: true }).placed).toBe(true);

    const coveredTile = tileAtXY(state, 2, 2);
    coveredTile.blockType = 'none';
    coveredTile.soilType = 'loam';
    coveredTile.tilled = true;
    coveredTile.moisture = 70_000;
    coveredTile.qiDensity = 60_000;

    expect(frontTilePreview(state, reg)).toEqual({
      title: '护持灵田',
      details: '面前地块\n湿润：湿润｜灵气：充盈\n阵法护持：绝缘阵已覆盖｜现在可播种或补肥',
      assetId: 'icon.seed.mossling'
    });
  });

  it('mentions insulation protection on growing crops covered by arrays', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 44, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(44, reg, DEFAULT_BALANCE);
    state.player.position = { x: 1, y: 2 };
    state.player.facing = 'right';

    const coreTile = tileAtXY(state, 2, 1);
    coreTile.blockType = 'none';
    coreTile.soilType = 'insulated';
    coreTile.tilled = true;
    expect(placeArray(state, 'array.insulation', coreTile.x, coreTile.y, ctx, { free: true }).placed).toBe(true);

    const coveredTile = tileAtXY(state, 2, 2);
    coveredTile.blockType = 'none';
    coveredTile.soilType = 'loam';
    coveredTile.tilled = true;
    coveredTile.moisture = 70_000;
    coveredTile.qiDensity = 60_000;
    coveredTile.cropId = coveredTile.id;
    state.crops.set(coveredTile.id, {
      id: coveredTile.id,
      defId: 'herb.mossling',
      tileId: coveredTile.id,
      growth: 40_000,
      health: 100_000,
      stage: 'growing',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
      tempered: false
    });

    expect(frontTilePreview(state, reg)).toEqual({
      title: '凡间青苔',
      details: '面前灵草\n阶段：生长期\n湿润：湿润｜灵气：充盈｜阵法护持：绝缘阵已覆盖',
      assetId: 'icon.herb.mossling'
    });
  });

  it('keeps the herb itself as the main preview asset when the front crop has withered', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 46, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 1);
    tile.blockType = 'none';
    tile.soilType = 'loam';
    tile.tilled = true;
    tile.cropId = tile.id;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.mossling',
      tileId: tile.id,
      growth: 100_000,
      health: 0,
      stage: 'withered',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
      tempered: false
    });

    expect(frontTilePreview(state, reg)).toEqual({
      title: '凡间青苔',
      details: '面前灵草\n阶段：枯萎\n已枯萎，收掉后再补种',
      assetId: 'icon.herb.mossling'
    });
  });

  it('surfaces adjacent facilities with their runtime asset id', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 35, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 1);
    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: tile.id,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 1 }
    });

    expect(frontTilePreview(state, reg)).toEqual({
      title: '晾晒架',
      details: '面前设施\n加工中，还需 1 日\n当前：凡间青苔 -> 晾晒灵草\n靠近后可通过农庄操作继续处理',
      assetId: 'facility.drying-rack'
    });
  });

  it('keeps facility art for completed adjacent facilities until collection actually happens', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 42, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 1);
    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: tile.id,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
    });

    expect(frontTilePreview(state, reg)).toEqual({
      title: '晾晒架',
      details: '面前设施\n产物已完成，可立即收取\n当前：凡间青苔 -> 晾晒灵草\n靠近后可通过农庄操作继续处理',
      assetId: 'facility.drying-rack'
    });
  });

  it('keeps facility art for idle adjacent facilities', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 45, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 1);
    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: tile.id,
      job: null
    });

    expect(frontTilePreview(state, reg)).toEqual({
      title: '封藏柜',
      details: '面前设施\n设施空闲，可立即投入使用\n靠近后可通过农庄操作继续处理',
      assetId: 'facility.sealing-cabinet'
    });
  });

  it('surfaces adjacent lightning rod arrays with manifest-backed preview art', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 37, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(37, reg, DEFAULT_BALANCE);
    state.player.position = { x: 1, y: 2 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 2);
    tile.blockType = 'none';
    tile.soilType = 'metal-ore';
    tile.tilled = true;
    tile.cropId = tile.id;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.metalpine',
      tileId: tile.id,
      growth: 100_000,
      health: 100_000,
      stage: 'mature',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });

    expect(placeArray(state, 'array.lightning-rod', tile.x, tile.y, ctx, { free: true }).placed).toBe(true);

    expect(frontTilePreview(state, reg)).toEqual({
      title: '引雷阵',
      details: '面前阵法\n阵势运转中｜覆盖 23 格｜半径 2\n以金属性灵草为阵眼，外围可作引兽避雷田',
      assetId: 'facility.array-eye'
    });
  });

  it('surfaces adjacent insulation arrays with their protective preview summary', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 38, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(38, reg, DEFAULT_BALANCE);
    state.player.position = { x: 1, y: 2 };
    state.player.facing = 'right';

    const tile = tileAtXY(state, 2, 2);
    tile.blockType = 'none';
    tile.soilType = 'insulated';
    tile.tilled = true;

    expect(placeArray(state, 'array.insulation', tile.x, tile.y, ctx, { free: true }).placed).toBe(true);

    expect(frontTilePreview(state, reg)).toEqual({
      title: '绝缘阵',
      details: '面前阵法\n阵势运转中｜覆盖 9 格｜半径 1\n护住核心药草区，减少雷击与失养风险',
      assetId: 'facility.array-flag'
    });
  });
});
