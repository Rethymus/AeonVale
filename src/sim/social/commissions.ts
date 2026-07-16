/**
 * 公告板委托：每日固定请求，把农场产物、探索战利品与 NPC 好感串成日常目标。
 * 确定性：按 day 从可用委托中轮转，不消耗 RNG。
 */
import type { GameState } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { emit } from '@sim/world/state';
import { itemCount, mutateItem } from '@sim/world/player';
import { getRelationship, NPC_CATALOG } from '@sim/social/relationships';
import { claimRelationshipEvent } from '@sim/social/relationshipEvents';

export interface CommissionDef {
  id: string;
  title: string;
  npcId: string;
  stageMin: number;
  requiresPostAscensionStay?: boolean;
  request: { itemId: string; count: number };
  rewardSpiritStones: number;
  affectionReward: number;
}

export interface CommissionResult {
  ok: boolean;
  commission: CommissionDef | null;
  reason?: string;
}

export interface SpecialOrderDef {
  id: string;
  title: string;
  npcId: string;
  stageMin: number;
  durationDays: number;
  request: { itemId: string; count: number };
  rewardSpiritStones: number;
  affectionReward: number;
  bodyFoundationReward?: number;
  willpowerReward?: number;
}

export interface SpecialOrderStatus extends SpecialOrderDef {
  active: boolean;
  completed: boolean;
  progress: number;
  remaining: number;
  daysLeft: number;
  available: boolean;
}

export interface SpecialOrderResult {
  ok: boolean;
  order: SpecialOrderDef | null;
  reason?: string;
}

export const COMMISSION_CATALOG: readonly CommissionDef[] = [
  {
    id: 'commission.dewroot-tonic',
    title: '露根草调息汤',
    npcId: 'npc.herb-gatherer',
    stageMin: 0,
    request: { itemId: 'herb.dewroot', count: 2 },
    rewardSpiritStones: 3,
    affectionReward: 45
  },
  {
    id: 'commission.mossling-salve',
    title: '青苔止血膏',
    npcId: 'npc.wandering-cultivator',
    stageMin: 0,
    request: { itemId: 'herb.mossling', count: 3 },
    rewardSpiritStones: 3,
    affectionReward: 35
  },
  {
    id: 'commission.broken-talisman-study',
    title: '破损法宝拆解',
    npcId: 'npc.array-smith',
    stageMin: 1,
    request: { itemId: 'item.broken-talisman', count: 1 },
    rewardSpiritStones: 6,
    affectionReward: 60
  },
  {
    id: 'commission.beast-core-sample',
    title: '妖兽内丹样本',
    npcId: 'npc.wandering-cultivator',
    stageMin: 1,
    request: { itemId: 'item.beast-core', count: 1 },
    rewardSpiritStones: 7,
    affectionReward: 55
  },
  {
    id: 'commission.recipe-fragment-copy',
    title: '残卷誊抄',
    npcId: 'npc.array-smith',
    stageMin: 2,
    request: { itemId: 'item.recipe-fragment', count: 1 },
    rewardSpiritStones: 10,
    affectionReward: 75
  },
  {
    id: 'commission.human-ward-patrol',
    title: '镇守人间·守田巡查',
    npcId: 'npc.wandering-cultivator',
    stageMin: 7,
    requiresPostAscensionStay: true,
    request: { itemId: 'item.beast-core', count: 2 },
    rewardSpiritStones: 16,
    affectionReward: 90
  },
  {
    id: 'commission.mortal-array-upkeep',
    title: '镇守人间·护田阵养护',
    npcId: 'npc.array-smith',
    stageMin: 7,
    requiresPostAscensionStay: true,
    request: { itemId: 'item.broken-talisman', count: 2 },
    rewardSpiritStones: 15,
    affectionReward: 95
  }
];

