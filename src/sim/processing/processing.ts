/**
 * 农庄加工设施：先落地灵草晾晒架，补上 Stardew-like 的作物→工匠品经济出口。
 * 纯 sim：不依赖 IO/渲染，失败路径不改变状态。
 */
import type { CropQuality } from '@sim/farm/quality';
import type { GameState } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { emit } from '@sim/world/state';
import { MILLI } from '@sim/world/types';
import { inventoryCanFitRewards, itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';

export interface ProcessingResult {
  ok: boolean;
  inputItemId: string;
  outputItemId: string;
  inputCount: number;
  outputCount: number;
  quality?: CropQuality;
  reason?: string;
}

const DRIED_HERB_ID = 'item.dried-herb';
const SEALED_HERB_ID = 'item.sealed-herb';
const SPIRIT_COMPOST_ID = 'item.spirit-compost';
const HERBAL_WINE_ID = 'item.herbal-wine';
const ARRAY_CORE_ID = 'item.array-core';
const SPIRIT_POULTICE_ID = 'item.spirit-poultice';
const COMPOST_INPUT_COUNT = 3;

function qualityYieldBonus(quality?: CropQuality): number {
  switch (quality) {
    case 'spirit':
      return 1;
    case 'treasure':
      return 2;
    case 'mortal':
    case undefined:
      return 0;
  }
}

/** 将一株灵草晾晒为稳定材料；高品质批次保留为额外产出，不派生海量物品 id。 */
export function dryHerb(state: GameState, herbItemId: string, ctx: SimContext, quality?: CropQuality): ProcessingResult {
  if (!ctx.content.herbs.has(herbItemId)) {
    return { ok: false, inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, inputCount: 1, outputCount: 0, quality, reason: '不是灵草' };
  }
  const available = quality ? qualityItemCount(state.player, herbItemId, quality) : itemCount(state.player, herbItemId);
  if (available < 1) {
    return { ok: false, inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, inputCount: 1, outputCount: 0, quality, reason: '材料不足' };
  }
  const outputCount = 1 + qualityYieldBonus(quality);
  if (!inventoryCanFitRewards(state.player, [{ itemId: DRIED_HERB_ID, count: outputCount }], ctx.content)) {
    return { ok: false, inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, inputCount: 1, outputCount, quality, reason: '储物戒已满' };
  }
  if (!mutateItem(state.player, DRIED_HERB_ID, outputCount)) {
    return { ok: false, inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, inputCount: 1, outputCount, quality, reason: '储物戒已满' };
  }
  if (quality) mutateQualityItem(state.player, herbItemId, quality, -1);
  else mutateItem(state.player, herbItemId, -1);
  emit(state, 'process-dry-herb', { inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, inputCount: 1, outputCount, quality });
  return { ok: true, inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, inputCount: 1, outputCount, quality };
}

/** 将晾晒灵草与灵壤肥封藏为高价工匠品，作为早期稳定生产链。 */
export function sealHerb(state: GameState, ctx?: SimContext): ProcessingResult {
  if (itemCount(state.player, DRIED_HERB_ID) < 2) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: SEALED_HERB_ID, inputCount: 2, outputCount: 0, reason: '晾晒灵草不足' };
  }
  if (itemCount(state.player, SPIRIT_COMPOST_ID) < 1) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: SEALED_HERB_ID, inputCount: 2, outputCount: 0, reason: '灵壤肥不足' };
  }
  if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: SEALED_HERB_ID, count: 1 }], ctx.content)) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: SEALED_HERB_ID, inputCount: 2, outputCount: 1, reason: '储物戒已满' };
  }
  if (!mutateItem(state.player, SEALED_HERB_ID, 1)) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: SEALED_HERB_ID, inputCount: 2, outputCount: 1, reason: '储物戒已满' };
  }
  mutateItem(state.player, DRIED_HERB_ID, -2);
  mutateItem(state.player, SPIRIT_COMPOST_ID, -1);
  emit(state, 'process-seal-herb', { inputItemId: DRIED_HERB_ID, catalystItemId: SPIRIT_COMPOST_ID, outputItemId: SEALED_HERB_ID, inputCount: 2, catalystCount: 1, outputCount: 1 });
  return { ok: true, inputItemId: DRIED_HERB_ID, outputItemId: SEALED_HERB_ID, inputCount: 2, outputCount: 1 };
}

