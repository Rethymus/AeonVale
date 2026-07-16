import { getActiveSpecialOrders, getCurrentMainlineQuest, getCurrentRuinChapter, getCurrentStayingWorldIncident, getDailyCommission, hasResolvedStayingWorldIncidentForDay, nextArchiveDonation, nextArchiveMilestone, storageUsed, type LocationId } from '@sim';
import type { GameState } from '@sim/world/state';
import type { FacilityKind } from '@sim';
import { itemCount } from '@sim/world/player';

export interface FarmsteadActionSignals {
  readyFacilityCount: number;
  queuedShippingCount: number;
  storageFull: boolean;
}

function commissionTaskLocationId(state: GameState): LocationId | null {
  const commission = getDailyCommission(state);
  if (!commission || itemCount(state.player, commission.request.itemId) < commission.request.count) return null;

  switch (commission.npcId) {
    case 'npc.herb-gatherer':
      return commission.request.itemId === 'herb.mossling' ? 'creek-field' : 'herb-plot';
    case 'npc.array-smith':
      return 'ruin-gate';
    case 'npc.wandering-cultivator':
      return commission.request.itemId === 'item.beast-core' ? 'spirit-vein' : 'valley-market';
    default:
      return 'valley-market';
  }
}

function specialOrderTaskLocationId(state: GameState): LocationId | null {
  const order = getActiveSpecialOrders(state).find(entry => entry.remaining <= 0) ?? null;
  if (!order) return null;

  switch (order.npcId) {
    case 'npc.herb-gatherer':
      return order.request.itemId === 'herb.mossling' ? 'creek-field' : 'herb-plot';
    case 'npc.array-smith':
      return 'ruin-gate';
    case 'npc.wandering-cultivator':
      return order.request.itemId === 'item.beast-core' ? 'spirit-vein' : 'valley-market';
    default:
      return 'valley-market';
  }
}

function incidentTaskLocationId(state: GameState): LocationId | null {
  const incident = getCurrentStayingWorldIncident(state);
  if (!incident || hasResolvedStayingWorldIncidentForDay(state, state.day)) return null;
  switch (incident.id) {
    case 'incident.beast-trace':
      return 'spirit-vein';
    case 'incident.array-fray':
      return 'ruin-gate';
    case 'incident.herb-relief':
      return 'creek-field';
    default:
      return null;
  }
}

function readyFacilityCount(state: GameState): number {
  return Array.from(state.facilities.values()).filter(facility => (facility.job?.daysRemaining ?? 1) <= 0).length;
}

function readyFacilityCountByKind(state: GameState, kinds: readonly FacilityKind[]): number {
  const kindSet = new Set<FacilityKind>(kinds);
  return Array.from(state.facilities.values()).filter(facility => kindSet.has(facility.kind) && (facility.job?.daysRemaining ?? 1) <= 0).length;
}

function queuedShippingEntryCount(state: GameState): number {
  const normal = Object.values(state.shippingBin).filter(count => count > 0).length;
  const quality = Object.values(state.qualityShippingBin).reduce((sum, batch) => sum + Object.values(batch ?? {}).filter(count => count > 0).length, 0);
  return normal + quality;
}

export function collectFarmsteadActionSignals(state: GameState): FarmsteadActionSignals {
  return {
    readyFacilityCount: readyFacilityCount(state),
    queuedShippingCount: queuedShippingEntryCount(state),
    storageFull: storageUsed(state.storage) >= state.storage.capacity
  };
}

function farmsteadActionSignalLine(prefix: string, state: GameState): string | undefined {
  const segments: string[] = [];
  const { readyFacilityCount: ready, queuedShippingCount: queued, storageFull } = collectFarmsteadActionSignals(state);

  if (ready > 0) segments.push(`待收设施 ${ready} 座`);
  if (queued > 0) segments.push(`出货箱待结 ${queued} 项`);
  if (storageFull) segments.push('仓储已满');

  return segments.length > 0 ? `${prefix}：${segments.join('｜')}` : undefined;
}

