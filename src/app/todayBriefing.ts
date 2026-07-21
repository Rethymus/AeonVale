import { getActiveSpecialOrders, getCurrentMainlineQuest, getCurrentStayingWorldIncident, getDailyCommission, getDailySpecialOrder, getPrimaryStayingWorldGoal, upcomingCalendarEntries, type CalendarEntry, type GameState, type MainlineQuestStatus, type SimContext, type SpecialOrderStatus, type StayingWorldGoalStatus } from '@sim';
import { readyForBreakthrough } from '@sim/progression/progression';
import { onboardingObjectiveActionLine, onboardingObjectiveHeadline, onboardingObjectivePayoffLine, onboardingObjectiveProgressLine, onboardingObjectivePurposeLine, onboardingObjectiveRouteLine, primaryObjectiveLine, stripObjectivePrefix } from './onboardingObjective';
import { FIRST_HARVEST_FLAG, FIRST_MARKET_RESTOCK_FLAG, FIRST_SECOND_WATER_FLAG, FIRST_SHIPMENT_FLAG, FIRST_SHIPPING_SETTLEMENT_FLAG, getOnboardingObjectiveId, type OnboardingObjectiveId } from '@sim/story/onboarding';
import { itemIconAssetId } from './itemIcons';
import { collectFarmsteadActionSignals, formatLocationActionSignalLine } from './locationActionSignals';
import { locationPreviewAssetId } from './locationPreview';
import { firstPriorityLocationNpcSignal, formatLocationNpcSignalLine } from './locationNpcSignals';
import { stayingWorldIncidentAssetId } from './stayingWorldIncidentAsset';
import { calendarEntryPreviewAssetId } from './calendarPreviewAsset';
import { farmsteadRootContextAssetId, getFarmsteadFocus } from './farmsteadFocus';
import { tribulationPrepStatusLine } from './tribulationPrepText';

function onboardingObjectiveAssetId(state: GameState, ctx: SimContext, objectiveId: OnboardingObjectiveId | null): string | undefined {
  switch (objectiveId) {
    case 'first-till':
      return locationPreviewAssetId('herb-plot') ?? 'icon.item.rust-hoe';
    case 'first-sow':
      return firstOwnedSeedAssetId(state, ctx) ?? itemIconAssetId('seed.mossling', ctx.content) ?? locationPreviewAssetId('herb-plot');
    case 'first-water':
      return itemIconAssetId('item.water-pail', ctx.content) ?? locationPreviewAssetId('herb-plot');
    case 'first-harvest':
      return locationPreviewAssetId('herb-plot') ?? 'icon.herb.mossling';
    case 'first-ship':
      return 'loc.farmstead';
    case 'first-sleep':
      return 'loc.farmstead';
    case 'first-second-sow':
      return locationPreviewAssetId('herb-plot') ?? 'icon.seed.mossling';
    case 'first-second-water':
    case 'first-loop-complete':
      return locationPreviewAssetId('herb-plot') ?? 'loc.herb-plot';
    case 'first-market-restock':
      return locationPreviewAssetId('valley-market') ?? 'loc.valley-market';
    default:
      return undefined;
  }
}

const seasonShort: Record<CalendarEntry['season'], string> = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬'
};

function itemLabel(itemId: string, ctx: SimContext): string {
  return ctx.content.items.get(itemId)?.displayName ?? itemId;
}

function formatUpcoming(entry: CalendarEntry): string {
  const prefix = (entry.daysFromNow ?? 0) <= 0 ? '今日' : (entry.daysFromNow ?? 0) === 1 ? '明日' : `${entry.daysFromNow}日后`;
  return `${prefix}·${seasonShort[entry.season]}${entry.day} ${entry.title}`;
}

function todayScheduleLine(state: GameState, ctx: SimContext): string {
  const today = upcomingCalendarEntries(state, ctx, 0).map(entry => entry.title);
  return today.length > 0 ? `今日：${today.join('、')}` : '今日：无定期事项';
}

