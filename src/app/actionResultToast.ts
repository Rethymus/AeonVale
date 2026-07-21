import type { ContentRegistry } from '@content/defs';
import type { GameEvent, SimContext } from '@sim';
import { canShipItem, shippingUnitPrice, storageUsed, type GameState } from '@sim';
import type { CropQuality } from '@sim/farm/quality';
import { inventoryUsed } from '@sim/world/player';
import { itemIconAssetId } from './itemIcons';
import { normalizeGuidanceLine } from './onboardingObjective';
import { guardBeastPreviewAssetId } from '@render/guardBeastPreview';

export interface ResultChoice {
  itemId: string;
  count: number;
  quality?: CropQuality;
}

export interface FacilityJobResult {
  outputItemId?: string;
  outputCount?: number;
  daysRemaining?: number;
}

export interface GuardBeastFeedResult {
  beastId?: number;
  vigor?: number;
  bond?: number;
}

export interface FacilityStatusResult {
  daysRemaining?: number;
}

export interface FacilityFailureResult {
  reason: string;
}

export interface FacilityCollectFailureResult {
  reason: string;
}

export interface PillUseResult {
  applied: boolean;
  effects: readonly string[];
}

export interface BrewMaterialFailureResult {
  herbId: string;
}

export type BodyTrainingMethod = 'push-up' | 'sit-up' | 'squat' | 'long-run';

export interface ToastPresentation {
  message: string;
  assetId?: string;
}

function facilityActionAssetId(action: 'drying' | 'sealing' | 'furnace'): string {
  switch (action) {
    case 'drying':
      return 'facility.drying-rack';
    case 'sealing':
      return 'facility.sealing-cabinet';
    case 'furnace':
      return 'facility.talisman-furnace';
  }
}

function facilityOutputAssetId(outputItemId: string | undefined): string | undefined {
  switch (outputItemId) {
    case 'item.dried-herb':
      return 'facility.drying-rack';
    case 'item.sealed-herb':
      return 'facility.sealing-cabinet';
    case 'item.array-core':
      return 'facility.talisman-furnace';
    default:
      return undefined;
  }
}

const QUALITY_LABEL: Record<CropQuality, string> = {
  mortal: '凡品',
  spirit: '灵品',
  treasure: '珍品'
};

function itemName(itemId: string, content: ContentRegistry): string {
  return content.items.get(itemId)?.displayName ?? itemId;
}

function describeChoice(choice: ResultChoice, content: ContentRegistry): string {
  const quality = choice.quality ? `·${QUALITY_LABEL[choice.quality]}` : '';
  return `${itemName(choice.itemId, content)}${quality}×${choice.count}`;
}

function facilityOutputPurpose(outputItemId: string | undefined): string {
  switch (outputItemId) {
    case 'item.dried-herb':
      return '可出货回灵石，也能接封藏、炼丹与阵法前置';
    case 'item.sealed-herb':
      return '可炼丹、交付或留作备劫药材';
    case 'item.array-core':
      return '可布阵，把农庄产出转成导雷阵材';
    default:
      return '接上农庄加工循环';
  }
}

function queuedNormalShippingEntryCount(state: GameState): number {
  return Object.values(state.shippingBin).filter(count => count > 0).length;
}

function queuedQualityShippingEntryCount(state: GameState): number {
  return Object.values(state.qualityShippingBin).reduce((sum, batch) => sum + Object.values(batch ?? {}).filter(count => count > 0).length, 0);
}

function shippableNormalEntryCount(state: GameState, ctx: SimContext): number {
  return Object.entries(state.player.inventory).filter(([itemId, slot]) => (slot?.count ?? 0) > 0 && canShipItem(ctx, itemId)).length;
}

function carriedQualityEntryCount(state: GameState): number {
  return Object.values(state.player.qualityInventory).reduce((sum, batch) => sum + Object.values(batch ?? {}).filter(count => count > 0).length, 0);
}