/** 将三株灵草堆沤为灵壤肥，为既有封藏/暖棚/施肥链补上自产入口。 */
export function compostHerb(state: GameState, herbItemId: string, ctx: SimContext): ProcessingResult {
  if (!ctx.content.herbs.has(herbItemId)) {
    return { ok: false, inputItemId: herbItemId, outputItemId: SPIRIT_COMPOST_ID, inputCount: COMPOST_INPUT_COUNT, outputCount: 0, reason: '不是灵草' };
  }
  if (itemCount(state.player, herbItemId) < COMPOST_INPUT_COUNT) {
    return { ok: false, inputItemId: herbItemId, outputItemId: SPIRIT_COMPOST_ID, inputCount: COMPOST_INPUT_COUNT, outputCount: 0, reason: '灵草不足' };
  }
  if (!inventoryCanFitRewards(state.player, [{ itemId: SPIRIT_COMPOST_ID, count: 1 }], ctx.content)) {
    return { ok: false, inputItemId: herbItemId, outputItemId: SPIRIT_COMPOST_ID, inputCount: COMPOST_INPUT_COUNT, outputCount: 1, reason: '储物戒已满' };
  }
  if (!mutateItem(state.player, SPIRIT_COMPOST_ID, 1)) {
    return { ok: false, inputItemId: herbItemId, outputItemId: SPIRIT_COMPOST_ID, inputCount: COMPOST_INPUT_COUNT, outputCount: 1, reason: '储物戒已满' };
  }
  mutateItem(state.player, herbItemId, -COMPOST_INPUT_COUNT);
  emit(state, 'process-compost-herb', { inputItemId: herbItemId, outputItemId: SPIRIT_COMPOST_ID, inputCount: COMPOST_INPUT_COUNT, outputCount: 1 });
  return { ok: true, inputItemId: herbItemId, outputItemId: SPIRIT_COMPOST_ID, inputCount: COMPOST_INPUT_COUNT, outputCount: 1 };
}

/** 将晾晒灵草与一枚灵石酿为灵草药酒，作为体修特有工匠品与更高价出货出口。 */
export function brewHerbalWine(state: GameState, ctx?: SimContext): ProcessingResult {
  if (itemCount(state.player, DRIED_HERB_ID) < 2) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: HERBAL_WINE_ID, inputCount: 2, outputCount: 0, reason: '晾晒灵草不足' };
  }
  if (itemCount(state.player, 'item.spirit-stone') < 1) {
    return { ok: false, inputItemId: 'item.spirit-stone', outputItemId: HERBAL_WINE_ID, inputCount: 1, outputCount: 0, reason: '灵石不足' };
  }
  if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: HERBAL_WINE_ID, count: 1 }], ctx.content)) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: HERBAL_WINE_ID, inputCount: 2, outputCount: 1, reason: '储物戒已满' };
  }
  if (!mutateItem(state.player, HERBAL_WINE_ID, 1)) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: HERBAL_WINE_ID, inputCount: 2, outputCount: 1, reason: '储物戒已满' };
  }
  mutateItem(state.player, DRIED_HERB_ID, -2);
  mutateItem(state.player, 'item.spirit-stone', -1);
  emit(state, 'process-brew-herbal-wine', { inputItemId: DRIED_HERB_ID, catalystItemId: 'item.spirit-stone', outputItemId: HERBAL_WINE_ID, inputCount: 2, catalystCount: 1, outputCount: 1 });
  return { ok: true, inputItemId: DRIED_HERB_ID, outputItemId: HERBAL_WINE_ID, inputCount: 2, outputCount: 1 };
}

/** 将破损法宝熔炼为阵核，为阵法农庄化补上自产阵材入口。 */
export function refineArrayCore(state: GameState, ctx?: SimContext): ProcessingResult {
  if (itemCount(state.player, 'item.broken-talisman') < 2) {
    return { ok: false, inputItemId: 'item.broken-talisman', outputItemId: ARRAY_CORE_ID, inputCount: 2, outputCount: 0, reason: '破损法宝不足' };
  }
  if (itemCount(state.player, 'item.spirit-stone') < 1) {
    return { ok: false, inputItemId: 'item.spirit-stone', outputItemId: ARRAY_CORE_ID, inputCount: 1, outputCount: 0, reason: '灵石不足' };
  }
  if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: ARRAY_CORE_ID, count: 1 }], ctx.content)) {
    return { ok: false, inputItemId: 'item.broken-talisman', outputItemId: ARRAY_CORE_ID, inputCount: 2, outputCount: 1, reason: '储物戒已满' };
  }
  if (!mutateItem(state.player, ARRAY_CORE_ID, 1)) {
    return { ok: false, inputItemId: 'item.broken-talisman', outputItemId: ARRAY_CORE_ID, inputCount: 2, outputCount: 1, reason: '储物戒已满' };
  }
  mutateItem(state.player, 'item.broken-talisman', -2);
  mutateItem(state.player, 'item.spirit-stone', -1);
  emit(state, 'process-refine-array-core', { inputItemId: 'item.broken-talisman', catalystItemId: 'item.spirit-stone', outputItemId: ARRAY_CORE_ID, inputCount: 2, catalystCount: 1, outputCount: 1 });
  return { ok: true, inputItemId: 'item.broken-talisman', outputItemId: ARRAY_CORE_ID, inputCount: 2, outputCount: 1 };
}

export interface ConsumeHerbalWineResult {
  ok: boolean;
  reason?: string;
  hpGain: number;
  poisonRelief: number;
  willpowerGain: number;
}

