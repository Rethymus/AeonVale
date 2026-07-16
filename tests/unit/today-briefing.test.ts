import { describe, expect, it } from 'vitest';
import { buildTodayBriefing, todayBriefingFarmFocusAssetId } from '@app/todayBriefing';
import { onboardingHelpText } from '@app/onboardingObjective';
import { createSimContext, createWorld, DEFAULT_BALANCE, getActiveSpecialOrders, getCurrentMainlineQuest, getCurrentStayingWorldIncident, getDailyCommission, getDailySpecialOrder, getPrimaryStayingWorldGoal, type GameState, type SimContext } from '@sim';
import { buildRegistry } from '@content/registry';
import { FIRST_HARVEST_FLAG, FIRST_SECOND_WATER_FLAG, FIRST_SHIPMENT_FLAG, FIRST_SHIPPING_SETTLEMENT_FLAG } from '@sim/story/onboarding';
import { stageQiCap } from '@sim/progression/progression';

function makeBreakthroughReady(state: GameState): void {
  state.player.stage = 1;
  const cap = stageQiCap(state.player.stage, DEFAULT_BALANCE);
  state.player.bodyFoundation = cap;
  state.player.cultivation = cap;
}

function addActiveArray(state: GameState, id: number): void {
  state.arrays.set(id, {
    id,
    defId: id % 2 === 0 ? 'array.insulation' : 'array.lightning-rod',
    modifier: 1,
    coreTileId: id,
    coverageTileIds: [],
    power: 100,
    active: true
  });
}