export function storageResultToast(mode: 'deposit' | 'withdraw', choice: ResultChoice, state: GameState, content: ContentRegistry): string {
  const inventory = `${inventoryUsed(state.player)}/${state.player.inventoryCapacity}`;
  const storage = `${storageUsed(state.storage)}/${state.storage.capacity}`;
  return `${mode === 'deposit' ? '存入仓库' : '取出仓库'}：${describeChoice(choice, content)}｜仓占 ${storage}｜背包 ${inventory}`;
}

export function storageFailureToast(mode: 'deposit' | 'withdraw', choice: ResultChoice, content: ContentRegistry): string {
  return `${mode === 'deposit' ? '存入失败' : '取出失败'}：${describeChoice(choice, content)}`;
}

export function shippingResultToast(mode: 'normal' | 'quality', choice: ResultChoice, state: GameState, ctx: SimContext, content: ContentRegistry): string {
  const unitPrice = shippingUnitPrice(ctx, choice.itemId, choice.quality, state);
  const total = unitPrice * choice.count;
  if (mode === 'normal') {
    return `投入出货箱：${describeChoice(choice, content)}｜本次 灵石×${total}｜可出 ${shippableNormalEntryCount(state, ctx)} 项｜已入箱 ${queuedNormalShippingEntryCount(state)} 项`;
  }
  return `投入出货箱：${describeChoice(choice, content)}｜本次 灵石×${total}｜品质库存 ${carriedQualityEntryCount(state)} 项｜已入箱 ${queuedQualityShippingEntryCount(state)} 项`;
}

export function shippingFailureToast(choice: ResultChoice, content: ContentRegistry): string {
  return `出货失败：${describeChoice(choice, content)}`;
}

export function firstHarvestMilestoneToast(events: readonly GameEvent[], content: ContentRegistry, nextStep: string): string | null {
  const harvest = events.find(event => event.type === 'harvest');
  if (!harvest) return null;
  const defId = (harvest.payload as { defId?: string })?.defId ?? '';
  const herbName = content.herbs.get(defId)?.displayName ?? (defId || '灵草');
  const guidance = normalizeGuidanceLine(nextStep);
  const purpose = '可炼丹、可出货，也是布阵承雷的第一份材料';
  return guidance ? `首轮收获：${herbName} 已入手｜${purpose}｜${guidance}` : `首轮收获：${herbName} 已入手｜${purpose}`;
}

export function firstShipmentMilestoneToast(baseToast: string, nextStep: string): string {
  const guidance = normalizeGuidanceLine(nextStep);
  return guidance ? `首轮投箱：${baseToast}｜${guidance}` : `首轮投箱：${baseToast}`;
}

export function facilityJobStartToast(action: 'drying' | 'sealing' | 'furnace', input: ResultChoice | null, result: FacilityJobResult, content: ContentRegistry): string {
  const verb = action === 'drying' ? '开始晾晒' : action === 'sealing' ? '开始封藏' : '开始熔炼';
  const inputText = input ? `${describeChoice(input, content)}｜` : '';
  const outputName = itemName(result.outputItemId ?? '', content);
  return `${verb}：${inputText}${result.daysRemaining ?? 1}日后得${outputName}×${result.outputCount ?? 1}｜${facilityOutputPurpose(result.outputItemId)}`;
}

export function facilityCollectResultToast(result: FacilityJobResult, state: GameState, content: ContentRegistry): string {
  const inventory = `${inventoryUsed(state.player)}/${state.player.inventoryCapacity}`;
  const outputName = itemName(result.outputItemId ?? '', content);
  return `收取设施：${outputName}×${result.outputCount ?? 1}｜${facilityOutputPurpose(result.outputItemId)}｜背包 ${inventory}`;
}

export function facilityCollectFailureToast(action: 'drying' | 'sealing' | 'furnace', result: FacilityCollectFailureResult): string {
  const facilityName = action === 'drying' ? '晾晒架' : action === 'sealing' ? '封藏柜' : '炼符炉';
  return `${facilityName}收取未成：${result.reason}`;
}

