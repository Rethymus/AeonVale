import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { stageQiCap } from '@sim/progression/progression';
import { mutateItem } from '@sim/world/player';
import { ambientPanelPreview } from '@app/ambientPanelPreview';
import { FIRST_HARVEST_FLAG, FIRST_MARKET_RESTOCK_FLAG, FIRST_SECOND_SOW_FLAG, FIRST_SECOND_WATER_FLAG, FIRST_SHIPMENT_FLAG } from '@sim/story/onboarding';

describe('ambient panel preview', () => {
  it('shows the front-tile preview when the inventory is closed', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 51, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = state.tiles.find(entry => entry.x === 2 && entry.y === 1);
    if (!tile) throw new Error('missing tile');
    tile.blockType = 'none';
    tile.soilType = 'loam';
    tile.tilled = false;

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '未翻土地',
      details: '面前地块\n土质：普通壤土\n先翻地，再播种',
      assetId: 'tile.loam'
    });
  });

  it('prefers the inventory preview during the first sow objective when the inventory is open', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 52, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.tiles[0]!.tilled = true;
    mutateItem(state.player, 'seed.mossling', 2);
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    expect(ambientPanelPreview(state, reg, true)).toEqual({
      title: '凡间青苔种子',
      details: '随身背包\n数量 × 2\n首轮目标：播进田里，先把炼丹和备劫材料种出来。',
      assetId: 'icon.seed.mossling'
    });
  });

  it('switches the ambient inventory-side preview to shipping-bin art during the first ship objective', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 57, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_HARVEST_FLAG);
    mutateItem(state.player, 'herb.mossling', 1);

    expect(ambientPanelPreview(state, reg, true)).toEqual({
      title: '凡间青苔',
      details: '随身背包\n数量 × 1\n首轮目标：投进出货箱，换补种、炉料与备劫灵石。',
      assetId: 'facility.shipping-bin'
    });
  });

  it('keeps the shipping-bin preview through the first sleep objective when inventory-side guidance is preferred', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 58, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SHIPMENT_FLAG);
    mutateItem(state.player, 'item.spirit-stone', 2);

    expect(ambientPanelPreview(state, reg, true)).toEqual({
      title: '灵石',
      details: '随身背包\n数量 × 2',
      assetId: 'facility.shipping-bin'
    });
  });

  it('switches the ambient inventory-side preview to market art during the first market-restock objective', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 62, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SHIPMENT_FLAG);
    state.player.flags.add('onboarding-first-shipping-settlement');
    mutateItem(state.player, 'item.spirit-stone', 4);

    expect(ambientPanelPreview(state, reg, true)).toEqual({
      title: '灵石',
      details: '随身背包\n数量 × 4\n首轮目标：去集市补种，先把资源循环续上。',
      assetId: 'loc.valley-market'
    });
  });

  it('prefers the front-tile preview during the first water objective when the inventory is open', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 53, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const tile = state.tiles[0]!;
    tile.tilled = true;
    tile.cropId = tile.id;
    tile.moisture = 10_000;
    tile.qiDensity = 60_000;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.mossling',
      tileId: tile.id,
      growth: 20_000,
      health: 100_000,
      stage: 'sprout',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });
    mutateItem(state.player, 'seed.mossling', 2);
    state.player.position = { x: tile.x, y: tile.y + 1 };
    state.player.facing = 'up';

    expect(ambientPanelPreview(state, reg, true)).toEqual({
      title: '凡间青苔',
      details: '面前灵草\n阶段：幼苗\n湿润：偏干｜灵气：充盈｜阵法护持：暂无',
      assetId: 'icon.item.water-pail'
    });
  });

  it('keeps facility art through the ambient front-tile preview until collection actually happens', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 60, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = state.tiles.find(entry => entry.x === 2 && entry.y === 1);
    if (!tile) throw new Error('missing tile');
    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: tile.id,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
    });

    expect(ambientPanelPreview(state, reg, true)).toEqual({
      title: '晾晒架',
      details: '面前设施\n产物已完成，可立即收取\n当前：凡间青苔 -> 晾晒灵草\n靠近后可通过农庄操作继续处理',
      assetId: 'facility.drying-rack'
    });
  });

  it('falls back to inventory when no front-tile preview is available', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 54, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    mutateItem(state.player, 'item.spirit-stone', 3);
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '灵石',
      details: '随身背包\n数量 × 3',
      assetId: 'icon.item.spirit-stone'
    });
  });

  it('falls back to the active location preview when neither front-tile nor inventory preview is available', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 55, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.season = 'winter';
    state.seasonDay = 2;
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '露根药圃',
      details: '春日辨草与低阶灵苗的常见去处。\n去向：今日以常规来往为主\n现在来：农庄里还有 15 块空地可开，回去扩一小片田更顺手。\n去处：耕作 -> 查看农事\n人物：今日先按眼前去处推进',
      assetId: 'loc.herb-plot'
    });
  });

  it('adds farmstead action signals to the ambient location fallback when logistics need attention', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 61, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';
    state.shippingBin['herb.mossling'] = 1;

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '农庄',
      details: '主角以凡骨苦练、种灵草与炼体的据点。\n去向：今日以常规来往为主\n现在来：昨夜回款还挂在箱里，先回农庄把出货结清。\n要务：出货箱待结 1 项\n去处：耕作 -> 查看农事\n人物：今日先按眼前去处推进',
      assetId: 'loc.farmstead'
    });
  });

  it('points the ambient farmstead fallback at the herb-plot thread when crops are mature', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 68, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.season = 'winter';
    state.seasonDay = 2;
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    const tile = state.tiles[0]!;
    tile.tilled = true;
    tile.cropId = tile.id;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.mossling',
      tileId: tile.id,
      growth: 100_000,
      health: 100_000,
      stage: 'mature',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '露根药圃',
      details: '春日辨草与低阶灵苗的常见去处。\n去向：今日以常规来往为主\n现在来：田里已有 1 株灵草成熟，先回去把这一轮收成收住。\n去处：耕作 -> 查看农事\n人物：今日先按眼前去处推进',
      assetId: 'loc.herb-plot'
    });
  });

  it('points the ambient farmstead fallback at the herb-plot thread when fields are dry', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 69, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.season = 'winter';
    state.seasonDay = 2;
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    const tile = state.tiles[0]!;
    tile.tilled = true;
    tile.cropId = tile.id;
    tile.moisture = 40_000;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.mossling',
      tileId: tile.id,
      growth: 40_000,
      health: 100_000,
      stage: 'growing',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '露根药圃',
      details: '春日辨草与低阶灵苗的常见去处。\n去向：今日以常规来往为主\n现在来：有 1 块灵田正缺水，先回农庄把当日水路补稳。\n去处：耕作 -> 查看农事\n人物：今日先按眼前去处推进',
      assetId: 'loc.herb-plot'
    });
  });

  it('keeps the ambient farmstead fallback on the farmstead root thread when a drying rack is ready', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 65, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';
    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: state.tiles[0]!.id,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
    });

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '农庄',
      details: '主角以凡骨苦练、种灵草与炼体的据点。\n去向：今日以常规来往为主\n现在来：农庄里已有设施完工，先回去把这一轮产出收住。\n要务：待收设施 1 座\n去处：加工 -> 查看加工\n人物：今日先按眼前去处推进',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps the ambient farmstead fallback on the farmstead root thread when a talisman furnace is ready', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 66, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';
    state.facilities.set(1, {
      id: 1,
      kind: 'talisman-furnace',
      tileId: state.tiles[0]!.id,
      job: { inputItemId: 'item.array-core', outputItemId: 'item.array-core', outputCount: 1, daysRemaining: 0 }
    });

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '农庄',
      details: '主角以凡骨苦练、种灵草与炼体的据点。\n去向：今日以常规来往为主\n现在来：农庄里已有设施完工，先回去把这一轮产出收住。\n要务：待收设施 1 座\n去处：阵法 -> 查看阵法\n人物：今日先按眼前去处推进',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps the ambient farmstead fallback on the farmstead root thread when a sealing cabinet was inserted before a ready talisman furnace', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 67, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';
    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: state.tiles[0]!.id,
      job: { inputItemId: 'herb.dewroot', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 }
    });
    state.facilities.set(2, {
      id: 2,
      kind: 'talisman-furnace',
      tileId: state.tiles[1]!.id,
      job: { inputItemId: 'item.array-core', outputItemId: 'item.array-core', outputCount: 1, daysRemaining: 0 }
    });

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '农庄',
      details: '主角以凡骨苦练、种灵草与炼体的据点。\n去向：今日以常规来往为主\n现在来：农庄里已有设施完工，先回去把这一轮产出收住。\n要务：待收设施 2 座\n去处：阵法 -> 查看阵法\n人物：今日先按眼前去处推进',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps the ambient farmstead fallback on the farmstead root thread when only a sealing cabinet is ready', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 70, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';
    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: state.tiles[0]!.id,
      job: { inputItemId: 'herb.dewroot', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 }
    });

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '农庄',
      details: '主角以凡骨苦练、种灵草与炼体的据点。\n去向：今日以常规来往为主\n现在来：农庄里已有设施完工，先回去把这一轮产出收住。\n要务：待收设施 1 座\n去处：耕作 -> 查看农事\n人物：今日先按眼前去处推进',
      assetId: 'loc.farmstead'
    });
  });

  it('prioritizes a location with birthday or npc quest signals in the ambient fallback preview', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 56, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.season = 'summer';
    state.seasonDay = 8;
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '溪边药田',
      details: '盛夏药露聚集的田埂。\n去向：采药女 今日生辰，带礼更值\n现在来：这里有人停留，顺手摸清今日动向。\n去处：偶遇 -> 查看偶遇\n人物：采药女',
      assetId: 'loc.creek-field'
    });
  });

  it('reuses the same market focus reason as the location directory during first restock fallback', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 64, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SHIPMENT_FLAG);
    state.player.flags.add('onboarding-first-shipping-settlement');
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '山谷集市',
      details: '散修、商贩与委托汇聚之处。\n去向：今日以常规来往为主\n现在来：先补几颗种子，把第二轮药材和炼丹材料接上。\n去处：坊市 -> 浏览坊市\n人物：游方散修',
      assetId: 'loc.valley-market'
    });
  });

  it('routes the post-loop ambient fallback to farmstead processing so surplus visibly enters cultivation prep', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 71, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '农庄',
      details: '主角以凡骨苦练、种灵草与炼体的据点。\n去向：今日以常规来往为主\n现在来：首轮农务已成，回农庄点“农务”把余货先排进加工，再接炼丹、阵法与备劫。\n去处：加工 -> 查看加工\n人物：今日先按眼前去处推进',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps the real herb icon when the ambient preview falls back to inventory during the first second-water objective', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 59, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_MARKET_RESTOCK_FLAG);
    state.player.flags.add(FIRST_SECOND_SOW_FLAG);
    mutateItem(state.player, 'herb.mossling', 2);
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '凡间青苔',
      details: '随身背包\n数量 × 2\n首轮目标：补种后的新苗先浇水，稳住种田备战节奏。',
      assetId: 'icon.herb.mossling'
    });
  });

  it('routes the ambient fallback preview to the array-shed thread when breakthrough is ready', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 71, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.position = { x: 0, y: 0 };
    state.player.facing = 'left';
    state.player.stage = 1;
    state.player.bodyFoundation = stageQiCap(state.player.stage, DEFAULT_BALANCE);
    state.player.cultivation = state.player.bodyFoundation;

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '阵器棚',
      details: '阵核、符炉与农庄小阵修补处。\n去向：今日以常规来往为主\n现在来：体魄已至极限，缺承雷丹｜阵法未成(0/2)｜准备度0%｜先补承雷丹与两座阵法。\n要务：备劫：缺承雷丹｜阵法未成(0/2)｜准备度0%｜先补承雷丹与两座阵法。\n去处：阵法布设 -> 查看阵法\n人物：今日先按眼前去处推进',
      assetId: 'loc.array-shed'
    });
  });

  it('keeps front-tile preview priority even when breakthrough is ready', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 72, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.stage = 1;
    state.player.bodyFoundation = stageQiCap(state.player.stage, DEFAULT_BALANCE);
    state.player.cultivation = state.player.bodyFoundation;
    state.player.position = { x: 1, y: 1 };
    state.player.facing = 'right';

    const tile = state.tiles.find(entry => entry.x === 2 && entry.y === 1);
    if (!tile) throw new Error('missing tile');
    tile.blockType = 'none';
    tile.soilType = 'loam';
    tile.tilled = false;

    expect(ambientPanelPreview(state, reg, false)).toEqual({
      title: '未翻土地',
      details: '面前地块\n土质：普通壤土\n先翻地，再播种',
      assetId: 'tile.loam'
    });
  });

  it('switches the ambient inventory-side preview to farmstead art during the first second-sow objective', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 63, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_MARKET_RESTOCK_FLAG);
    mutateItem(state.player, 'seed.dewroot', 2);

    expect(ambientPanelPreview(state, reg, true)).toEqual({
      title: '露根草种子',
      details: '随身背包\n数量 × 2\n首轮目标：回农庄补播，让第二轮药材不断档。',
      assetId: 'loc.farmstead'
    });
  });
});