function setup(seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

function clearCarriedSeeds(state: GameState): void {
  for (const itemId of Object.keys(state.player.inventory)) {
    if (itemId.startsWith('seed.')) delete state.player.inventory[itemId];
  }
}

describe('今日简报', () => {
  it('优先把首轮引导目标固定在简报首行，并给出当前最短动线', () => {
    const { state, ctx } = setup();
    const briefing = buildTodayBriefing(state, ctx, '当前目标：先翻出一块地。');
    const [headline = '', progress = '', purpose = '', payoff = '', action = '', route = ''] = briefing.body.split('\n');

    expect(briefing.title).toBe('今日简报');
    expect(headline).toBe('目标：先翻出一块地。');
    expect(progress).toBe('首轮进度：1/10 灵草→灵石→补种→备劫');
    expect(purpose).toBe('意义：这块田会产出炼丹、布阵和引劫的第一批资源。');
    expect(payoff).toBe('回报：开出第一块灵田，后面才有药材、灵石和备劫材料。');
    expect(action).toBe('操作：站到空地前，按 空格 / E 翻地。');
    expect(route).toBe('动线：先留在农庄，从任意一块空地起手。');
    expect(briefing.assetId).toBe('logo.full');
  });

  it('仅在新档首日首个翻地目标时，今日简报才使用 logo 作为欢迎主视觉', () => {
    const { state, ctx } = setup();

    expect(buildTodayBriefing(state, ctx, '当前目标：先翻出一块地。').assetId).toBe('logo.full');

    state.day = 2;
    expect(buildTodayBriefing(state, ctx, '当前目标：先翻出一块地。').assetId).toBe('loc.herb-plot');
  });

  it('在首轮播种与浇水引导中，会优先使用对应实物资产而不是继续停留在地点总览图', () => {
    const { state, ctx } = setup(118);

    const tile = state.tiles[0]!;
    tile.tilled = true;

    let briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-sow'));
    expect(briefing.assetId).toBe('icon.seed.mossling');

    tile.cropId = tile.id;
    tile.wateredToday = false;
    tile.moisture = 20_000;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.mossling',
      tileId: tile.id,
      growth: 10_000,
      health: 100_000,
      stage: 'growing',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });

    briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-water'));
    expect(briefing.assetId).toBe('icon.item.water-pail');
  });

  it('传入多行 onboarding help text 时，简报首行只显示当前目标 headline', () => {
    const { state, ctx } = setup();
    const briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-till'));
    const [headline = '', progress = '', purpose = '', payoff = '', action = '', route = ''] = briefing.body.split('\n');

    expect(headline).toBe('目标：先翻出一块地。');
    expect(progress).toBe('首轮进度：1/10 灵草→灵石→补种→备劫');
    expect(purpose).toBe('意义：这块田会产出炼丹、布阵和引劫的第一批资源。');
    expect(payoff).toBe('回报：开出第一块灵田，后面才有药材、灵石和备劫材料。');
    expect(action).toBe('操作：站到空地前，按 空格 / E 翻地。');
    expect(route).toBe('动线：先留在农庄，从任意一块空地起手。');
  });

  it('首轮 onboarding 简报始终把农务意义接到修仙核心循环', () => {
    const { state, ctx } = setup();
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    const briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-loop-complete'));

    expect(briefing.body).toContain('意义：稳定农务后，灵草会持续转成丹药、阵法与抗劫底气。');
    expect(briefing.body).toContain('回报：日常循环已成立，下一步可以把药材投入炼丹、设施和引劫准备。');
    expect(briefing.body).toContain('操作：继续补种浇水；有余货时按 Shift+M 打开农庄加工或阵法面板。');
    expect(briefing.body).toContain('动线：农务闭环已成，回农庄按 Shift+M 进入加工或阵法入口，把余货转成炉料与防线。');
  });

  it('首轮里程碑简报仍保留修仙回报，让试玩访客看懂下一步价值', () => {
    const { state, ctx } = setup(101);
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

    const briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-harvest'));
    const lines = briefing.body.split('\n');

    expect(lines[0]).toBe('目标：继续照料，收下第一株成熟灵草。');
    expect(lines[1]).toBe('首轮进度：4/10 灵草→灵石→补种→备劫');
    expect(lines[2]).toBe('里程碑：第一株灵草已经成熟，收下它，首轮农务才算真正开始兑现。');
    expect(lines[3]).toBe('意义：第一株成熟灵草会把种田接到炼丹、出货和备劫。');
    expect(lines[4]).toBe('回报：收下灵草后，可以选择出货换灵石，也能留作炼丹库存。');
  });

  it('首轮里程碑判断跟随 onboarding 阶段状态，而不依赖外部目标文案措辞', () => {
    const { state, ctx } = setup(99);
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

    const harvestBriefing = buildTodayBriefing(state, ctx, '当前目标：继续照料这块田，成熟后记得处理。');
    const harvestLines = harvestBriefing.body.split('\n');
    expect(harvestLines[1]).toBe('首轮进度：4/10 灵草→灵石→补种→备劫');
    expect(harvestLines[2]).toBe('里程碑：第一株灵草已经成熟，收下它，首轮农务才算真正开始兑现。');

    state.player.flags.add(FIRST_HARVEST_FLAG);
    state.player.flags.add(FIRST_SHIPMENT_FLAG);
    state.player.flags.add(FIRST_SHIPPING_SETTLEMENT_FLAG);
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);

    const loopBriefing = buildTodayBriefing(state, ctx, '当前目标：今天继续稳住节奏，有余力再做别的。');
    const loopLines = loopBriefing.body.split('\n');
    expect(loopLines[1]).toBe('首轮进度：10/10 灵草→灵石→补种→备劫');
    expect(loopLines[2]).toBe('里程碑：首轮农务闭环已跑通，按 Shift+M 把余货接入加工、阵法与备劫。');
  });

  it('在非留世状态下优先提示当前主线，再补农务焦点与后续线索', () => {
    const { state, ctx } = setup();
    const mainline = getCurrentMainlineQuest(state);
    const briefing = buildTodayBriefing(state, ctx, '');
    const lines = briefing.body.split('\n');
    const [headline = '', farmFocus = '', followUp = ''] = lines;

    expect(mainline).not.toBeNull;
    expect(headline).toBe(`主线：${mainline!.title}${mainline!.completed ? '（可领）' : ''}`);
    expect(farmFocus.startsWith('农务：')).toBe(true);
    expect(followUp).toBe(`推进：${mainline!.objective}`);
    expect(lines.at(-1)).toBe('优先级：主线 > 农务 > 订单 > 社交');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在存在更高优先级提醒时，仍会用额外一行补出今天最值得跑的人情地点', () => {
    const { state, ctx } = setup();
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.season = 'summer';
    state.seasonDay = 8;

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', farmFocus = '', followUp = '', socialLine = ''] = briefing.body.split('\n');

    expect(headline.startsWith('主线：')).toBe(true);
    expect(farmFocus.startsWith('农务：')).toBe(true);
    expect(followUp.startsWith('推进：')).toBe(true);
    expect(socialLine).toBe('溪边药田：采药女 今日生辰，带礼更值');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在留世状态下按镇守事件、镇守事务、差事、留世目标的优先级给出提醒', () => {
    const { state, ctx } = setup();
    state.postAscension.mode = 'stayed-in-world';
    const incident = getCurrentStayingWorldIncident(state);
    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    const commission = getDailyCommission(state);
    const goal = getPrimaryStayingWorldGoal(state);
    const briefing = buildTodayBriefing(state, ctx, '');
    const lines = briefing.body.split('\n');
    const [headline = '', farmFocus = '', followUp = ''] = lines;

    if (incident) {
      expect(headline).toBe(`镇守：${incident.title}`);
      expect(lines.at(-1)).toBe('优先级：镇守事件 > 农务 > 差事 > 闲居');
    } else if (activeOrder) {
      expect(headline).toBe(`镇守：${activeOrder.title}（余 ${activeOrder.remaining}）`);
      expect(lines.at(-1)).toBe('优先级：镇守事务 > 农务 > 差事 > 闲居');
    } else if (commission) {
      expect(headline).toBe(`差事：${commission.title}`);
      expect(lines.at(-1)).toBe('优先级：差事 > 农务 > 闲居 > 社交');
    } else {
      expect(headline).toBe(`留世：${goal?.title}`);
      expect(lines.at(-1)).toBe('优先级：留世目标 > 农务 > 差事 > 社交');
    }
    expect(farmFocus.startsWith('农务：')).toBe(true);
    expect(followUp.startsWith('处置：') || followUp.startsWith('镇守：') || followUp.startsWith('差事：') || followUp.startsWith('闲居：')).toBe(true);
    if (incident) expect(briefing.assetId).toBeTruthy;
    else if (activeOrder || commission || goal) expect(briefing.assetId).toBeTruthy;
  });

  it('在存在成熟作物时优先把收获作为农务焦点', () => {
    const { state, ctx } = setup();
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

    const briefing = buildTodayBriefing(state, ctx, '');
    const lines = briefing.body.split('\n');
    const [, farmFocus = ''] = lines;

    expect(farmFocus).toBe('农务：先收 1 株成熟灵草');
    expect(lines.at(-1)).toBe('优先级：农务 > 主线 > 订单 > 社交');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在田间无更急事项时，会把待收设施抬为今日简报的农庄焦点', () => {
    const { state, ctx } = setup(45);
    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: state.tiles[0]!.id,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
    });

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：先收 1 座已完成设施');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.drying-yard');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在封藏柜先于炼符炉被遍历时，今日简报仍优先指向阵器棚线程', () => {
    const { state, ctx } = setup(48);
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
      job: { inputItemId: 'herb.metalpine', outputItemId: 'item.ward-powder', outputCount: 1, daysRemaining: 0 }
    });

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：先收 2 座已完成设施');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.array-shed');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在无田间焦点且出货待结时，会把经营焦点收回农庄根入口', () => {
    const { state, ctx } = setup(46);
    state.shippingBin['herb.mossling'] = 2;

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：先清 1 项待结出货');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.farmstead');
  });

  it('在已翻空地但身上没有种子时，今日简报改为提示先去集市补种', () => {
    const { state, ctx } = setup(56);
    clearCarriedSeeds(state);
    const tile = state.tiles[0]!;
    tile.blockType = 'none';
    tile.soilType = 'loam';
    tile.tilled = true;

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：已翻 1 块空田，先去集市补种子');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.valley-market');
    expect(briefing.assetId).toBe('loc.valley-market');
  });

  it('在无更高优先提醒覆盖时，会把农庄后勤阻塞补进今日简报末行', () => {
    const { state, ctx } = setup(47);
    state.shippingBin['herb.mossling'] = 2;
    state.storage.capacity = 1;
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = '', followUp = '', logistics = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：先清 1 项待结出货');
    expect(followUp.startsWith('推进：')).toBe(true);
    expect(logistics).toBe('后勤：出货箱待结 1 项｜仓储已满');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在田间农务成为今日简报焦点时，会把入口图收敛到药圃地点图', () => {
    const { state, ctx } = setup(41);
    const tile = state.tiles[0]!;
    tile.tilled = true;
    tile.cropId = tile.id;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.dewroot',
      tileId: tile.id,
      growth: 100_000,
      health: 100_000,
      stage: 'mature',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.herb-plot');
  });

  it('在补水、补灵、补种与翻地这类入口层农务上，今日简报也保持药圃地点图语义', () => {
    const { state, ctx } = setup(43);
    const dryTile = state.tiles[0]!;
    dryTile.tilled = true;
    dryTile.cropId = dryTile.id;
    dryTile.wateredToday = false;
    dryTile.moisture = 10_000;
    state.crops.set(dryTile.id, {
      id: dryTile.id,
      defId: 'herb.dewroot',
      tileId: dryTile.id,
      growth: 30_000,
      health: 100_000,
      stage: 'growing',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });

    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.herb-plot');

    dryTile.wateredToday = true;
    dryTile.moisture = 60_000;
    dryTile.channeledToday = false;
    dryTile.qiDensity = 10_000;

    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.herb-plot');

    state.crops.clear();
    dryTile.cropId = null;
    dryTile.tilled = true;
    state.player.inventory['seed.dewroot'] = { itemId: 'seed.dewroot', count: 3 };
    state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 1 };

    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.herb-plot');

    dryTile.tilled = false;
    delete state.player.inventory['seed.dewroot'];
    delete state.player.inventory['seed.mossling'];

    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.herb-plot');
  });

  it('在田间与后勤焦点切换时，今日简报始终复用同一套农庄焦点优先级', () => {
    const { state, ctx } = setup(53);
    const tile = state.tiles[0]!;

    tile.tilled = true;
    tile.cropId = tile.id;
    tile.wateredToday = false;
    tile.moisture = 10_000;
    state.crops.set(tile.id, {
      id: tile.id,
      defId: 'herb.dewroot',
      tileId: tile.id,
      growth: 30_000,
      health: 100_000,
      stage: 'growing',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });

    let briefing = buildTodayBriefing(state, ctx, '');
    let [, farmFocus = ''] = briefing.body.split('\n');
    expect(farmFocus).toBe('农务：优先补水 1 块灵田');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.herb-plot');

    state.crops.clear();
    tile.cropId = null;
    tile.tilled = false;
    tile.soilType = 'scorched';
    briefing = buildTodayBriefing(state, ctx, '');
    [, farmFocus = ''] = briefing.body.split('\n');
    expect(farmFocus).toBe('农务：先翻新 1 块焦土地');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('tile.scorched');

    tile.soilType = 'loam';
    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: state.tiles[1]!.id,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
    });
    briefing = buildTodayBriefing(state, ctx, '');
    [, farmFocus = ''] = briefing.body.split('\n');
    expect(farmFocus).toBe('农务：先收 1 座已完成设施');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.drying-yard');
  });

  it('在田间没有更急事项但昨夜留有焦土时，会把翻新焦土抬成今日农务焦点', () => {
    const { state, ctx } = setup(44);
    const scorchedTile = state.tiles[0]!;
    scorchedTile.blockType = 'none';
    scorchedTile.soilType = 'scorched';
    scorchedTile.tilled = false;

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：先翻新 1 块焦土地');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('tile.scorched');
    expect(briefing.assetId).toBe('tile.scorched');
  });

  it('在提醒层只剩农庄根入口时，会让更具体的农务焦点接管今日简报主视觉', () => {
    const { state, ctx } = setup(53);
    const scorchedTile = state.tiles[0]!;
    scorchedTile.blockType = 'none';
    scorchedTile.soilType = 'scorched';
    scorchedTile.tilled = false;

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', farmFocus = ''] = briefing.body.split('\n');

    expect(headline.startsWith('主线：')).toBe(true);
    expect(farmFocus).toBe('农务：先翻新 1 块焦土地');
    expect(briefing.assetId).toBe('tile.scorched');
  });

  it('在首笔出货结清后，会把补货前的里程碑感放进简报而不新增系统提示层', () => {
    const { state, ctx } = setup(11);
    state.player.flags.add(FIRST_SHIPPING_SETTLEMENT_FLAG);

    const briefing = buildTodayBriefing(state, ctx, '当前目标：去山谷集市补几颗种子，把第二轮药材接上。');
    const [headline = '', progress = '', milestone = '', purpose = '', payoff = '', action = '', route = ''] = briefing.body.split('\n');

    expect(headline).toBe('目标：去山谷集市补几颗种子，把第二轮药材接上。');
    expect(progress).toBe('首轮进度：7/10 灵草→灵石→补种→备劫');
    expect(milestone).toBe('里程碑：第一笔出货已经换回灵石，先去集市补种，把第二轮接上。');
    expect(purpose).toBe('意义：补种把一次收获变成稳定经营，后续才有炼丹库存。');
    expect(payoff).toBe('回报：补到新种子后，农庄能立刻接上第二轮药材生产。');
    expect(action).toBe('操作：按 Shift+Tab 打开地点目录，选集市服务后确认补种。');
    expect(route).toBe('动线：先去山谷集市补种，再回农庄接上第二轮。');
    expect(briefing.assetId).toBe('loc.valley-market');
  });

  it('在补种回田与第二轮浇水阶段，会把今日简报入口图固定在药圃线程', () => {
    const { state, ctx } = setup(116);

    let briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-second-sow'));
    expect(briefing.assetId).toBe('loc.herb-plot');

    briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-second-water'));
    expect(briefing.assetId).toBe('loc.herb-plot');

    briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-loop-complete'));
    expect(briefing.assetId).toBe('loc.herb-plot');
  });

  it('在第一株成熟待收时，会把首轮真正开始兑现的里程碑感写进简报', () => {
    const { state, ctx } = setup(15);

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

    const briefing = buildTodayBriefing(state, ctx, '当前目标：继续照料，收下第一株成熟灵草。');
    const [headline = '', progress = '', milestone = '', purpose = '', payoff = '', action = '', route = ''] = briefing.body.split('\n');

    expect(headline).toBe('目标：继续照料，收下第一株成熟灵草。');
    expect(progress).toBe('首轮进度：4/10 灵草→灵石→补种→备劫');
    expect(milestone).toBe('里程碑：第一株灵草已经成熟，收下它，首轮农务才算真正开始兑现。');
    expect(purpose).toBe('意义：第一株成熟灵草会把种田接到炼丹、出货和备劫。');
    expect(payoff).toBe('回报：收下灵草后，可以选择出货换灵石，也能留作炼丹库存。');
    expect(action).toBe('操作：先照料灵田，成熟后面向作物按 V 收获。');
    expect(route).toBe('动线：先稳住日常照料，等第一株灵草成熟再收。');
    expect(briefing.assetId).toBe('loc.herb-plot');
  });

  it('在引导目标仍属农庄根线程但田间已有更具体焦点时，今日简报入口图优先承接真实农务线程', () => {
    const { state, ctx } = setup(115);
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

    const briefing = buildTodayBriefing(state, ctx, onboardingHelpText('first-harvest'));

    expect(briefing.assetId).toBe('loc.herb-plot');
  });

  it('在第一株已投箱待结算时，会把过夜结算的阶段感写进简报', () => {
    const { state, ctx } = setup(17);
    state.player.flags.add(FIRST_SHIPMENT_FLAG);

    const briefing = buildTodayBriefing(state, ctx, '当前目标：按 Enter 过夜，等次日结算换回灵石。');
    const [headline = '', progress = '', milestone = '', purpose = '', payoff = '', action = '', route = ''] = briefing.body.split('\n');

    expect(headline).toBe('目标：按 Enter 过夜，等次日结算换回灵石。');
    expect(progress).toBe('首轮进度：6/10 灵草→灵石→补种→备劫');
    expect(milestone).toBe('里程碑：第一株灵草已经投进出货箱，先过夜，把第一笔灵石结回来。');
    expect(purpose).toBe('意义：过夜结算会证明农务不是装饰，而是资源循环。');
    expect(payoff).toBe('回报：结算后的灵石会直接支持补种，把一次收获变成循环。');
    expect(action).toBe('操作：确认今日农务已收尾，直接按 Enter 过夜。');
    expect(route).toBe('动线：把今日农务收尾，直接过夜等次日结算。');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在第一株成熟待投箱时，会把今日简报入口图收敛到出货箱而非农庄总图', () => {
    const { state, ctx } = setup(18);
    state.player.flags.add(FIRST_HARVEST_FLAG);

    const briefing = buildTodayBriefing(state, ctx, '当前目标：把第一株灵草投进出货箱。');

    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在农庄仓储已满时，今日简报入口仍优先承接农庄地点图', () => {
    const { state, ctx } = setup(52);
    state.storage.capacity = 1;
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };

    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.farmstead');
  });

  it('在仅有封藏柜完工时，今日简报仍把根层入口收回农庄总图', () => {
    const { state, ctx } = setup(54);
    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: state.tiles[0]!.id,
      job: { inputItemId: 'herb.dewroot', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 }
    });

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：先收 1 座已完成设施');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.farmstead');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在首轮闭环成立后，会把闭环完成感写进简报', () => {
    const { state, ctx } = setup(13);
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);

    const briefing = buildTodayBriefing(state, ctx, '当前目标：第二轮药材动线已成立，继续照料新苗、卖余货，或再扩一小片田。');
    const [headline = '', progress = '', milestone = '', purpose = '', payoff = '', action = '', route = ''] = briefing.body.split('\n');

    expect(headline).toBe('目标：第二轮药材动线已成立，继续照料新苗、卖余货，或再扩一小片田。');
    expect(progress).toBe('首轮进度：10/10 灵草→灵石→补种→备劫');
    expect(milestone).toBe('里程碑：首轮农务闭环已跑通，按 Shift+M 把余货接入加工、阵法与备劫。');
    expect(purpose).toBe('意义：稳定农务后，灵草会持续转成丹药、阵法与抗劫底气。');
    expect(payoff).toBe('回报：日常循环已成立，下一步可以把药材投入炼丹、设施和引劫准备。');
    expect(action).toBe('操作：继续补种浇水；有余货时按 Shift+M 打开农庄加工或阵法面板。');
    expect(route).toBe('动线：农务闭环已成，回农庄按 Shift+M 进入加工或阵法入口，把余货转成炉料与防线。');
    expect(briefing.assetId).toBe('loc.herb-plot');
  });

  it('即使农务焦点变为收获，非留世状态仍保持主线资产优先级', () => {
    const { state, ctx } = setup(7);
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

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', farmFocus = ''] = briefing.body.split('\n');

    expect(headline.startsWith('主线：')).toBe(true);
    expect(farmFocus).toBe('农务：先收 1 株成熟灵草');
    expect(briefing.assetId).toBe('loc.farmstead');
  });

  it('在已可主动引劫时，今日简报优先把引劫准备抬成最高频提醒并回到阵坊线程', () => {
    const { state, ctx } = setup(71);
    makeBreakthroughReady(state);

    const briefing = buildTodayBriefing(state, ctx, '');
    const lines = briefing.body.split('\n');
    const [headline = '', farmFocus = '', followUp = ''] = lines;

    expect(headline).toBe('引劫：体魄已至极限，今日先按 T 主动引劫。');
    expect(farmFocus.startsWith('农务：')).toBe(true);
    expect(followUp).toBe('备劫：缺避雷丹｜阵法未成(0/2)｜准备度0%｜先补避雷丹与两座阵法。');
    expect(lines.at(-1)).toBe('优先级：备劫 > 农务 > 委托 > 社交');
    expect(briefing.assetId).toBe('loc.array-shed');
  });

  it('在已可主动引劫且有丹无满阵时，今日简报提示补阵而不是泛化催引劫', () => {
    const { state, ctx } = setup(73);
    makeBreakthroughReady(state);
    state.player.inventory['pill.ward-basic'] = { itemId: 'pill.ward-basic', count: 1 };
    addActiveArray(state, 1);

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, , followUp = ''] = briefing.body.split('\n');

    expect(followUp).toBe('备劫：丹药已备｜阵法未成(1/2)｜准备度80%｜先补引雷/绝缘阵再引劫。');
    expect(briefing.assetId).toBe('loc.array-shed');
  });

  it('在已可主动引劫且丹阵齐备时，今日简报明确准备度已满', () => {
    const { state, ctx } = setup(74);
    makeBreakthroughReady(state);
    state.player.wardMitigation = 0.35;
    addActiveArray(state, 1);
    addActiveArray(state, 2);

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, , followUp = ''] = briefing.body.split('\n');

    expect(followUp).toBe('备劫：丹药已备｜阵法已成(2/2)｜准备度100%｜可引劫，仍可先服丹确认。');
    expect(briefing.assetId).toBe('loc.array-shed');
  });

  it('在已可主动引劫时，即使田间已有更具体农务焦点，今日简报主视觉仍优先回到阵坊线程', () => {
    const { state, ctx } = setup(72);
    makeBreakthroughReady(state);
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

    const briefing = buildTodayBriefing(state, ctx, '');
    const [, farmFocus = ''] = briefing.body.split('\n');

    expect(farmFocus).toBe('农务：先收 1 株成熟灵草');
    expect(todayBriefingFarmFocusAssetId(state, ctx)).toBe('loc.herb-plot');
    expect(briefing.assetId).toBe('loc.array-shed');
  });

  it('在山谷立名主线阶段，会把今日简报入口图收敛到溪边药田而非人物肖像', () => {
    const { state, ctx } = setup(19);
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('主线：山谷立名');
    expect(followUp).toBe('推进：完成特别订单“淬体药草储备”，证明你已能稳定供应炼体资源。');
    expect(briefing.assetId).toBe('loc.creek-field');
  });

  it('在药草入骨主线阶段，会把今日简报入口图收敛到露根药圃而非药草图标', () => {
    const { state, ctx } = setup(31);
    state.flags.add('mainline-quest:mainline.mortal-discipline');

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('主线：药草入骨');
    expect(followUp).toBe('推进：持有青苔与露根草各 1 份，证明灵田已能支撑早期淬体。');
    expect(briefing.assetId).toBe('loc.herb-plot');
  });

  it('在残卷寻脉主线阶段，会把今日简报入口图收敛到遗迹门口而非残篇图标', () => {
    const { state, ctx } = setup(33);
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('主线：残卷寻脉');
    expect(followUp).toBe('推进：完成 1 次藏经阁捐献，拿到第一条关于古体修的线索。');
    expect(briefing.assetId).toBe('loc.ruin-gate');
  });

  it('在主线已完成待领取时，今日简报仍保持地点入口图而非奖励物图标', () => {
    const { state, ctx } = setup(35);
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.player.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: 1 };
    state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 1 };

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('主线：药草入骨（可领）');
    expect(followUp).toBe('主线：已满足条件，回人物面板领取本次主线奖励。');
    expect(briefing.assetId).toBe('loc.herb-plot');
  });

  it('在存在特别订单但无主线时，会给出具体订单补齐提示与对应资产', () => {
    const { state, ctx } = setup(21);
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');
    state.specialOrders['special-order.array-scrap'] = {
      id: 'special-order.array-scrap',
      progress: 1,
      daysLeft: 7,
      acceptedDay: state.day
    };

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('订单：旧阵残件清点（余 2）');
    expect(followUp).toBe('订单：破损法宝 还差 2 份，先补齐再回执。');
    expect(briefing.assetId).toBe('loc.ruin-gate');
  });

  it('在特别订单已齐待回执时，会把今日简报入口图收敛到对应地点', () => {
    const { state, ctx } = setup(23);
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');
    state.specialOrders['special-order.array-scrap'] = {
      id: 'special-order.array-scrap',
      progress: 3,
      daysLeft: 7,
      acceptedDay: state.day
    };

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('订单：旧阵残件清点（余 0）');
    expect(followUp).toBe('订单：已齐，返回告示板领取酬劳。');
    expect(briefing.assetId).toBe('loc.ruin-gate');
  });

  it('在仅剩公告委托时，会把今日简报入口图收敛到交付地点而非请求物图标', () => {
    const { state, ctx } = setup(27);
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');
    state.flags.add('special-order-complete:special-order.herb-stockpile');
    state.flags.add('special-order-complete:special-order.array-scrap');
    state.flags.add('special-order-complete:special-order.beast-watch');

    const commission = getDailyCommission(state);
    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(commission).not.toBeNull;
    expect(headline).toBe(`委托：${commission!.title}`);
    expect(followUp).toBe(`委托：备齐 露根草 × 2，去露根药圃交付。`);
    expect(briefing.assetId).toBe('loc.herb-plot');
  });

  it('在仅剩待接特别订单时，会把今日简报入口图收敛到对应地点而非请求物图标', () => {
    const { state, ctx } = setup(29);
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');

    const specialOrder = getDailySpecialOrder(state);
    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(specialOrder).not.toBeNull;
    expect(headline).toBe(`订单：${specialOrder!.title}`);
    expect(followUp).toBe(`动线：先接“${specialOrder!.title}”，再围绕 凡间青苔 安排采集或种植。`);
    expect(briefing.assetId).toBe('loc.creek-field');
  });

  it('在无更高优先提醒时，未来节庆仍使用节日会场地点图', () => {
    const { state, ctx } = setup(71);
    state.player.stage = -1 as GameState['player']['stage'];
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');
    state.flags.add('special-order-complete:special-order.herb-stockpile');
    state.flags.add('special-order-complete:special-order.array-scrap');
    state.flags.add('special-order-complete:special-order.beast-watch');
    state.season = 'spring';
    state.seasonDay = 10;

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('将至：4日后·春14 灵芽节');
    expect(followUp).toBe('将至：4日后·春14 灵芽节');
    expect(briefing.assetId).toBe('loc.festival-ground');
  });

  it('在无更高优先提醒且未来只剩生辰时，会把今日简报入口图收敛到对应人物地点', () => {
    const { state, ctx } = setup(72);
    state.player.stage = -1 as GameState['player']['stage'];
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');
    state.flags.add('special-order-complete:special-order.herb-stockpile');
    state.flags.add('special-order-complete:special-order.array-scrap');
    state.flags.add('special-order-complete:special-order.beast-watch');
    state.season = 'summer';
    state.seasonDay = 4;

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('将至：4日后·夏8 采药女生辰');
    expect(followUp).toBe('将至：4日后·夏8 采药女生辰');
    expect(briefing.assetId).toBe('loc.creek-field');
  });

  it('在留世状态下会优先把当日镇守事件转换为具体处置提示', () => {
    const { state, ctx } = setup(25);
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day - 2;
    state.social['npc.array-smith'] = { affection: 0, lastGiftDay: 0 };
    state.social['npc.herb-gatherer'] = { affection: 0, lastGiftDay: 0 };
    state.social['npc.wandering-cultivator'] = { affection: 0, lastGiftDay: 0 };
    state.specialOrders = {};

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline.startsWith('镇守：')).toBe(true);
    expect(followUp.startsWith('处置：')).toBe(true);
    expect(briefing.assetId).toBe('loc.spirit-vein');
  });

  it('会把游方散修的兽核委托跟进文案对齐到残脉入口，而不是泛化成集市交付', () => {
    const { state, ctx } = setup(81);
    state.player.stage = 1;
    state.day = 4;
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');
    state.flags.add('special-order-complete:special-order.herb-stockpile');
    state.flags.add('special-order-complete:special-order.array-scrap');
    state.flags.add('special-order-complete:special-order.beast-watch');

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('委托：妖兽内丹样本');
    expect(followUp).toBe('委托：备齐 妖兽内丹 × 1，去残脉入口交付。');
    expect(briefing.assetId).toBe('loc.spirit-vein');
  });

  it('会把已齐的兽核特别订单提示到真实交付地点，保持与世界地标和地点信号一致', () => {
    const { state, ctx } = setup(82);
    state.player.stage = 1;
    state.flags.add('mainline-quest:mainline.mortal-discipline');
    state.flags.add('mainline-quest:mainline.herb-path');
    state.flags.add('mainline-quest:mainline.archive-clue');
    state.flags.add('mainline-quest:mainline.valley-order');
    state.flags.add('mainline-quest:mainline.defy-heaven');
    state.specialOrders['special-order.beast-watch'] = {
      id: 'special-order.beast-watch',
      progress: 2,
      daysLeft: 3,
      acceptedDay: state.day
    };

    const briefing = buildTodayBriefing(state, ctx, '');
    const [headline = '', , followUp = ''] = briefing.body.split('\n');

    expect(headline).toBe('订单：守田兽口粮试验（余 0）');
    expect(followUp).toBe('订单：已齐，去残脉入口交付。');
    expect(briefing.assetId).toBe('loc.spirit-vein');
  });
});