function firstOwnedSeedAssetId(state: GameState, ctx: SimContext): string | undefined {
  const seedIds = Object.keys(state.player.inventory)
    .filter(itemId => itemId.startsWith('seed.') && (state.player.inventory[itemId]?.count ?? 0) > 0)
    .sort((a, b) => (state.player.inventory[b]?.count ?? 0) - (state.player.inventory[a]?.count ?? 0) || a.localeCompare(b, 'zh-CN'));
  const seedId = seedIds[0];
  return seedId ? itemIconAssetId(seedId, ctx.content) : undefined;
}

function farmFocusLine(state: GameState): string {
  return getFarmsteadFocus(state).briefingLine;
}

function reminderLine(state: GameState, ctx: SimContext): string {
  if (readyForBreakthrough(state, ctx.params)) return '引劫：体魄已至极限，先打开修行页确认备劫。';

  if (state.postAscension.mode === 'stayed-in-world') {
    const incident = getCurrentStayingWorldIncident(state);
    if (incident) return `镇守：${incident.title}`;
    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    if (activeOrder) return `镇守：${activeOrder.title}（余 ${activeOrder.remaining}）`;
    const commission = getDailyCommission(state);
    if (commission) return `差事：${commission.title}`;
    const goal = getPrimaryStayingWorldGoal(state);
    if (goal) return `留世：${goal.title}`;
  } else {
    const mainline = getCurrentMainlineQuest(state);
    if (mainline) return `主线：${mainline.title}${mainline.completed ? '（可领）' : ''}`;
    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    if (activeOrder) return `订单：${activeOrder.title}（余 ${activeOrder.remaining}）`;
    const specialOrder = getDailySpecialOrder(state);
    if (specialOrder) return `订单：${specialOrder.title}`;
    const commission = getDailyCommission(state);
    if (commission) return `委托：${commission.title}`;
  }

  const upcoming = upcomingCalendarEntries(state, ctx, 7).find(entry => (entry.daysFromNow ?? 0) > 0) ?? null;
  if (upcoming) return `将至：${formatUpcoming(upcoming)}`;
  return '提醒：先照料灵田，再决定出货、采购或外出。';
}

function commissionTurnInLocationLine(npcId: string, itemId?: string): string {
  if (npcId === 'npc.herb-gatherer') return '露根药圃交付';
  if (npcId === 'npc.array-smith') return '遗迹门口交付';
  if (npcId === 'npc.wandering-cultivator') {
    return itemId === 'item.beast-core' ? '残脉入口交付' : '山谷集市交付';
  }
  return '山谷来客处交付';
}

function commissionReminderAssetId(itemId: string, npcId: string, ctx: SimContext): string | undefined {
  if (npcId === 'npc.herb-gatherer') {
    return locationPreviewAssetId(itemId === 'herb.mossling' ? 'creek-field' : 'herb-plot') ?? itemIconAssetId(itemId, ctx.content);
  }
  if (npcId === 'npc.array-smith') {
    return locationPreviewAssetId('ruin-gate') ?? itemIconAssetId(itemId, ctx.content);
  }
  if (npcId === 'npc.wandering-cultivator') {
    return locationPreviewAssetId(itemId === 'item.beast-core' ? 'spirit-vein' : 'valley-market') ?? itemIconAssetId(itemId, ctx.content);
  }
  return locationPreviewAssetId('valley-market') ?? itemIconAssetId(itemId, ctx.content);
}

function mainlineReminderAssetId(quest: MainlineQuestStatus, ctx: SimContext): string | undefined {
  switch (quest.id) {
    case 'mainline.mortal-discipline':
      return locationPreviewAssetId('farmstead');
    case 'mainline.herb-path':
      return locationPreviewAssetId('herb-plot') ?? itemIconAssetId('herb.dewroot', ctx.content);
    case 'mainline.archive-clue':
      return locationPreviewAssetId('ruin-gate') ?? itemIconAssetId('item.recipe-fragment', ctx.content);
    case 'mainline.valley-order':
      return locationPreviewAssetId('creek-field') ?? itemIconAssetId('herb.mossling', ctx.content);
    case 'mainline.defy-heaven':
      return locationPreviewAssetId('ruin-gate');
    default:
      return locationPreviewAssetId('ruin-gate');
  }
}

