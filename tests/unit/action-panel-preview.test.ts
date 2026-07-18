import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createSimContext, createWorld, DEFAULT_BALANCE, getCurrentNpcQuest, getNpcDailySchedules, getNpcList, UPGRADE_CATALOG, type GameState } from '@sim';
import { farmActionMenuPreview, farmActionMenuToastPresentation, npcActionMenuPreview, npcActionMenuToastPresentation, npcBrowsePanelPreview, npcBrowseToastPresentation, npcGiftPanelPreview, npcGiftResultToastPresentation, npcGiftToastPresentation, npcQuestPanelPreview, npcQuestResultToastPresentation, npcQuestToastPresentation, npcUnavailableToastPresentation } from '@app/actionPanelPreview';

function setup(seed = 11): { state: GameState; reg: ReturnType<typeof buildRegistry> } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  return { state, reg };
}

describe('action panel preview', () => {
  it('describes farm action menu summary for storage withdraw', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    const preview = farmActionMenuPreview('storage-withdraw', state, ctx);

    expect(preview).toEqual({
      title: '仓储-取出',
      details: '仓流整理\n仓占 0/48｜余 48 格\n为加工、出货与委托补货',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps storage and shipping root summaries anchored to the farmstead thread', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    expect(farmActionMenuPreview('storage-deposit', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('storage-withdraw', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('shipping-normal', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('shipping-quality', state, ctx).assetId).toBe('loc.farmstead');
  });

  it('keeps build and facility collect on the current farmstead root thread while processing stays root-level too', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: 0,
      job: null
    });
    state.storage.capacity = 1;
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };

    expect(farmActionMenuPreview('build', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('facility-collect', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('processing-drying', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('processing-sealing', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('processing-furnace', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('upgrade', state, ctx).assetId).toBe('loc.herb-plot');
  });

  it('keeps build aligned with the default herb-plot thread when that is the current farm focus', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(100, reg, DEFAULT_BALANCE);

    expect(farmActionMenuPreview('build', state, ctx).assetId).toBe('loc.herb-plot');
  });

  it('normalizes root farm-action previews back to farmstead when only a sealing cabinet is driving root pressure', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(101, reg, DEFAULT_BALANCE);

    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: 0,
      job: { inputItemId: 'item.dried-herb', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 }
    });

    expect(farmActionMenuPreview('build', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('upgrade', state, ctx).assetId).toBe('loc.herb-plot');
  });

  it('keeps processing root menu toast presentation on the farmstead thread', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    expect(farmActionMenuToastPresentation('processing-furnace', '（3/10）', '空格/E/回车进入·Esc返回', state, ctx)).toEqual({
      message: '农庄操作（3/10）：加工-熔炼｜数字1-0直达·Tab切换·空格/E/回车进入·Esc返回',
      assetId: 'loc.farmstead'
    });
  });

  it('reuses the next available upgrade art for the upgrade root toast', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    expect(farmActionMenuPreview('upgrade', state, ctx).assetId).toBe('loc.herb-plot');

    expect(farmActionMenuToastPresentation('upgrade', '（8/10）', '空格/E/回车进入·Esc返回', state, ctx)).toEqual({
      message: '农庄操作（8/10）：扩建｜数字1-0直达·Tab切换·空格/E/回车进入·Esc返回',
      assetId: 'loc.herb-plot'
    });
  });

  it('switches the upgrade root summary to the first available concrete upgrade asset when available', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    state.postAscension.mode = 'stayed-in-world';
    state.player.stage = 2;
    state.flags.add('upgrade.farmstead-expansion-1');
    state.flags.add('upgrade.farmstead-expansion-2');
    state.flags.add('upgrade.storage-ring-1');
    state.flags.add('upgrade.storage-ring-2');
    state.flags.add('upgrade.storage-ring-3');
    state.flags.add('upgrade.tool-hoe-1');
    state.flags.add('upgrade.tool-pail-1');
    state.flags.add('upgrade.tool-sickle-1');
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 999 };

    expect(farmActionMenuPreview('upgrade', state, ctx).assetId).toBe('sprite.guard-beast-wolf');
    expect(farmActionMenuToastPresentation('upgrade', '（8/10）', '空格/E/回车进入·Esc返回', state, ctx).assetId).toBe('sprite.guard-beast-wolf');
  });

  it('keeps the upgrade root summary on the current farmstead focus thread when no upgrades remain', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    for (const upgrade of UPGRADE_CATALOG) {
      state.flags.add(`upgrade.${upgrade.id}`);
    }

    state.storage.capacity = 1;
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };

    expect(farmActionMenuPreview('upgrade', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuToastPresentation('upgrade', '（8/10）', '空格/E/回车进入·Esc返回', state, ctx).assetId).toBe('loc.farmstead');
  });

  it('keeps the no-upgrade root summary on farmstead when sealing-cabinet readiness is the only root pressure', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(102, reg, DEFAULT_BALANCE);

    for (const upgrade of UPGRADE_CATALOG) {
      state.flags.add(`upgrade.${upgrade.id}`);
    }

    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: 0,
      job: { inputItemId: 'item.dried-herb', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 }
    });

    expect(farmActionMenuPreview('upgrade', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuToastPresentation('upgrade', '（8/10）', '空格/E/回车进入·Esc返回', state, ctx).assetId).toBe('loc.farmstead');
  });

  it('keeps the facility collect root toast on the farmstead thread even when concrete pickup work exists', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);
    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: 0,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
    });

    expect(farmActionMenuToastPresentation('facility-collect', '（2/10）', '空格/E/回车进入·Esc返回', state, ctx)).toEqual({
      message: '农庄操作（2/10）：设施收取｜数字1-0直达·Tab切换·空格/E/回车进入·Esc返回',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps facility collect summary anchored to the farmstead root even when nothing is ready yet', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);
    state.facilities.set(1, {
      id: 1,
      kind: 'talisman-furnace',
      tileId: 0,
      job: null
    });

    const preview = farmActionMenuPreview('facility-collect', state, ctx);

    expect(preview.assetId).toBe('loc.farmstead');
    expect(preview.details).toContain('已建 1 座');
    expect(preview.details).toContain('当前暂无待收产物，先等加工完成或继续安排农务');
  });

  it('explains whether facility collect is worth entering right now across empty, pending, and ready states', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(103, reg, DEFAULT_BALANCE);

    expect(farmActionMenuPreview('facility-collect', state, ctx).details).toContain('身旁暂无已建设施，可先去建造铺开经营位');

    state.facilities.set(1, {
      id: 1,
      kind: 'drying-rack',
      tileId: 0,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 1 }
    });

    expect(farmActionMenuPreview('facility-collect', state, ctx).details).toContain('当前暂无待收产物，先等加工完成或继续安排农务');

    state.facilities.set(2, {
      id: 2,
      kind: 'talisman-furnace',
      tileId: 1,
      job: { inputItemId: 'item.broken-artifact', outputItemId: 'item.array-core', outputCount: 1, daysRemaining: 0 }
    });

    expect(farmActionMenuPreview('facility-collect', state, ctx).details).toContain('优先巡看已完工设施，把这一轮产物收住');
  });

  it('prefers the most actionable built facility art when multiple idle facilities exist', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);
    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: 0,
      job: null
    });
    state.facilities.set(2, {
      id: 2,
      kind: 'talisman-furnace',
      tileId: 1,
      job: null
    });

    expect(farmActionMenuPreview('facility-collect', state, ctx).assetId).toBe('loc.farmstead');
  });

  it('prefers the most actionable ready facility art in facility collect summaries', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);
    state.facilities.set(1, {
      id: 1,
      kind: 'sealing-cabinet',
      tileId: 0,
      job: { inputItemId: 'item.dried-herb', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 }
    });
    state.facilities.set(2, {
      id: 2,
      kind: 'talisman-furnace',
      tileId: 1,
      job: { inputItemId: 'item.broken-artifact', outputItemId: 'item.array-core', outputCount: 1, daysRemaining: 0 }
    });

    expect(farmActionMenuPreview('facility-collect', state, ctx).assetId).toBe('loc.farmstead');
  });

  it('surfaces real storage and shipping pressure in farm action summaries', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(99, reg, DEFAULT_BALANCE);

    state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 2 };
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 3 };
    state.player.qualityInventory.spirit = { 'herb.mossling': 1 };
    state.storage.inventory['item.dried-herb'] = { itemId: 'item.dried-herb', count: 1 };
    state.shippingBin['seed.mossling'] = 1;
    state.qualityShippingBin.spirit = { 'herb.mossling': 1 };

    expect(farmActionMenuPreview('storage-deposit', state, ctx).details).toBe('仓流整理\n背包 2 格｜仓余 47 格\n先卸灵草材料，给采收、炼丹与布阵腾位');
    expect(farmActionMenuPreview('shipping-normal', state, ctx).details).toBe('日常回款\n可出 1 项｜已入箱 1 项\n回笼灵石，补种子、炉料与备劫消耗');
    expect(farmActionMenuPreview('shipping-quality', state, ctx).details).toBe('精品回款\n品质库存 1 项｜已入箱 1 项\n高品灵草优先换取更高阶修行资源');
    expect(farmActionMenuPreview('storage-deposit', state, ctx).assetId).toBe('loc.farmstead');
    expect(farmActionMenuPreview('shipping-normal', state, ctx).assetId).toBe('loc.farmstead');
  });

  it('connects farm action roots to the cultivation MVP loop', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(104, reg, DEFAULT_BALANCE);

    expect(farmActionMenuPreview('build', state, ctx).details).toContain('炼丹、布阵与备劫');
    expect(farmActionMenuPreview('processing-drying', state, ctx).details).toContain('炼丹与阵材前置');
    expect(farmActionMenuPreview('processing-sealing', state, ctx).details).toContain('丹药与订单底料');
    expect(farmActionMenuPreview('shipping-normal', state, ctx).details).toContain('备劫消耗');
  });

  it('describes npc action menu summary for gifts', () => {
    expect(npcActionMenuPreview('gift')).toEqual({
      title: '赠礼',
      details: '人物社交\n按偏好送出背包礼物\n提高好感并推进后续事件',
      assetId: 'sprite.npc.herb-gatherer'
    });
  });

  it('provides portrait asset ids for npc root menu modes', () => {
    expect(npcActionMenuPreview('browse').assetId).toBe('sprite.npc.wandering-cultivator');
    expect(npcActionMenuPreview('gift').assetId).toBe('sprite.npc.herb-gatherer');
    expect(npcActionMenuPreview('quest').assetId).toBe('sprite.npc.array-smith');
  });

  it('reuses npc root menu portrait art for toast presentation', () => {
    expect(npcActionMenuToastPresentation('quest', '（2/3）', '空格/E/回车进入·Esc返回')).toEqual({
      message: '人物操作（2/3）：人物任务｜数字1-3直达·Tab切换·空格/E/回车进入·Esc返回',
      assetId: 'sprite.npc.array-smith'
    });
  });

  it('prefers the currently selected npc portrait for root menu previews when available', () => {
    expect(npcActionMenuPreview('browse', 'npc.array-smith').assetId).toBe('sprite.npc.array-smith');
    expect(npcActionMenuPreview('gift', 'npc.herb-gatherer').assetId).toBe('sprite.npc.herb-gatherer');
    expect(npcActionMenuPreview('quest', 'npc.wandering-cultivator').assetId).toBe('sprite.npc.wandering-cultivator');
  });

  it('supports preview-only npc portraits in root menu previews', () => {
    expect(npcActionMenuPreview('browse', 'npc.tea-shed-elder').assetId).toBe('sprite.npc.tea-shed-elder');
    expect(npcActionMenuPreview('gift', 'npc.market-merchant').assetId).toBe('sprite.npc.market-merchant');
  });

  it('describes npc browse panel with schedule and birthday', () => {
    const { state } = setup();
    state.season = 'spring';
    state.seasonDay = 18;
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };
    const npc = getNpcList(state).find(entry => entry.id === 'npc.wandering-cultivator');
    const schedule = getNpcDailySchedules(state).find(entry => entry.npc.id === 'npc.wandering-cultivator') ?? null;
    const giftName = '灵石';

    const preview = npcBrowsePanelPreview(npc!, schedule, null, giftName);

    expect(preview.title).toBe('游方散修');
    expect(preview.details).toContain('交易｜好感 0/1000');
    expect(preview.details).toContain('山谷集市｜收购新芽与散修杂货');
    expect(preview.details).toContain('今日生辰｜赠礼收益翻倍');
    expect(preview.details).toContain('携礼：灵石｜今日生辰加成');
    expect(preview.details).toContain('现在可做：今日生辰，优先带礼去拜访。');
    expect(preview.assetId).toBe('sprite.npc.wandering-cultivator');
  });

  it('reuses npc browse preview portrait for toast presentation', () => {
    const { state } = setup();
    state.season = 'spring';
    state.seasonDay = 18;
    const npc = getNpcList(state).find(entry => entry.id === 'npc.wandering-cultivator');
    const schedule = getNpcDailySchedules(state).find(entry => entry.npc.id === 'npc.wandering-cultivator') ?? null;

    expect(npcBrowseToastPresentation(npc!, schedule, null, '（1/3）', '灵石')).toEqual({
      message: '人物（1/3）：游方散修｜Tab切换人物·Esc返回',
      assetId: 'sprite.npc.wandering-cultivator'
    });
  });

  it('keeps npc-unavailable failures anchored to the social browse thread', () => {
    expect(npcUnavailableToastPresentation()).toEqual({
      message: '今日暂无可访人物｜先按农庄与地点动线推进',
      assetId: 'sprite.npc.wandering-cultivator'
    });
  });

  it('switches npc browse panel to quest-driving guidance when a personal quest is available', () => {
    const { state } = setup();
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    state.season = 'spring';
    state.seasonDay = 6;
    const npc = getNpcList(state).find(entry => entry.id === 'npc.herb-gatherer');
    const schedule = getNpcDailySchedules(state).find(entry => entry.npc.id === 'npc.herb-gatherer') ?? null;
    const quest = getCurrentNpcQuest(state, 'npc.herb-gatherer');

    const preview = npcBrowsePanelPreview(npc!, schedule, quest);

    expect(preview.details).toContain('人物任务｜温骨识药');
    expect(preview.details).toContain('携礼：暂无合适礼物｜建议先补社交物资');
    expect(preview.details).toContain('现在可做：去露根药圃推进“温骨识药”。');
    expect(preview.assetId).toBe('sprite.npc.herb-gatherer');
  });

  it('describes npc gift panel without suitable gift', () => {
    const { state } = setup();
    const npc = getNpcList(state).find(entry => entry.id === 'npc.array-smith');

    const preview = npcGiftPanelPreview(npc!, null, false);

    expect(preview).toEqual({
      title: '阵匠老陆',
      details: '赠予 阵匠老陆\n暂无合适礼物\n建议先去集市、药圃或仓库补货',
      assetId: 'sprite.npc.array-smith'
    });
  });

  it('keeps npc gift root preview anchored to the receiving npc even when a suitable gift exists', () => {
    const reg = buildRegistry();
    const npc = { id: 'npc.wandering-cultivator', displayName: '游方散修' };

    const preview = npcGiftPanelPreview(npc, '灵石', true, 'item.spirit-stone', reg);

    expect(preview).toEqual({
      title: '游方散修',
      details: '当前最适礼物：灵石\n赠予 游方散修\n今日生辰｜好感收益翻倍',
      assetId: 'sprite.npc.wandering-cultivator'
    });
  });

  it('adds direct-send guidance in npc gift panel when a suitable gift exists on a normal day', () => {
    const reg = buildRegistry();
    const npc = { id: 'npc.herb-gatherer', displayName: '采药女' };

    const preview = npcGiftPanelPreview(npc, '露根草', false, 'herb.dewroot', reg);

    expect(preview).toEqual({
      title: '采药女',
      details: '当前最适礼物：露根草\n赠予 采药女\n背包已备好｜可直接赠礼',
      assetId: 'sprite.npc.herb-gatherer'
    });
  });

  it('falls back to preview-only npc portrait in gift preview when item icon is unavailable', () => {
    const reg = buildRegistry();
    const npc = { id: 'npc.market-merchant', displayName: '集市商贩' };

    const preview = npcGiftPanelPreview(npc, '未知货签', false, 'quest.unknown-token', reg);

    expect(preview).toEqual({
      title: '集市商贩',
      details: '当前最适礼物：未知货签\n赠予 集市商贩\n背包已备好｜可直接赠礼',
      assetId: 'sprite.npc.market-merchant'
    });
  });

  it('keeps npc gift selection toasts on the receiving npc instead of the gift icon', () => {
    const reg = buildRegistry();
    const npc = { id: 'npc.wandering-cultivator', displayName: '游方散修' };

    expect(npcGiftToastPresentation(npc, '灵石', true, '（2/3）', '空格/E/回车赠礼·Esc返回', 'item.spirit-stone', reg)).toEqual({
      message: '赠礼（2/3）：游方散修｜灵石｜Tab切换人物·空格/E/回车赠礼·Esc返回',
      assetId: 'sprite.npc.wandering-cultivator'
    });
  });

  it('keeps npc gift success item-led but returns failures to the receiving npc thread', () => {
    const reg = buildRegistry();
    const npc = { id: 'npc.wandering-cultivator', displayName: '游方散修' };

    expect(npcGiftResultToastPresentation(npc, 'success', '灵石', true, 160, 'item.spirit-stone', reg)).toEqual({
      message: '赠予游方散修灵石，好感 +160（生辰）',
      assetId: 'icon.item.spirit-stone'
    });
    expect(npcGiftResultToastPresentation(npc, 'failure', '灵石', false, undefined, 'item.spirit-stone', reg)).toEqual({
      message: '游方散修：今日已赠或物品不足',
      assetId: 'sprite.npc.wandering-cultivator'
    });
  });

  it('describes npc quest panel with objective when quest is active', () => {
    const { state } = setup();
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    const npc = getNpcList(state).find(entry => entry.id === 'npc.herb-gatherer');
    const quest = getCurrentNpcQuest(state, 'npc.herb-gatherer');

    const preview = npcQuestPanelPreview(npc!, quest);

    expect(preview.title).toBe('温骨识药');
    expect(preview.details).toContain('委托人 采药女');
    expect(preview.details).toContain('当前可做');
    expect(preview.details).toContain('持有露根草 4 份');
    expect(preview.assetId).toBe('sprite.npc.herb-gatherer');
  });

  it('keeps npc quest preview anchored to the quest-driving subject once the objective is complete', () => {
    const { state, reg } = setup();
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 4 };
    state.player.inventory['herb.mistfern'] = { itemId: 'herb.mistfern', count: 2 };
    state.player.bodyFoundation = 1200;
    const npc = getNpcList(state).find(entry => entry.id === 'npc.herb-gatherer');
    const quest = getCurrentNpcQuest(state, 'npc.herb-gatherer');

    const preview = npcQuestPanelPreview(npc!, quest, reg);

    expect(preview.title).toBe('温骨识药');
    expect(preview.details).toContain('已满足条件，可领取奖励');
    expect(preview.details).toContain('返回人物面板领取本次谢礼');
    expect(preview.assetId).toBe('sprite.npc.herb-gatherer');
  });

  it('keeps completed npc quest result toasts on the quest-driving subject instead of reward item art', () => {
    const { state, reg } = setup();
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 4 };
    state.player.inventory['herb.mistfern'] = { itemId: 'herb.mistfern', count: 2 };
    state.player.bodyFoundation = 1200;
    const npc = getNpcList(state).find(entry => entry.id === 'npc.herb-gatherer');
    const quest = getCurrentNpcQuest(state, 'npc.herb-gatherer');

    expect(npcQuestResultToastPresentation(npc!, quest, 'complete', reg)).toEqual({
      message: '采药女任务完成：温骨识药',
      assetId: 'sprite.npc.herb-gatherer'
    });
    expect(npcQuestResultToastPresentation(npc!, quest, 'failure', reg)).toEqual({
      message: '采药女任务领取失败：温骨识药',
      assetId: 'sprite.npc.herb-gatherer'
    });
  });

  it('reuses npc quest preview asset for toast presentation', () => {
    const { state, reg } = setup();
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    const npc = getNpcList(state).find(entry => entry.id === 'npc.herb-gatherer');
    const quest = getCurrentNpcQuest(state, 'npc.herb-gatherer');

    expect(npcQuestToastPresentation(npc!, quest, '（3/3）', '空格/E/回车推进·Esc返回', reg)).toEqual({
      message: '人物任务（3/3）：采药女｜温骨识药｜未完成｜Tab切换人物·空格/E/回车推进·Esc返回',
      assetId: 'sprite.npc.herb-gatherer'
    });
  });

  it('reuses npc quest preview assets for result toasts', () => {
    const { state, reg } = setup();
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    const npc = getNpcList(state).find(entry => entry.id === 'npc.herb-gatherer');
    const quest = getCurrentNpcQuest(state, 'npc.herb-gatherer');

    expect(npcQuestResultToastPresentation(npc!, quest, 'advance', reg, '雷酿护身')).toEqual({
      message: '采药女任务推进：温骨识药 → 雷酿护身',
      assetId: 'sprite.npc.herb-gatherer'
    });
    expect(npcQuestResultToastPresentation(npc!, quest, 'failure', reg)).toEqual({
      message: '采药女任务未成：温骨识药',
      assetId: 'sprite.npc.herb-gatherer'
    });
    expect(npcQuestResultToastPresentation(npc!, null, 'missing', reg)).toEqual({
      message: '采药女：暂无人物任务',
      assetId: undefined
    });
  });

  it('keeps other npc quest root panels anchored to the quest giver instead of request items', () => {
    const { state, reg } = setup();

    state.social['npc.array-smith'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:array-smith-160');
    const arraySmith = getNpcList(state).find(entry => entry.id === 'npc.array-smith');
    const arrayQuest = getCurrentNpcQuest(state, 'npc.array-smith');

    expect(npcQuestPanelPreview(arraySmith!, arrayQuest, reg).assetId).toBe('sprite.npc.array-smith');

    state.social['npc.wandering-cultivator'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:wandering-cultivator-160');
    const cultivator = getNpcList(state).find(entry => entry.id === 'npc.wandering-cultivator');
    const cultivatorQuest = getCurrentNpcQuest(state, 'npc.wandering-cultivator');

    expect(npcQuestPanelPreview(cultivator!, cultivatorQuest, reg).assetId).toBe('sprite.npc.wandering-cultivator');
  });

  it('falls back to npc portrait when quest reward has no icon mapping', () => {
    const reg = buildRegistry();
    const npc = { displayName: '阵匠老陆' };
    const preview = npcQuestPanelPreview(
      npc,
      {
        id: 'npc-quest.debug-fallback',
        npcId: 'npc.array-smith',
        title: '测试任务',
        description: '测试',
        objective: '提交未知信物',
        reward: { itemId: 'quest.unknown-token', count: 1 },
        npcName: '阵匠老陆',
        claimed: false,
        available: true,
        completed: false,
        current: true,
        isAvailable: () => true,
        isComplete: () => false
      },
      reg
    );

    expect(preview.assetId).toBe('sprite.npc.array-smith');
  });

  it('keeps no-quest preview text-only so caller can retain portrait fallback', () => {
    const reg = buildRegistry();
    const preview = npcQuestPanelPreview({ displayName: '游方散修' }, null, reg);

    expect(preview).toEqual({
      title: '游方散修',
      details: '人物任务\n暂无可推进任务\n先提升好感或完成前置条件'
    });
  });
});