export function facilityStatusToast(action: 'drying' | 'sealing' | 'furnace', result: FacilityStatusResult): string {
  const daysRemaining = result.daysRemaining ?? 0;
  if (daysRemaining <= 0) {
    switch (action) {
      case 'drying':
        return '晾晒完成，点“农务”进入设施收取';
      case 'sealing':
        return '封藏完成，点“农务”进入设施收取';
      case 'furnace':
        return '熔炼完成，点“农务”进入设施收取';
    }
  }
  switch (action) {
    case 'drying':
      return `晾晒架忙碌，剩余${daysRemaining}日`;
    case 'sealing':
      return `封藏柜忙碌，剩余${daysRemaining}日`;
    case 'furnace':
      return `炼符炉忙碌，剩余${daysRemaining}日`;
  }
}

export function facilityFailureToast(action: 'drying' | 'sealing' | 'furnace', result: FacilityFailureResult): string {
  const prefix = action === 'drying' ? '晾晒失败' : action === 'sealing' ? '封藏失败' : '熔炼失败';
  return `${prefix}：${result.reason}`;
}

export function brewMaterialFailureToast(result: BrewMaterialFailureResult, content: ContentRegistry): string {
  return `熔炼失败：材料不足：${itemName(result.herbId, content)}`;
}

export function bodyTrainingToast(method: BodyTrainingMethod): string {
  switch (method) {
    case 'push-up':
      return '百次俯卧撑：体魄淬炼';
    case 'sit-up':
      return '百次仰卧起坐：意志磨砺';
    case 'squat':
      return '百次深蹲：筋骨发热';
    case 'long-run':
      return '十公里长跑：凡骨不息';
  }
}

function bodyTrainingAssetId(_method: BodyTrainingMethod): string {
  return 'loc.farmstead';
}

export function guardBeastFeedResultToast(choice: ResultChoice, result: GuardBeastFeedResult, content: ContentRegistry): string {
  return `投喂巡守兽：${describeChoice(choice, content)}，精力${result.vigor ?? '?'}，羁绊${result.bond ?? 0}`;
}

export function pillUseToast(pillId: string, result: PillUseResult, content: ContentRegistry): string {
  const name = itemName(pillId, content);
  const effectText = result.effects.join('，') || '无';
  const purpose = pillUsePurposeLine(result.effects);
  return result.applied ? `服 ${name}：${effectText}｜${purpose}` : `无 ${name}｜先备丹再引劫或深入`;
}

function pillUsePurposeLine(effects: readonly string[]): string {
  if (effects.some(effect => effect.includes('承雷稳脉') || effect.includes('铁骨减伤'))) {
    return '承雷准备已稳住';
  }
  if (effects.some(effect => effect.includes('回血') || effect.includes('强骨'))) {
    return '续航和抗伤余量提高';
  }
  if (effects.some(effect => effect.includes('清毒'))) {
    return '丹毒压力下降，可继续炼丹或外出';
  }
  if (effects.some(effect => effect.includes('淬体'))) {
    return '下次天劫淬体收益提高';
  }
  if (effects.some(effect => effect.includes('走火'))) {
    return '风险上升，先稳住心神';
  }
  if (effects.some(effect => effect.includes('飞升'))) {
    return '飞升线索已推进';
  }
  return '修行状态已更新';
}

export function storageResultToastPresentation(mode: 'deposit' | 'withdraw', choice: ResultChoice, state: GameState, content: ContentRegistry): ToastPresentation {
  return {
    message: storageResultToast(mode, choice, state, content),
    assetId: 'loc.farmstead'
  };
}

export function storageFailureToastPresentation(mode: 'deposit' | 'withdraw', choice: ResultChoice, content: ContentRegistry): ToastPresentation {
  return {
    message: storageFailureToast(mode, choice, content),
    assetId: 'loc.farmstead'
  };
}

