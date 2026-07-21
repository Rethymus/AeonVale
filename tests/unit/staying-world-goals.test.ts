import { describe, expect, it } from 'vitest';
import { acceptSpecialOrder, commissionFlag, createWorld, DEFAULT_BALANCE, farmExpansionTier, getCurrentStayingWorldIncident, getPrimaryStayingWorldGoal, getStayingWorldGoals, greenhouseVisitFlag, hasResolvedStayingWorldIncidentForDay, performUpgrade, resolveStayingWorldIncident, renderStayingWorldGoals, relationshipEventFlag, archiveDonationFlag, TEA_REGULAR_ACHIEVEMENT_FLAG, teaShedVisitFlag, type GameState } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';

function setup(seed = 1): GameState {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  state.player.stage = 7;
  return state;
}

describe('留世持续目标', () => {
  it('未留世时不生成留世目标', () => {
    const state = setup();

    expect(getStayingWorldGoals(state)).toEqual([]);
    expect(getPrimaryStayingWorldGoal(state)).toBeNull;
    expect(renderStayingWorldGoals(state)).toContain('（未留世）');
  });

  it('留世后生成镇守与闲居双轨目标，并优先返回未完成的最高优先级目标', () => {
    const state = setup();
    state.day = 6;
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day - 2;

    const goals = getStayingWorldGoals(state);
    const primary = getPrimaryStayingWorldGoal(state);

    expect(goals.map(goal => goal.track)).toContain('warding');
    expect(goals.map(goal => goal.track)).toContain('quiet-life');
    expect(goals.map(goal => goal.id)).toContain('warding-pressure');
    expect(goals.map(goal => goal.id)).toContain('quiet-life-harmony');
    expect(primary?.id).toBe('warding-incident');
    expect(primary?.title).toContain('今日镇守事件');
  });

  it('处置当日镇守事件后，目标层会正确转为已完成', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    const incident = getCurrentStayingWorldIncident(state)!;
    mutateItem(state.player, incident.itemId, incident.count);
    expect(resolveStayingWorldIncident(state).ok).toBe(true);
    expect(hasResolvedStayingWorldIncidentForDay(state, state.day)).toBe(true);

    const incidentGoal = getStayingWorldGoals(state).find(goal => goal.id === 'warding-incident');
    expect(incidentGoal).toMatchObject({ complete: true, progressLabel: '今日已处置' });
  });

  it('完成茶棚与暖棚日常后，对应闲居目标转为已完成', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day - 5;
    state.flags.add(teaShedVisitFlag(state.day));
    state.flags.add(greenhouseVisitFlag(state.day));

    const goals = getStayingWorldGoals(state);
    const teaGoal = goals.find(goal => goal.id === 'quiet-life-tea-shed');
    const greenhouseGoal = goals.find(goal => goal.id === 'quiet-life-greenhouse');

    expect(teaGoal).toMatchObject({ complete: true, progressLabel: '今日已歇脚' });
    expect(greenhouseGoal).toMatchObject({ complete: true, progressLabel: '今日已养护' });
  });

  it('活动特别订单会顶到留世目标最前面', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    expect(acceptSpecialOrder(state, 'special-order.herb-stockpile').ok).toBe(true);

    const primary = getPrimaryStayingWorldGoal(state);
    expect(primary?.id).toBe('warding-special-order');
    expect(primary?.title).toContain('淬体药草储备');
  });

  it('留世镇守委托完成标记会正确反映到目标层', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;
    state.day = 6;
    const commissionId = 'commission.human-ward-patrol';
    state.flags.add(commissionFlag(state.day, commissionId));

    const goals = getStayingWorldGoals(state);
    const commissionGoal = goals.find(goal => goal.id === 'warding-daily-commission');

    expect(commissionGoal).toMatchObject({ complete: true, progressLabel: '今日已完成' });
  });

  it('农庄扩建目标会跟踪到三阶完成，而不是一阶即结束', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day - 3;

    let farmGoal = getStayingWorldGoals(state).find(goal => goal.id === 'warding-farm-expansion');
    expect(farmGoal).toMatchObject({ complete: false, progressLabel: '尚未完成一阶扩建（目标 3 阶）' });

    mutateItem(state.player, 'item.spirit-stone', 10);
    mutateItem(state.player, 'herb.mossling', 3);
    expect(performUpgrade(state, 'farmstead-expansion-1').ok).toBe(true);
    expect(farmExpansionTier(state)).toBe(1);

    farmGoal = getStayingWorldGoals(state).find(goal => goal.id === 'warding-farm-expansion');
    expect(farmGoal).toMatchObject({ complete: false, progressLabel: '已扩建至 1/3 阶' });

    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'herb.stonegrain', 4);
    expect(performUpgrade(state, 'farmstead-expansion-2').ok).toBe(true);

    mutateItem(state.player, 'item.spirit-stone', 30);
    mutateItem(state.player, 'item.array-core', 2);
    mutateItem(state.player, 'item.beast-core', 2);
    mutateItem(state.player, 'herb.mistfern', 4);
    expect(performUpgrade(state, 'farmstead-expansion-3').ok).toBe(true);

    farmGoal = getStayingWorldGoals(state).find(goal => goal.id === 'warding-farm-expansion');
    expect(farmGoal).toMatchObject({ complete: true, progressLabel: '已扩建至 3/3 阶' });
  });

  it('暖棚苗床目标会跟踪到三阶完成，而不是一二阶即结束', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day - 3;

    let nurseryGoal = getStayingWorldGoals(state).find(goal => goal.id === 'quiet-life-greenhouse-nursery');
    expect(nurseryGoal).toMatchObject({ complete: false, progressLabel: '尚未扩建（目标 3 阶）' });

    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);
    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);

    nurseryGoal = getStayingWorldGoals(state).find(goal => goal.id === 'quiet-life-greenhouse-nursery');
    expect(nurseryGoal).toMatchObject({ complete: false, progressLabel: '已扩建至 1/3 阶' });

    mutateItem(state.player, 'item.spirit-stone', 26);
    mutateItem(state.player, 'item.array-core', 2);
    mutateItem(state.player, 'item.recipe-fragment', 2);
    mutateItem(state.player, 'herb.mistfern', 4);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);

    nurseryGoal = getStayingWorldGoals(state).find(goal => goal.id === 'quiet-life-greenhouse-nursery');
    expect(nurseryGoal).toMatchObject({ complete: false, progressLabel: '已扩建至 2/3 阶' });

    mutateItem(state.player, 'item.spirit-stone', 36);
    mutateItem(state.player, 'item.array-core', 3);
    mutateItem(state.player, 'item.recipe-fragment', 3);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.sunmoss', 4);
    expect(performUpgrade(state, 'greenhouse-nursery-3').ok).toBe(true);

    nurseryGoal = getStayingWorldGoals(state).find(goal => goal.id === 'quiet-life-greenhouse-nursery');
    expect(nurseryGoal).toMatchObject({ complete: true, progressLabel: '已扩建至 3/3 阶' });
  });

  it('巡守专长精通目标随精通巡守兽完成，否则按最高羁绊显示进度', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    let mastery = getStayingWorldGoals(state).find(goal => goal.id === 'warding-guard-mastery');
    expect(mastery).toBeDefined;
    expect(mastery!.complete).toBe(false);
    expect(mastery!.progressLabel).toBe('尚无巡守兽');

    state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond: 40, specialty: 'field-ward' });
    mastery = getStayingWorldGoals(state).find(goal => goal.id === 'warding-guard-mastery');
    expect(mastery!.complete).toBe(false);
    expect(mastery!.progressLabel).toBe('最高羁绊 40/100');

    state.guardBeasts.push({ id: 2, vigor: 2, maxVigor: 3, bond: 85, specialty: 'array-warden' });
    mastery = getStayingWorldGoals(state).find(goal => goal.id === 'warding-guard-mastery');
    expect(mastery!.complete).toBe(true);
    expect(mastery!.progressLabel).toBe('已精通：array-warden');
  });

  it('阵守巡阵目标在阵守巡守兽于阵法覆盖内巡逻时完成', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    let goal = getStayingWorldGoals(state).find(entry => entry.id === 'warding-array-warden-patrol');
    expect(goal).toBeDefined;
    expect(goal!.complete).toBe(false);

    state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond: 40, specialty: 'array-warden' });
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'warding-array-warden-patrol');
    expect(goal!.complete).toBe(false);
    expect(goal!.progressLabel).toBe('有阵守兽但未在阵法覆盖内巡逻');

    const tileId = state.tiles[0]!.id;
    state.arrays.set(1, { id: 1, defId: 'array.insulation', modifier: 0.3, coreTileId: tileId, coverageTileIds: [tileId], power: 100, active: true });
    state.guardBeastPatrols.push({ beastId: 1, tileId, assignedDay: state.day });
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'warding-array-warden-patrol');
    expect(goal!.complete).toBe(true);
  });

  it('旧茶棚常客目标在达成 3 日连击成就后完成', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    let goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-tea-regular');
    expect(goal).toBeDefined;
    expect(goal!.complete).toBe(false);

    state.flags.add(TEA_REGULAR_ACHIEVEMENT_FLAG);
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-tea-regular');
    expect(goal!.complete).toBe(true);
  });

  it('故交同心目标在结下任一深交（320 好感事件）后完成，并按结交人数显示进度', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    let goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-deep-bond');
    expect(goal).toBeDefined();
    expect(goal!.complete).toBe(false);
    expect(goal!.progressLabel).toBe('尚未与任何人结下深交（320 好感）');

    state.flags.add(relationshipEventFlag('herb-gatherer-320'));
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-deep-bond');
    expect(goal!.complete).toBe(true);
    expect(goal!.progressLabel).toBe('已结深交 1/3 位');

    state.flags.add(relationshipEventFlag('wandering-cultivator-320'));
    state.flags.add(relationshipEventFlag('array-smith-320'));
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-deep-bond');
    expect(goal!.progressLabel).toBe('已结深交 3/3 位');
  });

  it('藏经补遗目标在捐献满 3 件后完成，并按已捐件数显示进度', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    let goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-archive');
    expect(goal).toBeDefined();
    expect(goal!.complete).toBe(false);
    expect(goal!.progressLabel).toBe('已捐 0/3 件');

    state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));
    state.flags.add(archiveDonationFlag('archive.broken-talisman-anatomy'));
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-archive');
    expect(goal!.complete).toBe(false);
    expect(goal!.progressLabel).toBe('已捐 2/3 件');

    state.flags.add(archiveDonationFlag('archive.array-core-proof'));
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'quiet-life-archive');
    expect(goal!.complete).toBe(true);
    expect(goal!.progressLabel).toBe('已捐 3/3 件');
  });

  it('递送通达目标在递送专长巡守兽精通后完成，否则按最高递送羁绊显示进度', () => {
    const state = setup();
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;

    let goal = getStayingWorldGoals(state).find(entry => entry.id === 'warding-courier-mastery');
    expect(goal).toBeDefined();
    expect(goal!.complete).toBe(false);
    expect(goal!.progressLabel).toBe('尚无递送专长巡守兽');

    state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond: 40, specialty: 'courier' });
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'warding-courier-mastery');
    expect(goal!.complete).toBe(false);
    expect(goal!.progressLabel).toBe('最高羁绊 40/100');

    state.guardBeasts.push({ id: 2, vigor: 2, maxVigor: 3, bond: 85, specialty: 'courier' });
    goal = getStayingWorldGoals(state).find(entry => entry.id === 'warding-courier-mastery');
    expect(goal!.complete).toBe(true);
    expect(goal!.progressLabel).toBe('已精通递送');
  });
});