export const SPECIAL_ORDER_CATALOG: readonly SpecialOrderDef[] = [
  {
    id: 'special-order.herb-stockpile',
    title: '淬体药草储备',
    npcId: 'npc.herb-gatherer',
    stageMin: 0,
    durationDays: 7,
    request: { itemId: 'herb.mossling', count: 10 },
    rewardSpiritStones: 12,
    affectionReward: 100,
    bodyFoundationReward: 500
  },
  {
    id: 'special-order.array-scrap',
    title: '旧阵残件清点',
    npcId: 'npc.array-smith',
    stageMin: 1,
    durationDays: 10,
    request: { itemId: 'item.broken-talisman', count: 3 },
    rewardSpiritStones: 18,
    affectionReward: 120,
    willpowerReward: 500
  },
  {
    id: 'special-order.beast-watch',
    title: '守田兽口粮试验',
    npcId: 'npc.wandering-cultivator',
    stageMin: 1,
    durationDays: 8,
    request: { itemId: 'item.beast-core', count: 2 },
    rewardSpiritStones: 16,
    affectionReward: 110,
    bodyFoundationReward: 700
  }
];

export function commissionFlag(day: number, commissionId: string): string {
  return `commission.${day}.${commissionId}`;
}

export function specialOrderCompleteFlag(orderId: string): string {
  return `special-order-complete:${orderId}`;
}

export function getAvailableCommissions(state: GameState): CommissionDef[] {
  return COMMISSION_CATALOG.filter(c => {
    if (state.player.stage < c.stageMin) return false;
    if (c.requiresPostAscensionStay && state.postAscension.mode !== 'stayed-in-world') return false;
    return true;
  });
}

export function getDailyCommission(state: GameState): CommissionDef | null {
  const available = getAvailableCommissions(state);
  if (available.length === 0) return null;
  return available[(state.day - 1) % available.length] ?? null;
}

export function getSpecialOrders(state: GameState): SpecialOrderStatus[] {
  return SPECIAL_ORDER_CATALOG.map(order => {
    const active = state.specialOrders[order.id] ?? null;
    const progress = active?.progress ?? 0;
    return {
      ...order,
      active: Boolean(active),
      completed: state.flags.has(specialOrderCompleteFlag(order.id)),
      progress,
      remaining: Math.max(0, order.request.count - progress),
      daysLeft: active?.daysLeft ?? order.durationDays,
      available: state.player.stage >= order.stageMin
    };
  });
}

export function getAvailableSpecialOrders(state: GameState): SpecialOrderStatus[] {
  return getSpecialOrders(state).filter(order => order.available && !order.completed && !order.active);
}

export function getActiveSpecialOrders(state: GameState): SpecialOrderStatus[] {
  return getSpecialOrders(state).filter(order => order.active && !order.completed);
}

export function getDailySpecialOrder(state: GameState): SpecialOrderStatus | null {
  const available = getAvailableSpecialOrders(state);
  if (available.length === 0) return null;
  return available[(state.day - 1) % available.length] ?? null;
}

export function acceptSpecialOrder(state: GameState, orderId: string): SpecialOrderResult {
  const order = SPECIAL_ORDER_CATALOG.find(entry => entry.id === orderId) ?? null;
  if (!order) return { ok: false, order: null, reason: '无此特别订单' };
  if (state.player.stage < order.stageMin) return { ok: false, order, reason: '修为不足' };
  if (state.flags.has(specialOrderCompleteFlag(order.id))) return { ok: false, order, reason: '已完成' };
  if (state.specialOrders[order.id]) return { ok: false, order, reason: '已接取' };
  state.specialOrders[order.id] = { id: order.id, progress: 0, daysLeft: order.durationDays, acceptedDay: state.day };
  emit(state, 'special-order-accept', { orderId: order.id, npcId: order.npcId, daysLeft: order.durationDays, request: order.request });
  return { ok: true, order };
}