function specialOrderReminderLine(order: SpecialOrderStatus, prefix: '订单' | '镇守', ctx: SimContext): string {
  if (order.remaining <= 0) {
    if (order.npcId === 'npc.wandering-cultivator' && order.request.itemId === 'item.beast-core') {
      return `${prefix}：已齐，去${commissionTurnInLocationLine(order.npcId, order.request.itemId)}。`;
    }
    return `${prefix}：已齐，返回告示板领取酬劳。`;
  }
  return `${prefix}：${itemLabel(order.request.itemId, ctx)} 还差 ${order.remaining} 份，先补齐再回执。`;
}

function specialOrderLocationAssetId(order: SpecialOrderStatus): string | undefined {
  if (order.npcId === 'npc.herb-gatherer') {
    return locationPreviewAssetId(order.request.itemId === 'herb.mossling' ? 'creek-field' : 'herb-plot');
  }
  if (order.npcId === 'npc.array-smith') {
    return locationPreviewAssetId('ruin-gate');
  }
  if (order.npcId === 'npc.wandering-cultivator') {
    return locationPreviewAssetId(order.request.itemId === 'item.beast-core' ? 'spirit-vein' : 'valley-market');
  }
  return locationPreviewAssetId('valley-market');
}

function specialOrderReminderAssetId(order: SpecialOrderStatus, ctx: SimContext): string | undefined {
  if (order.remaining <= 0) {
    return specialOrderLocationAssetId(order) ?? itemIconAssetId(order.request.itemId, ctx.content);
  }
  return specialOrderLocationAssetId(order) ?? itemIconAssetId(order.request.itemId, ctx.content);
}

function primaryGoalReminderLine(goal: StayingWorldGoalStatus): string {
  if (goal.id === 'quiet-life-tea-shed') return '闲居：先去旧茶棚歇脚，把今日闲居节奏落下来。';
  if (goal.id === 'quiet-life-greenhouse') return '闲居：先巡暖棚，稳住留种与育苗节奏。';
  if (goal.id === 'quiet-life-greenhouse-nursery') return '闲居：优先补暖棚苗床，让离季育苗真正稳定。';
  if (goal.id === 'warding-farm-expansion') return '镇守：先扩农庄，把可耕地与巡守范围撑起来。';
  if (goal.id === 'warding-autoload') return '镇守：补齐巡守兽搬运联动，减少来回奔走。';
  return `${goal.track === 'warding' ? '镇守' : '闲居'}：${goal.progressLabel}`;
}

function primaryGoalAssetId(goal: StayingWorldGoalStatus): string | undefined {
  if (goal.id === 'quiet-life-tea-shed') return locationPreviewAssetId('tea-shed');
  if (goal.id === 'quiet-life-greenhouse' || goal.id === 'quiet-life-greenhouse-nursery') return locationPreviewAssetId('greenhouse');
  if (goal.id === 'warding-farm-expansion' || goal.id === 'warding-autoload') return locationPreviewAssetId('farmstead');
  return locationPreviewAssetId('farmstead');
}

