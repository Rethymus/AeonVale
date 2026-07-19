import type { ContentRegistry } from '@content/defs';
import type { CommissionDef, MainlineQuestStatus, SpecialOrderStatus, StayingWorldIncidentDef } from '@sim';
import { locationPreviewAssetId, previewNpcPortraitAssetId } from './locationPreview';
import { itemIconAssetId } from './itemIcons';
import { stayingWorldIncidentAssetId } from './stayingWorldIncidentAsset';
import { guardBeastPreviewAssetId } from '@render/guardBeastPreview';

export interface CommissionPanelPreview {
  title: string;
  details: string;
  assetId?: string;
}

export interface CommissionToastPresentation {
  message: string;
  assetId?: string;
}

interface ArchiveRequestLike {
  itemId: string;
  count: number;
}

interface ArchiveRewardLike {
  itemId?: string;
  count?: number;
  bodyFoundation?: number;
  willpower?: number;
}

interface RuinChapterLike {
  id: string;
  title: string;
  objective: string;
  floorStart: number;
  floorEnd: number;
  reward: { itemId?: string };
  completed: boolean;
}

type CommissionPreviewMode = 'daily-commission' | 'daily-special-order' | 'active-special-order';

function itemName(itemId: string, content: ContentRegistry): string {
  return content.items.get(itemId)?.displayName ?? itemId;
}

function archiveThreadAssetId(): string {
  return locationPreviewAssetId('ruin-gate');
}

function archiveRewardText(reward: ArchiveRewardLike, content: ContentRegistry): string {
  return [reward.itemId && reward.count ? `${itemName(reward.itemId, content)}×${reward.count}` : '', reward.bodyFoundation ? `体魄+${Math.floor(reward.bodyFoundation / 1000)}` : '', reward.willpower ? `意志+${Math.floor(reward.willpower / 1000)}` : ''].filter(Boolean).join('、');
}

function commissionLocationAssetId(itemId: string, npcId: string): string | undefined {
  if (npcId === 'npc.herb-gatherer') {
    if (itemId === 'herb.mossling') return locationPreviewAssetId('creek-field');
    return locationPreviewAssetId('herb-plot');
  }
  if (npcId === 'npc.array-smith') {
    if (itemId === 'item.recipe-fragment' || itemId === 'item.broken-talisman') return locationPreviewAssetId('ruin-gate');
    return locationPreviewAssetId('array-shed');
  }
  if (npcId === 'npc.wandering-cultivator') {
    if (itemId === 'item.beast-core') return locationPreviewAssetId('spirit-vein');
    return locationPreviewAssetId('valley-market');
  }
  return undefined;
}

function previewOnlyCommissionLocationAssetId(npcId: string): string | undefined {
  switch (npcId) {
    case 'npc.tea-shed-elder':
      return locationPreviewAssetId('tea-shed');
    case 'npc.market-merchant':
      return locationPreviewAssetId('valley-market');
    case 'npc.processing-artisan':
      return locationPreviewAssetId('drying-yard');
    case 'npc.patrol-guard':
      return locationPreviewAssetId('ruin-gate');
    default:
      return undefined;
  }
}

function commissionAssetId(itemId: string, npcId: string, content: ContentRegistry, mode: CommissionPreviewMode): string | undefined {
  const locationAssetId = commissionLocationAssetId(itemId, npcId) ?? previewOnlyCommissionLocationAssetId(npcId);
  if (mode === 'daily-special-order') {
    return locationAssetId ?? previewNpcPortraitAssetId(npcId) ?? itemIconAssetId(itemId, content);
  }
  return locationAssetId ?? previewNpcPortraitAssetId(npcId) ?? itemIconAssetId(itemId, content);
}

function commissionIssuerLine(npcId: string, itemId?: string): string {
  if (npcId === 'npc.herb-gatherer') return '采药女托付｜露根药圃交付';
  if (npcId === 'npc.array-smith') return '阵匠老陆托付｜遗迹门口交付';
  if (npcId === 'npc.wandering-cultivator') {
    return itemId === 'item.beast-core' ? '游方散修托付｜残脉入口交付' : '游方散修托付｜山谷集市交付';
  }
  return '山谷来客托付';
}

