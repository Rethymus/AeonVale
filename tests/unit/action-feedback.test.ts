import { describe, expect, it } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE } from '@sim';
import { buildRegistry } from '@content/registry';
import { arrayPlacementToastPresentation, cultivationPanelToastPresentation, deriveFarmActionOutcome, farmActionBlockedReason, farmActionBlockedToast, farmActionBlockedToastPresentation, farmActionSuccessToastPresentation, fertilizeSuccessToastPresentation, overlayToastPresentation, restSuccessToastPresentation, sowSuccessToastPresentation, sowUnavailableToastPresentation, type FarmTileSnapshot } from '@app/actionFeedback';

function makeTile(overrides: Partial<FarmTileSnapshot> = {}): FarmTileSnapshot {
  return {
    id: 1,
    x: 0,
    y: 0,
    tilled: false,
    cropId: null,
    wateredToday: false,
    channeledToday: false,
    moisture: 0,
    fertility: 0,
    qiDensity: 0,
    ...overrides
  };
}

describe('farm action feedback helper', () => {
  it('detects successful till feedback only when a tile becomes tilled', () => {
    expect(deriveFarmActionOutcome('till', [makeTile()], [makeTile({ tilled: true })])).toEqual({
      succeeded: true,
      affectedTiles: [{ x: 0, y: 0 }]
    });
    expect(deriveFarmActionOutcome('till', [makeTile({ tilled: true })], [makeTile({ tilled: true })]).succeeded).toBe(false);
  });

  it('detects watering from same-day mark or moisture increase', () => {
    expect(deriveFarmActionOutcome('water', [makeTile({ cropId: 1, moisture: 10_000 })], [makeTile({ cropId: 1, wateredToday: true, moisture: 40_000 })])).toEqual({
      succeeded: true,
      affectedTiles: [{ x: 0, y: 0 }]
    });
  });

  it('detects harvest only when an occupied tile becomes empty', () => {
    expect(deriveFarmActionOutcome('harvest', [makeTile({ cropId: 12 })], [makeTile({ cropId: null })])).toEqual({
      succeeded: true,
      affectedTiles: [{ x: 0, y: 0 }]
    });
    expect(deriveFarmActionOutcome('harvest', [makeTile()], [makeTile()]).succeeded).toBe(false);
  });

  it('detects sow and fertilize only when the tile state actually advances', () => {
    expect(deriveFarmActionOutcome('sow', [makeTile({ tilled: true, cropId: null })], [makeTile({ tilled: true, cropId: 8 })])).toEqual({
      succeeded: true,
      affectedTiles: [{ x: 0, y: 0 }]
    });

    expect(deriveFarmActionOutcome('fertilize', [makeTile({ tilled: true, fertility: 20_000, qiDensity: 10_000 })], [makeTile({ tilled: true, fertility: 45_000, qiDensity: 25_000 })])).toEqual({
      succeeded: true,
      affectedTiles: [{ x: 0, y: 0 }]
    });
  });

  it('detects channel-qi only when a planted tile gains same-day qi care', () => {
    expect(deriveFarmActionOutcome('channel-qi', [makeTile({ cropId: 4 })], [makeTile({ cropId: 4, channeledToday: true })])).toEqual({
      succeeded: true,
      affectedTiles: [{ x: 0, y: 0 }]
    });
  });

  it('returns stable blocked toasts for refined farm-action reasons', () => {
    expect(farmActionBlockedToast('till', 'occupied')).toBe('此地已有灵草，占着无法翻耕');
    expect(farmActionBlockedToast('sow', 'untilled')).toBe('这块地还没翻，先整好再播种');
    expect(farmActionBlockedToast('sow', 'off-season')).toBe('这类灵种离季，需先借暖棚苗床养护');
    expect(farmActionBlockedToast('water', 'already-watered')).toBe('这片灵草今天已经浇过了');
    expect(farmActionBlockedToast('harvest', 'not-mature')).toBe('灵草还没熟，再等一等');
    expect(farmActionBlockedToast('harvest', 'inventory-full')).toBe('储物戒已满，先腾出空位再收获');
    expect(farmActionBlockedToast('channel-qi', 'already-channeled')).toBe('这株灵草今天已经供过灵了');
    expect(farmActionBlockedToast('fertilize', 'invalid-fertilizer')).toBe('这件东西没法拿来施肥');
  });

  it('anchors blocked farm action feedback to concrete tool, seed, and fertilizer assets', () => {
    expect(farmActionBlockedToastPresentation('till', 'occupied')).toEqual({
      message: '此地已有灵草，占着无法翻耕',
      assetId: 'icon.item.rust-hoe'
    });
    expect(farmActionBlockedToastPresentation('sow', 'off-season', { seedId: 'seed.dewroot' })).toEqual({
      message: '这类灵种离季，需先借暖棚苗床养护',
      assetId: 'icon.seed.dewroot'
    });
    expect(farmActionBlockedToastPresentation('sow', 'no-seed')).toEqual({
      message: '手头没有可播下的种子，先去集市补货续上药材循环',
      assetId: 'loc.valley-market'
    });
    expect(farmActionBlockedToastPresentation('sow', 'no-seed', { seedId: 'seed.mossling' })).toEqual({
      message: '手头没有可播下的种子，先去集市补货续上药材循环',
      assetId: 'icon.seed.mossling'
    });
    expect(farmActionBlockedToastPresentation('water', 'already-watered')).toEqual({
      message: '这片灵草今天已经浇过了',
      assetId: 'icon.item.water-pail'
    });
    expect(farmActionBlockedToastPresentation('harvest', 'inventory-full')).toEqual({
      message: '储物戒已满，先腾出空位再收获',
      assetId: 'icon.item.sickle'
    });
    expect(farmActionBlockedToastPresentation('channel-qi', 'already-channeled')).toEqual({
      message: '这株灵草今天已经供过灵了',
      assetId: 'icon.item.array-core'
    });
    expect(farmActionBlockedToastPresentation('fertilize', 'invalid-fertilizer', { itemId: 'item.spirit-compost' })).toEqual({
      message: '这件东西没法拿来施肥',
      assetId: 'icon.item.spirit-compost'
    });
  });

  it('anchors sow-unavailable failures to seed art when known, otherwise points to market restock', () => {
    expect(sowUnavailableToastPresentation()).toEqual({
      message: '无可播种种子，先去集市补货续上第二轮药材',
      assetId: 'loc.valley-market'
    });
    expect(sowUnavailableToastPresentation({ seedId: 'seed.mossling' })).toEqual({
      message: '无可播种种子，先去集市补货续上第二轮药材',
      assetId: 'icon.seed.mossling'
    });
    expect(sowUnavailableToastPresentation({ assetIdOverride: 'loc.herb-plot' })).toEqual({
      message: '无可播种种子，先去集市补货续上第二轮药材',
      assetId: 'loc.herb-plot'
    });
    expect(sowUnavailableToastPresentation({ seedId: 'seed.unknown', assetIdOverride: 'facility.shipping-bin' })).toEqual({
      message: '无可播种种子，先去集市补货续上第二轮药材',
      assetId: 'icon.seed.unknown'
    });
  });

  it('anchors fertilize success to the active farm thread when provided', () => {
    expect(fertilizeSuccessToastPresentation()).toEqual({
      message: '施下灵壤肥：稳住药材品质',
      assetId: 'loc.farmstead'
    });
    expect(fertilizeSuccessToastPresentation('loc.herb-plot')).toEqual({
      message: '施下灵壤肥：稳住药材品质',
      assetId: 'loc.herb-plot'
    });
    expect(fertilizeSuccessToastPresentation('facility.storage-chest')).toEqual({
      message: '施下灵壤肥：稳住药材品质',
      assetId: 'loc.farmstead'
    });
  });

  it('anchors rest success to the active root thread when provided', () => {
    expect(restSuccessToastPresentation('loc.farmstead')).toEqual({
      message: '静修（回血+清毒）',
      assetId: 'loc.farmstead'
    });
    expect(restSuccessToastPresentation('facility.shipping-bin')).toEqual({
      message: '静修（回血+清毒）',
      assetId: 'loc.farmstead'
    });
    expect(restSuccessToastPresentation('loc.tea-shed')).toEqual({
      message: '静修（回血+清毒）',
      assetId: 'loc.tea-shed'
    });
  });

  it('anchors cultivation overview open-close feedback to the active farm thread when provided', () => {
    expect(cultivationPanelToastPresentation(true)).toEqual({
      message: '打开功法/修炼总览',
      assetId: 'loc.farmstead'
    });
    expect(cultivationPanelToastPresentation(false)).toEqual({
      message: '关闭功法/修炼总览',
      assetId: 'loc.farmstead'
    });
    expect(cultivationPanelToastPresentation(true, 'loc.herb-plot')).toEqual({
      message: '打开功法/修炼总览',
      assetId: 'loc.herb-plot'
    });
    expect(cultivationPanelToastPresentation(false, 'facility.shipping-bin')).toEqual({
      message: '关闭功法/修炼总览',
      assetId: 'loc.farmstead'
    });
  });

  it('anchors root overlay open-close and pause feedback to the active root thread when provided', () => {
    expect(overlayToastPresentation('exit-location-selection')).toEqual({
      message: '退出地点选择',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('exit-location-selection', 'facility.shipping-bin')).toEqual({
      message: '退出地点选择',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('exit-location-selection', 'loc.herb-plot')).toEqual({
      message: '退出地点选择',
      assetId: 'loc.herb-plot'
    });
    expect(overlayToastPresentation('exit-interaction-panel')).toEqual({
      message: '退出交互面板',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('exit-interaction-panel', 'facility.storage-chest')).toEqual({
      message: '退出交互面板',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('exit-interaction-panel', 'loc.greenhouse')).toEqual({
      message: '退出交互面板',
      assetId: 'loc.greenhouse'
    });
    expect(overlayToastPresentation('pause')).toEqual({
      message: '已暂停',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('pause', 'facility.shipping-bin')).toEqual({
      message: '已暂停',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('resume')).toEqual({
      message: '继续行动',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('resume', 'loc.greenhouse')).toEqual({
      message: '继续行动',
      assetId: 'loc.greenhouse'
    });
    expect(overlayToastPresentation('resume', 'facility.storage-chest')).toEqual({
      message: '继续行动',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('open-inventory')).toEqual({
      message: '打开背包/仓库',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('open-inventory', 'loc.herb-plot')).toEqual({
      message: '打开背包/仓库',
      assetId: 'loc.herb-plot'
    });
    expect(overlayToastPresentation('open-inventory', 'facility.storage-chest')).toEqual({
      message: '打开背包/仓库',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('pause', 'loc.herb-plot')).toEqual({
      message: '已暂停',
      assetId: 'loc.herb-plot'
    });
    expect(overlayToastPresentation('close-inventory')).toEqual({
      message: '关闭背包/仓库',
      assetId: 'loc.farmstead'
    });
    expect(overlayToastPresentation('close-inventory', 'loc.valley-market')).toEqual({
      message: '关闭背包/仓库',
      assetId: 'loc.valley-market'
    });
    expect(overlayToastPresentation('close-inventory', 'facility.shipping-bin')).toEqual({
      message: '关闭背包/仓库',
      assetId: 'loc.farmstead'
    });
  });

  it('anchors regular farm action success to the farmstead root thread', () => {
    expect(farmActionSuccessToastPresentation('till')).toEqual({
      message: '翻地：为下一轮药材开田',
      assetId: 'loc.farmstead'
    });
    expect(farmActionSuccessToastPresentation('water')).toEqual({
      message: '浇水：稳住药材成长',
      assetId: 'loc.farmstead'
    });
    expect(farmActionSuccessToastPresentation('harvest')).toEqual({
      message: '收获：可炼丹、出货或备劫',
      assetId: 'loc.farmstead'
    });
    expect(farmActionSuccessToastPresentation('channel-qi')).toEqual({
      message: '供灵：提高药材成色与修行余量',
      assetId: 'loc.farmstead'
    });
  });

  it('anchors sow success to the active farm root thread', () => {
    expect(sowSuccessToastPresentation({ seedId: 'seed.mossling', seedName: '青苔' })).toEqual({
      message: '播种 青苔：第二轮药材已接上',
      assetId: 'loc.farmstead'
    });
    expect(sowSuccessToastPresentation({ seedId: 'seed.dewroot', seedName: '露根草', switchedHotbar: true })).toEqual({
      message: '播种 露根草：第二轮药材已接上（已切换热栏）',
      assetId: 'loc.farmstead'
    });
    expect(
      sowSuccessToastPresentation({
        seedId: 'seed.sunblossom',
        seedName: '朝阳菇',
        switchedHotbar: true,
        nextStep: '下一步：顺手浇上这轮新苗。'
      })
    ).toEqual({
      message: '播种 朝阳菇：第二轮药材已接上（已切换热栏）｜下一步：顺手浇上这轮新苗。',
      assetId: 'loc.farmstead'
    });
    expect(sowSuccessToastPresentation({ seedName: '未知灵种' })).toEqual({
      message: '播种 未知灵种：第二轮药材已接上',
      assetId: 'loc.farmstead'
    });
    expect(
      sowSuccessToastPresentation({
        seedId: 'seed.mossling',
        seedName: '青苔',
        assetIdOverride: 'facility.storage-chest'
      })
    ).toEqual({
      message: '播种 青苔：第二轮药材已接上',
      assetId: 'loc.farmstead'
    });
    expect(
      sowSuccessToastPresentation({
        seedId: 'seed.sunblossom',
        seedName: '朝阳菇',
        assetIdOverride: 'loc.herb-plot'
      })
    ).toEqual({
      message: '播种 朝阳菇：第二轮药材已接上',
      assetId: 'loc.herb-plot'
    });
    expect(
      sowSuccessToastPresentation({
        seedId: 'seed.sunblossom',
        seedName: '朝阳菇',
        nextStep: '当前目标：先给刚播下的幼苗补上第一桶水。\n操作：面向新苗按 X。\n动线：留在农庄。'
      })
    ).toEqual({
      message: '播种 朝阳菇：第二轮药材已接上｜下一步：先给刚播下的幼苗补上第一桶水。',
      assetId: 'loc.farmstead'
    });
    expect(
      sowSuccessToastPresentation({
        seedId: 'seed.sunblossom',
        seedName: '朝阳菇',
        nextStep: '下一步：顺手浇上这轮新苗。\n动线：继续留在农庄。'
      })
    ).toEqual({
      message: '播种 朝阳菇：第二轮药材已接上｜下一步：顺手浇上这轮新苗。',
      assetId: 'loc.farmstead'
    });
  });

  it('anchors array placement success and failure feedback to concrete array facility art', () => {
    expect(arrayPlacementToastPresentation('lightning-rod', { placed: true })).toEqual({
      message: '布设引雷阵（金属性草为阵眼）',
      assetId: 'facility.array-eye'
    });
    expect(arrayPlacementToastPresentation('insulation', { placed: true })).toEqual({
      message: '布设绝缘阵',
      assetId: 'facility.array-flag'
    });
    expect(
      arrayPlacementToastPresentation('lightning-rod', {
        placed: false,
        reason: '引雷阵需金属性灵草作阵眼',
        costText: '阵核x1、灵石x4'
      })
    ).toEqual({
      message: '引雷阵需金属性灵草作阵眼：需阵核x1、灵石x4',
      assetId: 'facility.array-eye'
    });
    expect(
      arrayPlacementToastPresentation('insulation', {
        placed: false,
        costText: '阵核x1、灵石x2'
      })
    ).toEqual({
      message: '不可放置：需阵核x1、灵石x2',
      assetId: 'facility.array-flag'
    });
  });

  it('derives the closest blocked reason from current farm state', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 1, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(1, reg, DEFAULT_BALANCE);
    state.player.stamina = 1_000_000;

    const tile = state.tiles.find(entry => entry.blockType === 'none' && entry.soilType === 'loam');
    expect(tile).toBeTruthy;
    const at = { x: tile!.x, y: tile!.y };

    expect(farmActionBlockedReason(state, ctx, 'water', at)).toBe('no-crop');

    tile!.tilled = true;
    tile!.cropId = 99;
    tile!.wateredToday = true;
    tile!.moisture = 100_000;
    tile!.channeledToday = true;

    state.crops.set(tile!.id, {
      id: 99,
      defId: 'herb.mossling',
      tileId: tile!.id,
      growth: 1,
      health: 100_000,
      stage: 'seed',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
      tempered: false
    });

    expect(farmActionBlockedReason(state, ctx, 'water', at)).toBe('already-watered');
    expect(farmActionBlockedReason(state, ctx, 'channel-qi', at)).toBe('already-channeled');
    expect(farmActionBlockedReason(state, ctx, 'harvest', at)).toBe('not-mature');
  });

  it('treats harvest as inventory-full when a mature crop would need a new slot', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 1, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(1, reg, DEFAULT_BALANCE);
    state.player.stamina = 1_000_000;
    state.player.inventoryCapacity = 1;
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };

    const tile = state.tiles.find(entry => entry.blockType === 'none' && entry.soilType === 'loam');
    expect(tile).toBeTruthy;
    const at = { x: tile!.x, y: tile!.y };

    tile!.tilled = true;
    tile!.cropId = 99;
    state.crops.set(tile!.id, {
      id: 99,
      defId: 'herb.mossling',
      tileId: tile!.id,
      growth: 100_000,
      health: 100_000,
      stage: 'mature',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
      tempered: false
    });

    expect(farmActionBlockedReason(state, ctx, 'harvest', at)).toBe('inventory-full');
  });

  it('derives sow and fertilize blocked reasons from tile, season, inventory, and item context', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 1, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(1, reg, DEFAULT_BALANCE);
    state.player.stamina = 1_000_000;

    const tile = state.tiles.find(entry => entry.blockType === 'none' && entry.soilType === 'loam');
    expect(tile).toBeTruthy;
    const at = { x: tile!.x, y: tile!.y };

    expect(farmActionBlockedReason(state, ctx, 'sow', at, { seedId: 'seed.mossling' })).toBe('untilled');

    tile!.tilled = true;
    expect(farmActionBlockedReason(state, ctx, 'sow', at, { seedId: 'seed.mossling' })).toBe('no-seed');

    state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 1 };
    tile!.cropId = 321;
    expect(farmActionBlockedReason(state, ctx, 'sow', at, { seedId: 'seed.mossling' })).toBe('occupied');
    tile!.cropId = null;

    state.season = 'spring';
    state.player.inventory['seed.suncap'] = { itemId: 'seed.suncap', count: 1 };
    expect(farmActionBlockedReason(state, ctx, 'sow', at, { seedId: 'seed.suncap' })).toBe('off-season');

    expect(farmActionBlockedReason(state, ctx, 'fertilize', at, { itemId: 'item.spirit-stone' })).toBe('invalid-fertilizer');
    expect(farmActionBlockedReason(state, ctx, 'fertilize', at, { itemId: 'item.spirit-compost' })).toBe('no-fertilizer');

    state.player.inventory['item.spirit-compost'] = { itemId: 'item.spirit-compost', count: 1 };
    expect(farmActionBlockedReason(state, ctx, 'fertilize', at, { itemId: 'item.spirit-compost' })).toBe(null);
  });
});