function reminderFollowUpLine(state: GameState, ctx: SimContext): string | null {
  if (readyForBreakthrough(state, ctx.params)) {
    return tribulationPrepStatusLine(state);
  }

  if (state.postAscension.mode === 'stayed-in-world') {
    const incident = getCurrentStayingWorldIncident(state);
    if (incident) return `处置：交 ${itemLabel(incident.itemId, ctx)} × ${incident.count}，先把今日护田压力压下去。`;

    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    if (activeOrder) return specialOrderReminderLine(activeOrder, '镇守', ctx);

    const commission = getDailyCommission(state);
    if (commission) return `差事：备齐 ${itemLabel(commission.request.itemId, ctx)} × ${commission.request.count}，去${commissionTurnInLocationLine(commission.npcId, commission.request.itemId)}。`;

    const goal = getPrimaryStayingWorldGoal(state);
    if (goal) return primaryGoalReminderLine(goal);
  } else {
    const mainline = getCurrentMainlineQuest(state);
    if (mainline) {
      return mainline.completed ? '主线：已满足条件，回人物面板领取本次主线奖励。' : `推进：${mainline.objective}`;
    }

    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    if (activeOrder) return specialOrderReminderLine(activeOrder, '订单', ctx);

    const specialOrder = getDailySpecialOrder(state);
    if (specialOrder) return `动线：先接“${specialOrder.title}”，再围绕 ${itemLabel(specialOrder.request.itemId, ctx)} 安排采集或种植。`;

    const commission = getDailyCommission(state);
    if (commission) return `委托：备齐 ${itemLabel(commission.request.itemId, ctx)} × ${commission.request.count}，去${commissionTurnInLocationLine(commission.npcId, commission.request.itemId)}。`;
  }

  return null;
}

function socialLocationFollowUpLine(state: GameState): string | null {
  const prioritySignal = firstPriorityLocationNpcSignal(state);
  if (!prioritySignal) return null;
  return `${prioritySignal.location.displayName}：${formatLocationNpcSignalLine(prioritySignal.signals, '去向').slice('去向：'.length)}`;
}

function logisticsFollowUpLine(state: GameState): string | null {
  return formatLocationActionSignalLine(state, 'farmstead', '后勤') ?? null;
}

function todayPriorityLine(state: GameState, ctx: SimContext): string {
  if (readyForBreakthrough(state, ctx.params)) return '优先级：备劫 > 农务 > 委托 > 社交';

  const farmFocus = farmFocusLine(state);
  if (farmFocus.includes('先收') || farmFocus.includes('补水') || farmFocus.includes('补灵') || farmFocus.includes('补种')) {
    return '优先级：农务 > 主线 > 订单 > 社交';
  }

  if (state.postAscension.mode === 'stayed-in-world') {
    if (getCurrentStayingWorldIncident(state)) return '优先级：镇守事件 > 农务 > 差事 > 闲居';
    if (getActiveSpecialOrders(state)[0]) return '优先级：镇守事务 > 农务 > 差事 > 闲居';
    if (getDailyCommission(state)) return '优先级：差事 > 农务 > 闲居 > 社交';
    if (getPrimaryStayingWorldGoal(state)) return '优先级：留世目标 > 农务 > 差事 > 社交';
  } else {
    if (getCurrentMainlineQuest(state)) return '优先级：主线 > 农务 > 订单 > 社交';
    if (getActiveSpecialOrders(state)[0] || getDailySpecialOrder(state)) return '优先级：订单 > 农务 > 主线 > 社交';
    if (getDailyCommission(state)) return '优先级：委托 > 农务 > 采购 > 社交';
  }

  if (firstPriorityLocationNpcSignal(state)) return '优先级：农务 > 社交 > 采购 > 外出';
  return '优先级：农务 > 出货 > 采购 > 外出';
}

export interface TodayBriefingCard {
  title: string;
  body: string;
  assetId?: string;
}

function isPortfolioWelcomeBriefing(state: GameState, objectiveId: OnboardingObjectiveId | null, objective: string): boolean {
  return objectiveId === 'first-till' && objective === onboardingObjectiveHeadline('first-till') && state.day === 1 && !state.player.flags.has(FIRST_HARVEST_FLAG) && !state.player.flags.has(FIRST_SHIPMENT_FLAG) && !state.player.flags.has(FIRST_SHIPPING_SETTLEMENT_FLAG) && !state.player.flags.has(FIRST_MARKET_RESTOCK_FLAG) && !state.player.flags.has(FIRST_SECOND_WATER_FLAG);
}