/** 饮用灵草药酒：体修“自用”路径，温补行气活血、解丹毒、凝意志，与出货换灵石形成“出货 vs 自用”抉择。 */
export function consumeHerbalWine(state: GameState, ctx: SimContext): ConsumeHerbalWineResult {
  if (itemCount(state.player, HERBAL_WINE_ID) < 1) {
    return { ok: false, reason: '灵草药酒不足', hpGain: 0, poisonRelief: 0, willpowerGain: 0 };
  }
  mutateItem(state.player, HERBAL_WINE_ID, -1);
  const hpGain = 12 * MILLI;
  const poisonReliefCap = (ctx.params.pillPoison.restBonusMax + 2) * MILLI; // 药酒解毒力强于寻常歇脚
  const poisonRelief = Math.min(state.player.pillPoison, poisonReliefCap);
  const willpowerGain = 30;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpGain);
  state.player.pillPoison = Math.max(0, state.player.pillPoison - poisonRelief);
  state.player.willpower += willpowerGain;
  emit(state, 'consume-herbal-wine', { hpGain, poisonRelief, willpowerGain });
  return { ok: true, hpGain, poisonRelief, willpowerGain };
}

/** 奉上封藏灵草作灵茶品鉴：体修高阶自用路径，清神行气、解丹毒、凝意志。 */
export function offerRefinedTea(state: GameState, ctx: SimContext): ConsumeHerbalWineResult {
  if (itemCount(state.player, SEALED_HERB_ID) < 1) {
    return { ok: false, reason: '封藏灵草不足', hpGain: 0, poisonRelief: 0, willpowerGain: 0 };
  }
  mutateItem(state.player, SEALED_HERB_ID, -1);
  const hpGain = 15 * MILLI;
  const poisonReliefCap = (ctx.params.pillPoison.restBonusMax + 3) * MILLI; // 灵茶品鉴解毒力强于药酒
  const poisonRelief = Math.min(state.player.pillPoison, poisonReliefCap);
  const willpowerGain = 80;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpGain);
  state.player.pillPoison = Math.max(0, state.player.pillPoison - poisonRelief);
  state.player.willpower += willpowerGain;
  emit(state, 'offer-refined-tea', { hpGain, poisonRelief, willpowerGain });
  return { ok: true, hpGain, poisonRelief, willpowerGain };
}

/** 以灵壤肥为底、浓缩晾晒灵草熬成灵药膏（外敷膏剂）。 */
export function makePoultice(state: GameState, ctx?: SimContext): ProcessingResult {
  if (itemCount(state.player, DRIED_HERB_ID) < 1) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: SPIRIT_POULTICE_ID, inputCount: 1, outputCount: 0, reason: '晾晒灵草不足' };
  }
  if (itemCount(state.player, SPIRIT_COMPOST_ID) < 2) {
    return { ok: false, inputItemId: SPIRIT_COMPOST_ID, outputItemId: SPIRIT_POULTICE_ID, inputCount: 2, outputCount: 0, reason: '灵壤肥不足' };
  }
  if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: SPIRIT_POULTICE_ID, count: 1 }], ctx.content)) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: SPIRIT_POULTICE_ID, inputCount: 1, outputCount: 1, reason: '储物戒已满' };
  }
  if (!mutateItem(state.player, SPIRIT_POULTICE_ID, 1)) {
    return { ok: false, inputItemId: DRIED_HERB_ID, outputItemId: SPIRIT_POULTICE_ID, inputCount: 1, outputCount: 1, reason: '储物戒已满' };
  }
  mutateItem(state.player, DRIED_HERB_ID, -1);
  mutateItem(state.player, SPIRIT_COMPOST_ID, -2);
  emit(state, 'process-make-poultice', { inputItemId: DRIED_HERB_ID, catalystItemId: SPIRIT_COMPOST_ID, outputItemId: SPIRIT_POULTICE_ID, inputCount: 1, catalystCount: 2, outputCount: 1 });
  return { ok: true, inputItemId: DRIED_HERB_ID, outputItemId: SPIRIT_POULTICE_ID, inputCount: 1, outputCount: 1 };
}

/** 外敷灵药膏：体修“自用”路径，重止血生肌、拔毒外出，是硬扛雷劫后的续命手段（hp 重，无意志）。 */
export function applyPoultice(state: GameState, ctx: SimContext): ConsumeHerbalWineResult {
  if (itemCount(state.player, SPIRIT_POULTICE_ID) < 1) {
    return { ok: false, reason: '灵药膏不足', hpGain: 0, poisonRelief: 0, willpowerGain: 0 };
  }
  mutateItem(state.player, SPIRIT_POULTICE_ID, -1);
  const hpGain = 20 * MILLI;
  const poisonReliefCap = (ctx.params.pillPoison.restBonusMax + 2) * MILLI;
  const poisonRelief = Math.min(state.player.pillPoison, poisonReliefCap);
  const willpowerGain = 0;
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpGain);
  state.player.pillPoison = Math.max(0, state.player.pillPoison - poisonRelief);
  emit(state, 'apply-poultice', { hpGain, poisonRelief, willpowerGain });
  return { ok: true, hpGain, poisonRelief, willpowerGain };
}