function activeOrderStatusLine(order: SpecialOrderStatus): string {
  if (order.remaining <= 0) {
    return `已齐，可回执领奖｜酬 ${order.rewardSpiritStones}`;
  }
  return `已交 ${order.progress}/${order.request.count}｜余 ${order.remaining}｜酬 ${order.rewardSpiritStones}`;
}

function commissionCarryStatusLine(ownedCount: number | undefined, neededCount: number): string | null {
  if (ownedCount == null) return null;
  if (ownedCount >= neededCount) return `现持 ${ownedCount}/${neededCount}｜已齐，可直接交付`;
  return `现持 ${ownedCount}/${neededCount}｜还差 ${neededCount - ownedCount}`;
}

function activeOrderCarryStatusLine(order: SpecialOrderStatus, ownedCount?: number): string | null {
  if (ownedCount == null || order.remaining <= 0) return null;
  if (ownedCount >= order.remaining) return `现持 ${ownedCount}｜本次可补齐剩余 ${order.remaining}`;
  return `现持 ${ownedCount}｜本次最多再交 ${ownedCount}`;
}

function mainlineQuestAssetId(quest: MainlineQuestStatus, content: ContentRegistry): string | undefined {
  switch (quest.id) {
    case 'mainline.mortal-discipline':
      return locationPreviewAssetId('farmstead');
    case 'mainline.herb-path':
      return locationPreviewAssetId('herb-plot') ?? itemIconAssetId('herb.dewroot', content);
    case 'mainline.archive-clue':
      return locationPreviewAssetId('ruin-gate') ?? itemIconAssetId('item.recipe-fragment', content);
    case 'mainline.valley-order':
      return locationPreviewAssetId('creek-field') ?? itemIconAssetId('herb.mossling', content);
    case 'mainline.defy-heaven':
      return locationPreviewAssetId('ruin-gate');
    default:
      return locationPreviewAssetId('ruin-gate') ?? (quest.reward.itemId ? itemIconAssetId(quest.reward.itemId, content) : undefined);
  }
}

function ruinChapterAssetId(chapter: RuinChapterLike, content: ContentRegistry): string | undefined {
  switch (chapter.id) {
    case 'ruin-chapter.bone-trial':
      return locationPreviewAssetId('ruin-gate') ?? itemIconAssetId('item.spirit-compost', content);
    case 'ruin-chapter.array-echo':
      return locationPreviewAssetId('ruin-gate') ?? itemIconAssetId('item.array-core', content);
    case 'ruin-chapter.beast-scar':
      return locationPreviewAssetId('ruin-gate') ?? itemIconAssetId('item.recipe-fragment', content);
    case 'ruin-chapter.heaven-gate':
      return locationPreviewAssetId('ruin-gate');
    default:
      return locationPreviewAssetId('ruin-gate');
  }
}

export function mainlineQuestPanelPreview(quest: MainlineQuestStatus, content: ContentRegistry): CommissionPanelPreview {
  return {
    title: quest.title,
    details: quest.completed ? `主线委托\n${quest.objective}\n已满足条件，可领取奖励` : `主线委托\n${quest.objective}\n当前推进中`,
    assetId: mainlineQuestAssetId(quest, content)
  };
}

export function ruinChapterPanelPreview(chapter: RuinChapterLike, deepestRuinLevel: number, content: ContentRegistry): CommissionPanelPreview {
  const progressLine = chapter.completed ? `已达 ${chapter.floorEnd} 层，可领取章节奖励` : `遗迹 ${deepestRuinLevel}/${chapter.floorEnd}｜目标 ${chapter.floorStart}-${chapter.floorEnd} 层`;

  return {
    title: chapter.title,
    details: `遗迹章节\n${chapter.objective}\n${progressLine}`,
    assetId: ruinChapterAssetId(chapter, content)
  };
}