function firstLoopMilestoneLine(state: GameState, objectiveId: OnboardingObjectiveId | null): string {
  if (objectiveId === 'first-loop-complete' || state.player.flags.has(FIRST_SECOND_WATER_FLAG)) {
    return '里程碑：首轮农务闭环已跑通，点“农务”把余货接入加工、阵法与备劫。';
  }
  if (objectiveId === 'first-harvest' && !state.player.flags.has(FIRST_HARVEST_FLAG)) {
    return '里程碑：第一株灵草已经成熟，收下它，首轮农务才算真正开始兑现。';
  }
  if (state.player.flags.has(FIRST_SHIPMENT_FLAG) && !state.player.flags.has(FIRST_SHIPPING_SETTLEMENT_FLAG)) {
    return '里程碑：第一株灵草已经投进出货箱，先过夜，把第一笔灵石结回来。';
  }
  if (state.player.flags.has(FIRST_SHIPPING_SETTLEMENT_FLAG) && !state.player.flags.has(FIRST_MARKET_RESTOCK_FLAG)) {
    return '里程碑：第一笔出货已经换回灵石，先去集市补种，把第二轮接上。';
  }
  return '';
}

function onboardingObjectiveBriefingLines(state: GameState, ctx: SimContext, objectiveId: OnboardingObjectiveId | null, objective: string): string[] {
  const headline = `目标：${objective}`;
  const purpose = onboardingObjectivePurposeLine(objectiveId);
  const payoff = onboardingObjectivePayoffLine(objectiveId);
  const action = onboardingObjectiveActionLine(objectiveId);
  const route = onboardingObjectiveRouteLine(objectiveId);
  const progress = onboardingObjectiveProgressLine(objectiveId);
  const milestone = firstLoopMilestoneLine(state, objectiveId);
  const fallback = todayScheduleLine(state, ctx);

  const lines = milestone ? [headline, progress, milestone, purpose, payoff, action, route] : [headline, progress, purpose || action || farmFocusLine(state), payoff, action, route || fallback];
  return lines.filter(line => line.length > 0);
}

function reminderAssetId(state: GameState, ctx: SimContext): string | undefined {
  if (readyForBreakthrough(state, ctx.params)) return locationPreviewAssetId('array-shed') ?? 'loc.array-shed';

  if (state.postAscension.mode === 'stayed-in-world') {
    const incident = getCurrentStayingWorldIncident(state);
    if (incident) return stayingWorldIncidentAssetId(incident, ctx.content);
    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    if (activeOrder) return specialOrderReminderAssetId(activeOrder, ctx);
    const commission = getDailyCommission(state);
    if (commission) return commissionReminderAssetId(commission.request.itemId, commission.npcId, ctx);
    const goal = getPrimaryStayingWorldGoal(state);
    if (goal) return primaryGoalAssetId(goal);
  } else {
    const mainline = getCurrentMainlineQuest(state);
    if (mainline) return mainlineReminderAssetId(mainline, ctx);
    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    if (activeOrder) return specialOrderReminderAssetId(activeOrder, ctx);
    const specialOrder = getDailySpecialOrder(state);
    if (specialOrder) return specialOrderReminderAssetId(specialOrder, ctx);
    const commission = getDailyCommission(state);
    if (commission) return commissionReminderAssetId(commission.request.itemId, commission.npcId, ctx);
  }

  const upcoming = upcomingCalendarEntries(state, ctx, 7).find(entry => (entry.daysFromNow ?? 0) > 0) ?? null;
  if (upcoming) return calendarEntryPreviewAssetId(upcoming) ?? 'loc.farmstead';
  const prioritySignal = firstPriorityLocationNpcSignal(state);
  if (prioritySignal) return locationPreviewAssetId(prioritySignal.location.id);
  return undefined;
}

