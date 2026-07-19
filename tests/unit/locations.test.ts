import { describe, expect, it } from 'vitest';
import { createWorld, DEFAULT_BALANCE, FIRST_MARKET_RESTOCK_FLAG, FIRST_SECOND_WATER_FLAG, FIRST_SHIPPING_SETTLEMENT_FLAG, getActiveLocationDirectory, getLocationDirectory, getLocationEncounters, getLocationServiceAvailability, getLocationServiceOptions, getPreferredLocationSelection, getQuickLocationServiceOption, locationIdForDisplayName, locationIndexFromDigitCode, locationServiceIndexFromDigitKey, locationSummary, type GameState } from '@sim';
import { buildRegistry } from '@content/registry';

function setup(seed = 1): GameState {
  const reg = buildRegistry();
  return createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
}

describe('地点目录与每日动线', () => {
  it('把 NPC 中文行踪映射为稳定地点 ID', () => {
    expect(locationIdForDisplayName('山谷集市')).toBe('valley-market');
    expect(locationIdForDisplayName('残脉入口')).toBe('spirit-vein');
    expect(locationIdForDisplayName('阵器棚')).toBe('array-shed');
    expect(locationIdForDisplayName('阵坊')).toBe('array-shed');
    expect(locationIdForDisplayName('未知山坳')).toBe('valley-outskirts');
  });

  it('派生核心地点服务，覆盖坊市、委托和三类外出探索', () => {
    const state = setup();
    const directory = getLocationDirectory(state);
    expect(directory.find(location => location.id === 'valley-market')).toMatchObject({ serviceLabels: ['偶遇', '坊市', '交易', '委托'] });
    expect(directory.find(location => location.id === 'valley-outskirts')?.serviceLabels).toContain('山谷寻访');
    expect(directory.find(location => location.id === 'ruin-gate')?.serviceLabels).toEqual(['遗迹寻访', '深入遗迹', '藏经']);
    expect(directory.find(location => location.id === 'spirit-vein')?.serviceLabels).toContain('残脉探查');
  });

  it('派生活动地点和可执行服务命令，支撑地点驱动交互', () => {
    const state = setup();
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    const activeIds = getActiveLocationDirectory(state).map(location => location.id);
    expect(activeIds).toContain('farmstead');
    expect(activeIds).toContain('valley-market');
    expect(activeIds).not.toContain('festival-ground');
    expect(activeIds).not.toContain('array-shed');
    expect(activeIds).not.toContain('drying-yard');

    expect(getLocationServiceOptions(state, 'valley-market').map(option => option.command)).toEqual(['show-location-encounter', 'browse-shop', 'browse-trade', 'show-commission']);
    expect(getLocationServiceOptions(state, 'ruin-gate').map(option => option.command)).toEqual(['explore-ruin', 'delve-ruin', 'show-archive']);
    expect(getLocationServiceOptions(state, 'festival-ground')).toEqual([]);
  });

  it('按季节只放出有真实动线支撑的药圃与晾晒地点', () => {
    const state = setup();
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);

    expect(getActiveLocationDirectory(state).map(location => location.id)).toContain('herb-plot');
    expect(getLocationServiceOptions(state, 'herb-plot').map(option => option.command)).toEqual(['show-location-encounter']);

    state.season = 'summer';
    const summerIds = getActiveLocationDirectory(state).map(location => location.id);
    expect(summerIds).not.toContain('herb-plot');
    expect(summerIds).toContain('creek-field');
    expect(summerIds).not.toContain('drying-yard');
    expect(getLocationServiceOptions(state, 'creek-field').map(option => option.command)).toEqual(['show-location-encounter']);

    state.season = 'autumn';
    const autumnIds = getActiveLocationDirectory(state).map(location => location.id);
    expect(autumnIds).not.toContain('creek-field');
    expect(autumnIds).toContain('drying-yard');
    expect(getLocationServiceOptions(state, 'drying-yard').map(option => option.command)).toEqual(['show-location-encounter', 'show-processing']);
  });

  it('按日程关闭集市服务，但保留地点偶遇与委托', () => {
    const state = setup();
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.seasonDay = 7;

    const market = getLocationDirectory(state).find(location => location.id === 'valley-market');
    expect(market?.serviceLabels).toEqual(['偶遇', '委托']);
    expect(market?.closedServiceLabels).toEqual(['坊市休', '交易休']);
    expect(getLocationServiceAvailability(state, 'valley-market', 'shop')).toEqual({ open: false, reason: '集市盘账' });
    expect(getLocationServiceOptions(state, 'valley-market').map(option => option.command)).toEqual(['show-location-encounter', 'show-commission']);
  });

  it('新手补货阶段即使遇到盘账日也开放集市坊市，避免首轮经营动线中断', () => {
    const state = setup();
    state.player.flags.add(FIRST_SHIPPING_SETTLEMENT_FLAG);
    state.seasonDay = 7;

    expect(getLocationServiceAvailability(state, 'valley-market', 'shop')).toEqual({ open: true, reason: null });
    expect(getLocationServiceAvailability(state, 'valley-market', 'trade')).toEqual({ open: false, reason: '集市盘账' });
    expect(getLocationServiceOptions(state, 'valley-market').map(option => option.command)).toEqual(['show-location-encounter', 'browse-shop', 'show-commission']);
    expect(getPreferredLocationSelection(state)).toEqual({
      locationId: 'valley-market',
      command: 'browse-shop'
    });
  });

  it('把当日 NPC 行踪聚合到对应地点', () => {
    const state = setup();
    state.season = 'winter';
    const directory = getLocationDirectory(state);
    expect(directory.find(location => location.id === 'tea-shed')?.npcs).toEqual(['游方散修']);
    expect(directory.find(location => location.id === 'greenhouse')?.npcs).toEqual(['采药女']);
    expect(directory.find(location => location.id === 'ruin-gate')?.npcs).toEqual(['阵匠老陆']);
    expect(directory.find(location => location.id === 'tea-shed')?.serviceLabels).toEqual(['偶遇']);
    expect(directory.find(location => location.id === 'greenhouse')?.serviceLabels).toEqual(['偶遇']);
    expect(getActiveLocationDirectory(state).map(location => location.id)).not.toContain('tea-shed');
    expect(getActiveLocationDirectory(state).map(location => location.id)).not.toContain('greenhouse');
  });

  it('留世后旧茶棚开放歇脚听闻服务', () => {
    const state = setup();
    state.season = 'winter';
    state.postAscension.mode = 'stayed-in-world';

    const teaShed = getLocationDirectory(state).find(location => location.id === 'tea-shed');
    expect(teaShed?.serviceLabels).toEqual(['偶遇', '歇脚听闻']);
    expect(getLocationServiceOptions(state, 'tea-shed').map(option => option.command)).toEqual(['show-location-encounter', 'show-tea-shed']);
  });

  it('留世后暖棚开放养护育苗服务', () => {
    const state = setup();
    state.season = 'winter';
    state.postAscension.mode = 'stayed-in-world';

    const greenhouse = getLocationDirectory(state).find(location => location.id === 'greenhouse');
    expect(greenhouse?.serviceLabels).toEqual(['偶遇', '暖棚养护']);
    expect(getLocationServiceOptions(state, 'greenhouse').map(option => option.command)).toEqual(['show-location-encounter', 'show-greenhouse']);
  });

  it('目录优先展示当前可操作动线，隐藏纯叙事挂点与重复入口', () => {
    const state = setup();
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    const summary = getActiveLocationDirectory(state).map(location => location.id);

    expect(summary).toEqual(['farmstead', 'valley-market', 'valley-outskirts', 'ruin-gate', 'spirit-vein', 'herb-plot']);
  });

  it('留世后高频日常服务可被快捷入口稳定解析', () => {
    const state = setup();
    state.season = 'winter';

    expect(getQuickLocationServiceOption(state, 'staying-commission')).toMatchObject({
      locationId: 'valley-market',
      service: 'commission-board',
      command: 'show-commission'
    });
    expect(getQuickLocationServiceOption(state, 'tea-shed')).toBeNull;
    expect(getQuickLocationServiceOption(state, 'greenhouse')).toBeNull;

    state.postAscension.mode = 'stayed-in-world';
    expect(getQuickLocationServiceOption(state, 'staying-commission')).toMatchObject({
      locationId: 'ruin-gate',
      service: 'commission-board',
      command: 'show-commission'
    });
    expect(getQuickLocationServiceOption(state, 'tea-shed')).toMatchObject({
      locationId: 'tea-shed',
      service: 'tea-rest',
      command: 'show-tea-shed'
    });
    expect(getQuickLocationServiceOption(state, 'greenhouse')).toMatchObject({
      locationId: 'greenhouse',
      service: 'greenhouse-tending',
      command: 'show-greenhouse'
    });
  });

  it('在新手补货、补种与首轮闭环后给出当前阶段的优先服务', () => {
    const state = setup();

    expect(getPreferredLocationSelection(state)).toBeNull;

    state.player.flags.add(FIRST_SHIPPING_SETTLEMENT_FLAG);
    expect(getPreferredLocationSelection(state)).toEqual({
      locationId: 'valley-market',
      command: 'browse-shop'
    });

    state.player.flags.add(FIRST_MARKET_RESTOCK_FLAG);
    expect(getPreferredLocationSelection(state)).toEqual({
      locationId: 'farmstead',
      command: 'show-farm-work'
    });

    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    expect(getPreferredLocationSelection(state)).toEqual({
      locationId: 'farmstead',
      command: 'show-processing'
    });
  });

  it('在首轮 onboarding 阶段继续收束地点目录，只保留当前最短动线', () => {
    const state = setup();

    expect(getActiveLocationDirectory(state).map(location => location.id)).toEqual(['farmstead']);

    state.player.flags.add(FIRST_SHIPPING_SETTLEMENT_FLAG);
    expect(getActiveLocationDirectory(state).map(location => location.id)).toEqual(['farmstead', 'valley-market']);

    state.player.flags.add(FIRST_MARKET_RESTOCK_FLAG);
    expect(getActiveLocationDirectory(state).map(location => location.id)).toEqual(['farmstead']);
  });

  it('把数字键映射为稳定的地点服务序号，供单键直达', () => {
    expect(locationServiceIndexFromDigitKey('1')).toBe(0);
    expect(locationServiceIndexFromDigitKey('4')).toBe(3);
    expect(locationServiceIndexFromDigitKey('0')).toBe(9);
    expect(locationServiceIndexFromDigitKey('x')).toBeNull;
  });

  it('把 Digit code 映射为稳定的地点序号，供地点目录 Shift+数字直选', () => {
    expect(locationIndexFromDigitCode('Digit1')).toBe(0);
    expect(locationIndexFromDigitCode('Digit4')).toBe(3);
    expect(locationIndexFromDigitCode('Digit0')).toBe(9);
    expect(locationIndexFromDigitCode('KeyX')).toBeNull;
  });

  it('按地点派生每日 NPC 偶遇对白', () => {
    const state = setup();
    state.season = 'summer';

    const encounters = getLocationEncounters(state, 'spirit-vein');
    expect(encounters).toHaveLength(1);
    expect(encounters[0]).toMatchObject({ npcId: 'npc.wandering-cultivator', npcName: '游方散修', title: '游方散修：等候换取残脉见闻' });
    expect(encounters[0]?.lines.join('')).toContain('磨骨');
    expect(encounters[0]?.birthday).toBe(false);
  });

  it('生辰偶遇提示赠礼收益', () => {
    const state = setup();
    state.season = 'summer';
    state.seasonDay = 8;

    const encounters = getLocationEncounters(state, 'creek-field');
    expect(encounters[0]?.npcName).toBe('采药女');
    expect(encounters[0]?.lines.join('')).toContain('礼物');
    expect(encounters[0]?.birthday).toBe(true);
  });

  it('节日时 NPC 汇聚节日会场，并开放节日摊位服务', () => {
    const state = setup();
    state.activeEvent = { defId: 'event.spring-festival', displayName: '青芽会', daysLeft: 1, growthMod: 1, qiMod: 1 };

    const festivalGround = getLocationDirectory(state).find(location => location.id === 'festival-ground');
    expect(festivalGround).toMatchObject({ active: true, npcs: ['游方散修', '采药女', '阵匠老陆'] });
    expect(festivalGround?.serviceLabels[0]).toBe('偶遇');
    expect(festivalGround?.serviceLabels).toContain('参与节日');
    expect(festivalGround?.serviceLabels).toContain('节日摊位');
    expect(getLocationServiceOptions(state, 'festival-ground').map(option => option.command)).toEqual(['show-location-encounter', 'show-festival', 'browse-festival-stall']);
    expect(getLocationEncounters(state, 'festival-ground')).toHaveLength(3);

    const market = getLocationDirectory(state).find(location => location.id === 'valley-market');
    expect(market?.closedServiceLabels).toEqual(['坊市休', '交易休', '委托休']);
    expect(getLocationServiceOptions(state, 'valley-market')).toEqual([]);
  });

  it('地点摘要用于 UI 快速查看今日路线', () => {
    const state = setup();
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    const summary = locationSummary(state).join('｜');
    expect(summary).toContain('农庄（耕作/加工/阵法）');
    expect(summary).toContain('山谷集市（偶遇/坊市/交易/委托；游方散修）');
    expect(summary).toContain('露根药圃（偶遇；采药女）');
    expect(summary).not.toContain('阵器棚');

    state.season = 'autumn';
    const autumnSummary = locationSummary(state).join('｜');
    expect(autumnSummary).toContain('晾晒架旁（偶遇/加工；采药女）');
  });
});