export function activeSpecialOrderPanelPreview(order: SpecialOrderStatus, content: ContentRegistry, heading = '特别订单', ownedCount?: number): CommissionPanelPreview {
  const carryLine = activeOrderCarryStatusLine(order, ownedCount);
  return {
    title: order.title,
    details: `${heading}\n${commissionIssuerLine(order.npcId, order.request.itemId)}\n${itemName(order.request.itemId, content)} × ${order.request.count}\n${activeOrderStatusLine(order)}${carryLine ? `\n${carryLine}` : ''}`,
    assetId: commissionAssetId(order.request.itemId, order.npcId, content, 'active-special-order')
  };
}

export function dailySpecialOrderPanelPreview(order: SpecialOrderStatus, content: ContentRegistry, heading = '待接特别订单', ownedCount?: number): CommissionPanelPreview {
  const carryLine = commissionCarryStatusLine(ownedCount, order.request.count);
  return {
    title: order.title,
    details: `${heading}\n${commissionIssuerLine(order.npcId, order.request.itemId)}\n${itemName(order.request.itemId, content)} × ${order.request.count}\n待接｜限 ${order.durationDays} 日｜酬 ${order.rewardSpiritStones}${carryLine ? `\n${carryLine}` : ''}`,
    assetId: commissionAssetId(order.request.itemId, order.npcId, content, 'daily-special-order')
  };
}

export function dailyCommissionPanelPreview(commission: CommissionDef, content: ContentRegistry, heading = '公告委托', ownedCount?: number): CommissionPanelPreview {
  const carryLine = commissionCarryStatusLine(ownedCount, commission.request.count);
  return {
    title: commission.title,
    details: `${heading}\n${commissionIssuerLine(commission.npcId, commission.request.itemId)}\n${itemName(commission.request.itemId, content)} × ${commission.request.count}\n今日可交｜酬 ${commission.rewardSpiritStones}${carryLine ? `\n${carryLine}` : ''}`,
    assetId: commissionAssetId(commission.request.itemId, commission.npcId, content, 'daily-commission')
  };
}

export function stayingWorldIncidentPanelPreview(incident: StayingWorldIncidentDef, content: ContentRegistry): CommissionPanelPreview {
  return {
    title: incident.title,
    details: `镇守事件\n${itemName(incident.itemId, content)} × ${incident.count}\n待处置｜缓解护田压力`,
    assetId: stayingWorldIncidentAssetId(incident, content)
  };
}

export function commissionToastPresentation(preview: CommissionPanelPreview, prefix: string, confirmLabel: string): CommissionToastPresentation {
  return {
    message: `${prefix}：${preview.title}｜${preview.details.split('\n').slice(1).join('｜')}｜${confirmLabel}`,
    assetId: preview.assetId
  };
}

export function commissionBoardEmptyToastPresentation(stayingWorldOnly = false): CommissionToastPresentation {
  return {
    message: stayingWorldOnly ? '镇守告示今日暂无差事｜先巡农庄与会场动线，稍后再看' : '公告板眼下暂无委托｜先回农庄、集市或人物动线推进',
    assetId: stayingWorldOnly ? locationPreviewAssetId('ruin-gate') : locationPreviewAssetId('farmstead')
  };
}

export function archiveEmptyToastPresentation(): CommissionToastPresentation {
  return {
    message: '藏经阁暂无可捐条目',
    assetId: archiveThreadAssetId()
  };
}

export function ruinChapterUnavailableToastPresentation(): CommissionToastPresentation {
  return {
    message: '当前遗迹章节已尽',
    assetId: locationPreviewAssetId('ruin-gate')
  };
}

export function mainlineQuestUnavailableToastPresentation(): CommissionToastPresentation {
  return {
    message: '当前主线已告一段落',
    assetId: locationPreviewAssetId('ruin-gate')
  };
}