export function todayBriefingFarmFocusAssetId(state: GameState, ctx: SimContext): string {
  const assetId = getFarmsteadFocus(state).assetId;
  if (assetId === 'loc.herb-plot') return locationPreviewAssetId('herb-plot') ?? 'loc.herb-plot';
  return farmsteadRootContextAssetId(state);
}

function nonObjectiveBriefingAssetId(state: GameState, ctx: SimContext): string {
  const reminderAsset = reminderAssetId(state, ctx);
  const farmFocusAsset = todayBriefingFarmFocusAssetId(state, ctx);

  if (!reminderAsset) {
    if (farmFocusAsset === 'loc.drying-yard' || farmFocusAsset === 'loc.array-shed') return 'loc.farmstead';
    return farmFocusAsset;
  }
  if (reminderAsset === 'loc.farmstead' && (farmFocusAsset === 'tile.scorched' || farmFocusAsset === 'loc.valley-market')) return farmFocusAsset;
  return reminderAsset;
}

function objectiveAssetFallback(state: GameState, ctx: SimContext, objectiveId: OnboardingObjectiveId | null): string {
  const objectiveAssetId = onboardingObjectiveAssetId(state, ctx, objectiveId);
  if (objectiveAssetId && objectiveAssetId !== 'loc.farmstead') return objectiveAssetId;

  const farmFocusAssetId = todayBriefingFarmFocusAssetId(state, ctx);
  if (objectiveId === 'first-harvest' && farmFocusAssetId !== 'loc.farmstead') return farmFocusAssetId;

  return objectiveAssetId ?? farmFocusAssetId;
}

export function buildTodayBriefing(state: GameState, ctx: SimContext, objectiveText: string): TodayBriefingCard {
  const objective = stripObjectivePrefix(primaryObjectiveLine(objectiveText));
  const objectiveId = getOnboardingObjectiveId(state);
  const canonicalObjective = onboardingObjectiveHeadline(objectiveId);
  const socialFollowUp = objective.length > 0 ? null : socialLocationFollowUpLine(state);
  const logisticsFollowUp = objective.length > 0 ? null : logisticsFollowUpLine(state);
  const objectiveLines = objective.length > 0 ? onboardingObjectiveBriefingLines(state, ctx, objectiveId, objective) : [];
  const headline = objective.length > 0 ? `目标：${objective}` : reminderLine(state, ctx);
  const secondLine = objective.length > 0 ? '' : farmFocusLine(state);
  const followUp =
    objective.length > 0
      ? ''
      : (() => {
          const reminderFollowUp = reminderFollowUpLine(state, ctx);
          if (reminderFollowUp) return reminderFollowUp;
          if (socialFollowUp) return socialFollowUp;
          const upcoming = upcomingCalendarEntries(state, ctx, 7).find(entry => (entry.daysFromNow ?? 0) > 0) ?? null;
          return upcoming ? `将至：${formatUpcoming(upcoming)}` : '节奏：先稳住农务闭环，再看委托与外出路线。';
        })();

  const fourthLine =
    objective.length > 0
      ? ''
      : (() => {
          if (reminderFollowUpLine(state, ctx)) return socialFollowUp ?? logisticsFollowUp ?? '';
          return logisticsFollowUp ?? socialFollowUp ?? '';
        })();

  const fifthLine = '';

  const priorityLine = objective.length > 0 ? '' : todayPriorityLine(state, ctx);

  return {
    title: '今日简报',
    body: (objective.length > 0 ? objectiveLines : [headline, secondLine, followUp, fourthLine, fifthLine, priorityLine]).filter(line => line.length > 0).join('\n'),
    assetId: objective.length > 0 ? (isPortfolioWelcomeBriefing(state, objectiveId, objective || canonicalObjective) ? 'logo.full' : objectiveAssetFallback(state, ctx, objectiveId)) : nonObjectiveBriefingAssetId(state, ctx)
  };
}