export function submitSpecialOrderItems(state: GameState, orderId: string, count: number): SpecialOrderResult {
  const order = SPECIAL_ORDER_CATALOG.find(entry => entry.id === orderId) ?? null;
  if (!order) return { ok: false, order: null, reason: '无此特别订单' };
  const active = state.specialOrders[order.id];
  if (!active) return { ok: false, order, reason: '未接取' };
  if (count <= 0) return { ok: false, order, reason: '提交数量无效' };
  const remaining = order.request.count - active.progress;
  if (remaining <= 0) return { ok: false, order, reason: '已满额' };
  const take = Math.min(count, remaining);
  if (itemCount(state.player, order.request.itemId) < take) return { ok: false, order, reason: '物品不足' };

  mutateItem(state.player, order.request.itemId, -take);
  active.progress += take;
  emit(state, 'special-order-progress', { orderId: order.id, itemId: order.request.itemId, count: take, progress: active.progress, required: order.request.count });
  return { ok: true, order };
}

export function claimSpecialOrder(state: GameState, orderId: string): SpecialOrderResult {
  const order = SPECIAL_ORDER_CATALOG.find(entry => entry.id === orderId) ?? null;
  if (!order) return { ok: false, order: null, reason: '无此特别订单' };
  const active = state.specialOrders[order.id];
  if (!active) return { ok: false, order, reason: '未接取' };
  if (active.progress < order.request.count) return { ok: false, order, reason: '进度不足' };

  const paid = mutateItem(state.player, 'item.spirit-stone', order.rewardSpiritStones);
  if (!paid) return { ok: false, order, reason: '储物戒已满' };

  const rel = getRelationship(state, order.npcId);
  rel.affection = Math.min(1000, rel.affection + order.affectionReward);
  state.player.bodyFoundation += order.bodyFoundationReward ?? 0;
  state.player.cultivation += order.bodyFoundationReward ?? 0;
  state.player.willpower += order.willpowerReward ?? 0;
  delete state.specialOrders[order.id];
  state.flags.add(specialOrderCompleteFlag(order.id));
  const relationshipEvent = claimRelationshipEvent(state, order.npcId);
  emit(state, 'special-order-complete', {
    orderId: order.id,
    npcId: order.npcId,
    rewardSpiritStones: order.rewardSpiritStones,
    affectionReward: order.affectionReward,
    bodyFoundationReward: order.bodyFoundationReward ?? 0,
    willpowerReward: order.willpowerReward ?? 0,
    affection: rel.affection,
    relationshipEvent
  });
  return { ok: true, order };
}

export function advanceSpecialOrdersDay(state: GameState): void {
  for (const [orderId, active] of Object.entries(state.specialOrders)) {
    active.daysLeft -= 1;
    if (active.daysLeft > 0) continue;
    delete state.specialOrders[orderId];
    emit(state, 'special-order-expired', { orderId, progress: active.progress });
  }
}

export function completeCommission(state: GameState, commissionId: string, _ctx: SimContext): CommissionResult {
  const commission = getDailyCommission(state);
  if (!commission || commission.id !== commissionId) return { ok: false, commission: null, reason: '委托已过期' };
  const doneFlag = commissionFlag(state.day, commission.id);
  if (state.flags.has(doneFlag)) return { ok: false, commission, reason: '今日已完成' };
  if (!NPC_CATALOG.some(npc => npc.id === commission.npcId)) return { ok: false, commission, reason: '委托人缺失' };
  if (itemCount(state.player, commission.request.itemId) < commission.request.count) {
    return { ok: false, commission, reason: '物品不足' };
  }

  mutateItem(state.player, commission.request.itemId, -commission.request.count);
  const paid = mutateItem(state.player, 'item.spirit-stone', commission.rewardSpiritStones);
  if (!paid) {
    mutateItem(state.player, commission.request.itemId, commission.request.count);
    return { ok: false, commission, reason: '储物戒已满' };
  }

  const rel = getRelationship(state, commission.npcId);
  rel.affection = Math.min(1000, rel.affection + commission.affectionReward);
  state.flags.add(doneFlag);
  const relationshipEvent = claimRelationshipEvent(state, commission.npcId);
  emit(state, 'commission-complete', {
    commissionId: commission.id,
    npcId: commission.npcId,
    request: commission.request,
    rewardSpiritStones: commission.rewardSpiritStones,
    affectionReward: commission.affectionReward,
    affection: rel.affection,
    relationshipEvent
  });
  return { ok: true, commission };
}