export function archiveDonationToastPresentation(title: string, reward: ArchiveRewardLike, content: ContentRegistry): CommissionToastPresentation {
  const rewardText = archiveRewardText(reward, content);
  const rewardAssetId = reward.itemId ? itemIconAssetId(reward.itemId, content) : undefined;
  return {
    message: `藏经：${title}${rewardText ? `，${rewardText}` : ''}`,
    assetId: rewardAssetId ?? archiveThreadAssetId()
  };
}

export function archiveDonationFailureToastPresentation(request: ArchiveRequestLike, content: ContentRegistry): CommissionToastPresentation {
  return {
    message: `藏经未成：需${itemName(request.itemId, content)}×${request.count}`,
    assetId: archiveThreadAssetId()
  };
}

export function archiveMilestoneToastPresentation(title: string, reward: ArchiveRewardLike, content: ContentRegistry): CommissionToastPresentation {
  const rewardText = archiveRewardText(reward, content);
  const rewardAssetId = reward.itemId ? itemIconAssetId(reward.itemId, content) : undefined;
  return {
    message: `藏经里程碑：${title}${rewardText ? `，${rewardText}` : ''}`,
    assetId: rewardAssetId ?? archiveThreadAssetId()
  };
}

export function archiveMilestoneFailureToastPresentation(reason = '储物戒已满'): CommissionToastPresentation {
  return {
    message: `藏经里程碑未成：${reason}`,
    assetId: archiveThreadAssetId()
  };
}

export function commissionCompleteToastPresentation(commission: CommissionDef, content: ContentRegistry, stayingWorldOnly = false): CommissionToastPresentation {
  return {
    message: `${stayingWorldOnly ? '完成镇守差事' : '完成委托'}：${commission.title}｜得灵石×${commission.rewardSpiritStones}`,
    assetId: itemIconAssetId('item.spirit-stone', content)
  };
}

export function commissionIncompleteToastPresentation(commission: CommissionDef, content: ContentRegistry, stayingWorldOnly = false): CommissionToastPresentation {
  const preview = dailyCommissionPanelPreview(commission, content, stayingWorldOnly ? '镇守差事' : '公告委托');
  return {
    message: `${stayingWorldOnly ? '镇守差事未完成' : '委托未完成'}：${commission.title}`,
    assetId: preview.assetId
  };
}

export function specialOrderAcceptToastPresentation(order: SpecialOrderStatus, content: ContentRegistry): CommissionToastPresentation {
  const preview = dailySpecialOrderPanelPreview(order, content, '待接特别订单');
  return {
    message: `接取特别订单：${order.title}｜限${order.durationDays}日`,
    assetId: preview.assetId
  };
}

export function specialOrderAcceptFailureToastPresentation(order: SpecialOrderStatus, content: ContentRegistry): CommissionToastPresentation {
  const preview = dailySpecialOrderPanelPreview(order, content, '待接特别订单');
  return {
    message: `无法接取特别订单：${order.title}`,
    assetId: preview.assetId
  };
}

export function specialOrderClaimToastPresentation(order: SpecialOrderStatus, content: ContentRegistry, stayingWorldOnly = false): CommissionToastPresentation {
  return {
    message: `${stayingWorldOnly ? '完成镇守事务' : '完成特别订单'}：${order.title}｜得灵石×${order.rewardSpiritStones}`,
    assetId: itemIconAssetId('item.spirit-stone', content)
  };
}

export function specialOrderClaimFailureToastPresentation(order: SpecialOrderStatus, content: ContentRegistry, stayingWorldOnly = false): CommissionToastPresentation {
  const preview = activeSpecialOrderPanelPreview(order, content, stayingWorldOnly ? '镇守事务' : '特别订单');
  return {
    message: `${stayingWorldOnly ? '镇守事务领奖失败' : '特别订单领奖失败'}：${order.title}`,
    assetId: preview.assetId
  };
}