function childFacilityActionSignalLine(prefix: string, state: GameState, kinds: readonly FacilityKind[], noun: string): string | undefined {
  const ready = readyFacilityCountByKind(state, kinds);
  return ready > 0 ? `${prefix}：待收${noun} ${ready} 座` : undefined;
}

function marketActionSignalLine(prefix: string, state: GameState): string | undefined {
  const segments: string[] = [];
  const commission = getDailyCommission(state);
  if (commissionTaskLocationId(state) === 'valley-market' && commission) {
    segments.push(`委托可交：${commission.title}`);
  }

  const readyOrder = specialOrderTaskLocationId(state) === 'valley-market' ? (getActiveSpecialOrders(state).find(order => order.remaining <= 0) ?? null) : null;
  if (readyOrder) segments.push(`订单可领：${readyOrder.title}`);

  return segments.length > 0 ? `${prefix}：${segments.join('｜')}` : undefined;
}

function locationTaskSignalLine(prefix: string, state: GameState, locationId: LocationId): string | undefined {
  const segments: string[] = [];
  const commission = getDailyCommission(state);
  if (commissionTaskLocationId(state) === locationId && commission) {
    segments.push(`委托可交：${commission.title}`);
  }

  const readyOrder = specialOrderTaskLocationId(state) === locationId ? (getActiveSpecialOrders(state).find(order => order.remaining <= 0) ?? null) : null;
  if (readyOrder) segments.push(`订单可领：${readyOrder.title}`);

  return segments.length > 0 ? `${prefix}：${segments.join('｜')}` : undefined;
}

function ruinGateActionSignalLine(prefix: string, state: GameState): string | undefined {
  const segments: string[] = [];
  const chapter = getCurrentRuinChapter(state);
  if (chapter?.completed) segments.push(`遗迹酬劳可领：${chapter.title}`);

  const milestone = nextArchiveMilestone(state);
  if (milestone) segments.push(`藏经里程可领：${milestone.title}`);

  const donation = nextArchiveDonation(state);
  if (donation && itemCount(state.player, donation.request.itemId) >= donation.request.count) {
    segments.push(`藏经可捐：${donation.title}`);
  }

  const mainline = getCurrentMainlineQuest(state);
  if (mainline?.id === 'mainline.archive-clue' && mainline.completed) {
    segments.push(`主线可领：${mainline.title}`);
  }

  return segments.length > 0 ? `${prefix}：${segments.join('｜')}` : undefined;
}

function incidentActionSignalLine(prefix: string, state: GameState, locationId: LocationId): string | undefined {
  const incidentLocationId = incidentTaskLocationId(state);
  if (incidentLocationId !== locationId) return undefined;
  const incident = getCurrentStayingWorldIncident(state);
  if (!incident) return undefined;
  return `${prefix}：镇守事件待处置｜${incident.title}`;
}

export function formatLocationActionSignalLine(state: GameState, locationId: LocationId, prefix = '要务'): string | undefined {
  switch (locationId) {
    case 'farmstead':
      return farmsteadActionSignalLine(prefix, state);
    case 'drying-yard':
      return childFacilityActionSignalLine(prefix, state, ['drying-rack'], '晾晒架');
    case 'array-shed':
      return childFacilityActionSignalLine(prefix, state, ['talisman-furnace', 'sealing-cabinet'], '阵器设施');
    case 'valley-market':
      return marketActionSignalLine(prefix, state);
    case 'ruin-gate':
      return incidentActionSignalLine(prefix, state, locationId) ?? locationTaskSignalLine(prefix, state, locationId) ?? ruinGateActionSignalLine(prefix, state);
    case 'spirit-vein':
    case 'creek-field':
    case 'herb-plot':
      return incidentActionSignalLine(prefix, state, locationId) ?? locationTaskSignalLine(prefix, state, locationId);
    default:
      return undefined;
  }
}