export function shippingResultToastPresentation(mode: 'normal' | 'quality', choice: ResultChoice, state: GameState, ctx: SimContext, content: ContentRegistry): ToastPresentation {
  return {
    message: shippingResultToast(mode, choice, state, ctx, content),
    assetId: 'loc.farmstead'
  };
}

export function shippingFailureToastPresentation(choice: ResultChoice, content: ContentRegistry): ToastPresentation {
  return {
    message: shippingFailureToast(choice, content),
    assetId: 'loc.farmstead'
  };
}

export function firstHarvestMilestoneToastPresentation(events: readonly GameEvent[], content: ContentRegistry, nextStep: string): ToastPresentation | null {
  const message = firstHarvestMilestoneToast(events, content, nextStep);
  if (!message) return null;
  const harvest = events.find(event => event.type === 'harvest');
  const defId = (harvest?.payload as { defId?: string } | undefined)?.defId;
  return {
    message,
    assetId: defId ? itemIconAssetId(defId, content) : undefined
  };
}

export function firstShipmentMilestoneToastPresentation(baseToast: string, nextStep: string): ToastPresentation {
  return {
    message: firstShipmentMilestoneToast(baseToast, nextStep),
    assetId: 'loc.farmstead'
  };
}

export function facilityJobStartToastPresentation(action: 'drying' | 'sealing' | 'furnace', input: ResultChoice | null, result: FacilityJobResult, content: ContentRegistry): ToastPresentation {
  return {
    message: facilityJobStartToast(action, input, result, content),
    assetId: facilityActionAssetId(action)
  };
}

export function facilityCollectResultToastPresentation(result: FacilityJobResult, state: GameState, content: ContentRegistry): ToastPresentation {
  return {
    message: facilityCollectResultToast(result, state, content),
    assetId: itemIconAssetId(result.outputItemId ?? '', content) ?? facilityOutputAssetId(result.outputItemId)
  };
}

export function facilityCollectFailureToastPresentation(action: 'drying' | 'sealing' | 'furnace', result: FacilityCollectFailureResult): ToastPresentation {
  return {
    message: facilityCollectFailureToast(action, result),
    assetId: facilityActionAssetId(action)
  };
}

export function facilityStatusToastPresentation(action: 'drying' | 'sealing' | 'furnace', result: FacilityStatusResult): ToastPresentation {
  return {
    message: facilityStatusToast(action, result),
    assetId: facilityActionAssetId(action)
  };
}

export function facilityFailureToastPresentation(action: 'drying' | 'sealing' | 'furnace', result: FacilityFailureResult): ToastPresentation {
  return {
    message: facilityFailureToast(action, result),
    assetId: facilityActionAssetId(action)
  };
}

export function brewMaterialFailureToastPresentation(result: BrewMaterialFailureResult, content: ContentRegistry): ToastPresentation {
  return {
    message: brewMaterialFailureToast(result, content),
    assetId: 'facility.talisman-furnace'
  };
}

export function bodyTrainingToastPresentation(method: BodyTrainingMethod): ToastPresentation {
  return {
    message: bodyTrainingToast(method),
    assetId: bodyTrainingAssetId(method)
  };
}

export function guardBeastFeedResultToastPresentation(choice: ResultChoice, result: GuardBeastFeedResult, content: ContentRegistry): ToastPresentation {
  return {
    message: guardBeastFeedResultToast(choice, result, content),
    assetId: result.beastId != null ? guardBeastPreviewAssetId(result.beastId) : 'sprite.guard-beast'
  };
}

export function guardBeastFeedFailureToastPresentation(kind: 'no-guard-beast' | 'no-herb' | 'failed'): ToastPresentation {
  return {
    message: kind === 'no-guard-beast' ? '尚无巡守兽' : kind === 'no-herb' ? '无可投喂灵草' : '投喂失败',
    assetId: 'sprite.guard-beast'
  };
}

export function pillUseToastPresentation(pillId: string, result: PillUseResult, content: ContentRegistry): ToastPresentation {
  return {
    message: pillUseToast(pillId, result, content),
    assetId: itemIconAssetId(pillId, content)
  };
}