export function specialOrderPendingToastPresentation(order: SpecialOrderStatus, content: ContentRegistry, stayingWorldOnly = false): CommissionToastPresentation {
  const preview = activeSpecialOrderPanelPreview(order, content, stayingWorldOnly ? '镇守事务' : '特别订单');
  return {
    message: `${stayingWorldOnly ? '镇守事务待交' : '特别订单待交'}：${order.title}`,
    assetId: preview.assetId
  };
}

export function specialOrderProgressToastPresentation(order: SpecialOrderStatus, progress: number, required: number, content: ContentRegistry, stayingWorldOnly = false): CommissionToastPresentation {
  const preview = activeSpecialOrderPanelPreview(order, content, stayingWorldOnly ? '镇守事务' : '特别订单');
  return {
    message: `${stayingWorldOnly ? '镇守事务进度' : '特别订单进度'}：${order.title}｜${progress}/${required}`,
    assetId: preview.assetId
  };
}

export function specialOrderSubmitFailureToastPresentation(order: SpecialOrderStatus, content: ContentRegistry, stayingWorldOnly = false): CommissionToastPresentation {
  const preview = activeSpecialOrderPanelPreview(order, content, stayingWorldOnly ? '镇守事务' : '特别订单');
  return {
    message: `${stayingWorldOnly ? '镇守事务未提交' : '特别订单未提交'}：${order.title}`,
    assetId: preview.assetId
  };
}

export function stayingWorldIncidentResolveToastPresentation(incident: StayingWorldIncidentDef, content: ContentRegistry, resolved?: { beastId?: number }): CommissionToastPresentation {
  const preview = stayingWorldIncidentPanelPreview(incident, content);
  return {
    message: `处置镇守事件：${incident.title}`,
    assetId: resolved?.beastId != null ? guardBeastPreviewAssetId(resolved.beastId) : preview.assetId
  };
}

export function stayingWorldIncidentResolveFailureToastPresentation(incident: StayingWorldIncidentDef, content: ContentRegistry): CommissionToastPresentation {
  const preview = stayingWorldIncidentPanelPreview(incident, content);
  return {
    message: `镇守事件未处置：${incident.title}`,
    assetId: preview.assetId
  };
}

export function mainlineQuestClaimToastPresentation(quest: MainlineQuestStatus, content: ContentRegistry, nextQuestTitle?: string | null): CommissionToastPresentation {
  const preview = mainlineQuestPanelPreview(quest, content);
  return {
    message: nextQuestTitle ? `主线推进：${quest.title} → ${nextQuestTitle}` : `主线完成：${quest.title}`,
    assetId: preview.assetId
  };
}

export function mainlineQuestClaimFailureToastPresentation(quest: MainlineQuestStatus, content: ContentRegistry): CommissionToastPresentation {
  const preview = mainlineQuestPanelPreview(quest, content);
  return {
    message: quest.completed ? `主线领取失败：${quest.title}` : `主线未成：${quest.title}`,
    assetId: preview.assetId
  };
}

export function ruinChapterClaimToastPresentation(chapter: RuinChapterLike, deepestRuinLevel: number, content: ContentRegistry, nextChapter?: { title?: string | null; floorStart?: number | null; floorEnd?: number | null }): CommissionToastPresentation {
  const preview = ruinChapterPanelPreview(chapter, deepestRuinLevel, content);
  const floorRange = nextChapter?.title ? `（${nextChapter.floorStart ?? '?'}-${nextChapter.floorEnd ?? '?'}层）` : '';
  return {
    message: nextChapter?.title ? `遗迹推进：${chapter.title} → ${nextChapter.title}${floorRange}` : `遗迹章节完成：${chapter.title}`,
    assetId: preview.assetId
  };
}

export function ruinChapterClaimFailureToastPresentation(chapter: RuinChapterLike, deepestRuinLevel: number, content: ContentRegistry): CommissionToastPresentation {
  const preview = ruinChapterPanelPreview(chapter, deepestRuinLevel, content);
  return {
    message: chapter.completed ? `遗迹章节领取失败：${chapter.title}` : `遗迹章节未成：${chapter.title}`,
    assetId: preview.assetId
  };
}
