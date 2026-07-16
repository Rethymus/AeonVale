/**
 * 玩家动作应用。
 * 每个动作校验可行性（地块/库存/体力）后变更 state，并发事件。
 * 动作按 DayInput.actions 顺序执行；体力不足则跳过该动作（不致命错误）。
 */
import type { GameState } from '@sim/world/state';
import { tileAt, nextEntityId, emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { PlayerAction } from '@sim/world/input';
import { inventoryCanFitRewards, mutateItem, itemCount, mutateQualityItem } from '@sim/world/player';
import { MILLI } from '@sim/world/types';
import { shipItem, shipQualityItem } from '@sim/economy/shipping';
import { buyShopItem } from '@sim/economy/shop';
import { delveRuin, exploreSite } from '@sim/exploration/explore';
import { performUpgrade, toolAreaSize, toolStaminaMultiplier } from '@sim/buildings/upgrades';
import { giveGift } from '@sim/social/relationships';
import { acceptSpecialOrder, claimSpecialOrder, completeCommission, submitSpecialOrderItems } from '@sim/social/commissions';
import { claimArchiveMilestone, donateToArchive } from '@sim/collection/archive';
import { assignGuardBeastPatrol, feedGuardBeast, tameGuardBeast } from '@sim/celestial/beastSystem';
import { buyFestivalStallItem, participateFestival } from '@sim/celestial/celestialSystem';
import { depositItem, depositQualityItem, withdrawItem, withdrawQualityItem } from '@sim/storage/storage';
import { collectFacility, placeFacility, startDryingJob, startFacilityRecipeJob, startFurnaceJob, startSealingJob } from '@sim/buildings/facilities';
import { dryHerb, sealHerb } from '@sim/processing/processing';
import { claimMainlineQuest } from '@sim/story/mainline';
import { claimRuinChapter } from '@sim/exploration/ruinChapters';
import { claimNpcQuest } from '@sim/social/npcQuests';
import { invokeTribulation } from '@sim/progression/bodyCultivation';
import { resolveStayingWorldIncident } from '@sim/progression/stayingWorldIncidents';
import { hasActiveArrayCoverage } from '@sim/tribulation/arrays';
import { canPlantOffSeasonInGreenhouse, greenhouseProtectedHarvestBonus, isOffSeasonSeed } from '@sim/social/greenhouse';
import { FIRST_HARVEST_FLAG, FIRST_MARKET_RESTOCK_FLAG, FIRST_SECOND_SOW_FLAG, FIRST_SECOND_WATER_FLAG } from '@sim/story/onboarding';
import type { CropInstance } from './crop';
import { FERTILITY_CAP_MILLI, isPlantable, isTillable } from './tile';
import { cropQualityScore, getFertilizer, qualityBonusYield, qualityFromScore } from './quality';

function canFitPotentialHarvestRewards(state: GameState, ctx: SimContext, crop: CropInstance, tileId: number): boolean {
  const herb = ctx.content.herbs.get(crop.defId);
  if (!herb) return false;

  const tile = state.tiles.find(entry => entry.id === tileId);
  if (!tile) return false;

  const greenhouseHarvestBonus = crop.greenhouseProtected ? greenhouseProtectedHarvestBonus(state) : { qualityScoreBonus: 0, yieldBonus: 0 };
  const qualityScore = Math.min(1, cropQualityScore(tile, crop) + greenhouseHarvestBonus.qualityScoreBonus);
  const quality = qualityFromScore(qualityScore);
  const bonusYield = qualityBonusYield(quality) + greenhouseHarvestBonus.yieldBonus;
  const [mainYield, ...secondaryYields] = herb.yield;
  const rewards = [];

  if (mainYield && mainYield.count + bonusYield > 0) {
    rewards.push({ itemId: mainYield.itemId, quality, count: mainYield.count + bonusYield });
  }
  for (const yieldDef of secondaryYields) {
    if ((yieldDef.chance ?? 1) <= 0 || yieldDef.count <= 0) continue;
    rewards.push({ itemId: yieldDef.itemId, count: yieldDef.count });
  }

  return inventoryCanFitRewards(state.player, rewards);
}

/**
 * 工具耐久消耗。
 * 设计为 sim 安全：未持有该工具时直接返回（凡人徒手，动作仍成功）→ headless bot 不持有工具，零回归。
 * 持有则每次操作消耗 1 耐久；归零损毁（移除背包）并发出 tool-broke 反馈。
 */
function wearTool(state: GameState, toolItemId: string, maxDurability: number): void {
  const slot = state.player.inventory[toolItemId];
  if (!slot) return; // 未持有：徒手操作，不阻塞
  slot.durability = (slot.durability ?? maxDurability) - 1;
  emit(state, 'tool-worn', { itemId: toolItemId, durability: slot.durability });
  if (slot.durability <= 0) {
    delete state.player.inventory[toolItemId];
    emit(state, 'tool-broke', { itemId: toolItemId });
  }
}

function crossTiles(state: GameState, x: number, y: number, maxCount: number) {
  const offsets = [
    { x: 0, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 }
  ];
  return offsets
    .slice(0, Math.max(1, Math.min(maxCount, offsets.length)))
    .map(d => tileAt(state, x + d.x, y + d.y))
    .filter((t): t is NonNullable<ReturnType<typeof tileAt>> => Boolean(t));
}

export function applyAction(state: GameState, a: PlayerAction, ctx: SimContext): void {
  const p = state.player;
  const params = ctx.params;
  const tryStamina = (cost: number): boolean => {
    const costMilli = cost * MILLI;
    if (p.stamina < costMilli) return false;
    p.stamina -= costMilli;
    return true;
  };

  switch (a.kind) {
    case 'move': {
      const t = tileAt(state, a.to.x, a.to.y);
      if (t && t.blockType === 'none') {
        p.position = { x: a.to.x, y: a.to.y };
      }
      return;
    }
    case 'till': {
      const candidates = crossTiles(state, a.at.x, a.at.y, toolAreaSize(state, 'till'));
      const tillable = candidates.filter(isTillable);
      if (tillable.length > 0 && tryStamina(params.player.tillStaminaCost * toolStaminaMultiplier(state, 'till'))) {
        for (const t of tillable) {
          if (t.soilType === 'scorched') t.soilType = 'loam';
          t.tilled = true;
          emit(state, 'till', { x: t.x, y: t.y });
        }
        wearTool(state, 'item.rust-hoe', params.tools?.hoeDurability ?? 50);
      }
      return;
    }
    case 'sow': {
      const t = tileAt(state, a.at.x, a.at.y);
      const herb = ctx.content.seedToHerb.get(a.seedId);
      if (!t || !herb || !isPlantable(t)) return;
      const greenhouseProtected = canPlantOffSeasonInGreenhouse(state, herb);
      if (isOffSeasonSeed(state, herb) && !greenhouseProtected) return;
      if (itemCount(p, a.seedId) <= 0) return;
      if (!tryStamina(params.player.channelStaminaCost)) return;
      mutateItem(p, a.seedId, -1);
      const id = nextEntityId(state);
      const crop: CropInstance = {
        id,
        defId: herb.id,
        tileId: t.id,
        growth: 0,
        health: 100 * MILLI,
        stage: 'seed',
        plantedDay: state.day,
        property: { ...herb.baseProperty },
        tempered: false,
        ...(greenhouseProtected ? { greenhouseProtected: true } : {})
      };
      state.crops.set(t.id, crop);
      t.cropId = id;
      emit(state, 'sow', { defId: herb.id, tileId: t.id });
      if (state.player.flags.has(FIRST_MARKET_RESTOCK_FLAG)) {
        state.player.flags.add(FIRST_SECOND_SOW_FLAG);
      }
      return;
    }
    case 'water': {
      const candidates = crossTiles(state, a.at.x, a.at.y, toolAreaSize(state, 'water'));
      const waterable = candidates.filter(t => t.cropId != null);
      if (waterable.length > 0 && tryStamina(params.player.waterStaminaCost * toolStaminaMultiplier(state, 'water'))) {
        for (const t of waterable) {
          t.wateredToday = true;
          t.moisture = Math.min(100 * MILLI, t.moisture + 30 * MILLI);
        }
        if (state.player.flags.has(FIRST_SECOND_SOW_FLAG)) {
          state.player.flags.add(FIRST_SECOND_WATER_FLAG);
        }
        wearTool(state, 'item.water-pail', params.tools?.pailDurability ?? 200);
      }
      return;
    }
    case 'fertilize': {
      const fertilizer = getFertilizer(a.itemId);
      const t = tileAt(state, a.at.x, a.at.y);
      if (!fertilizer || !t || !t.tilled || t.blockType !== 'none') return;
      if (itemCount(p, a.itemId) <= 0) return;
      if (!tryStamina(fertilizer.staminaCost)) return;
      mutateItem(p, a.itemId, -1);
      t.fertility = Math.min(FERTILITY_CAP_MILLI, t.fertility + fertilizer.fertilityGain);
      t.qiDensity = Math.min(FERTILITY_CAP_MILLI, t.qiDensity + fertilizer.qiGain);
      emit(state, 'fertilize', {
        itemId: a.itemId,
        x: a.at.x,
        y: a.at.y,
        fertility: t.fertility,
        qiDensity: t.qiDensity
      });
      return;
    }
    case 'channel-qi': {
      const t = tileAt(state, a.at.x, a.at.y);
      if (t && t.cropId != null && !t.channeledToday && tryStamina(params.player.channelStaminaCost)) {
        t.channeledToday = true;
      }
      return;
    }
    case 'harvest': {
      const t = tileAt(state, a.at.x, a.at.y);
      if (!t || t.cropId == null) return;
      const crop = state.crops.get(t.id);
      if (!crop) return;
      const herb = ctx.content.herbs.get(crop.defId);
      if (!herb) return;
      if (crop.growth < herb.growthThreshold) return; // 未熟不可收
      if (!canFitPotentialHarvestRewards(state, ctx, crop, t.id)) return;
      if (!tryStamina(params.player.waterStaminaCost * toolStaminaMultiplier(state, 'harvest'))) return;
      const greenhouseHarvestBonus = crop.greenhouseProtected ? greenhouseProtectedHarvestBonus(state) : { qualityScoreBonus: 0, yieldBonus: 0 };
      // 引雷阵覆盖的金属性灵草受天雷淬炼，收获品质与少量产量提升。
      const rodTempered = herb.metalAttract > 0 && hasActiveArrayCoverage(state, t.id, 'array.lightning-rod');
      const rodHarvestBonus = rodTempered ? { qualityScoreBonus: 0.12, yieldBonus: 1 } : { qualityScoreBonus: 0, yieldBonus: 0 };
      const qualityScore = Math.min(1, cropQualityScore(t, crop) + greenhouseHarvestBonus.qualityScoreBonus + rodHarvestBonus.qualityScoreBonus);
      const quality = qualityFromScore(qualityScore);
      const bonusYield = qualityBonusYield(quality) + greenhouseHarvestBonus.yieldBonus + rodHarvestBonus.yieldBonus;
      const [mainYield, ...secondaryYields] = herb.yield;
      let harvestedMain = 0;
      if (mainYield) {
        const ch = mainYield.chance ?? 1;
        if (ctx.rng.drop.chance(ch)) harvestedMain += mainYield.count;
      }
      const rewardPlan: Array<{ itemId: string; count: number } | { itemId: string; quality: typeof quality; count: number }> = [];
      for (const y of secondaryYields) {
        const ch = y.chance ?? 1;
        if (ctx.rng.drop.chance(ch)) rewardPlan.push({ itemId: y.itemId, count: y.count });
      }
      if (mainYield && harvestedMain + bonusYield > 0) {
        rewardPlan.push({ itemId: mainYield.itemId, quality, count: harvestedMain + bonusYield });
      }
      if (!inventoryCanFitRewards(p, rewardPlan)) return;
      for (const reward of rewardPlan) {
        if ('quality' in reward) mutateQualityItem(p, reward.itemId, reward.quality, reward.count);
        else mutateItem(p, reward.itemId, reward.count);
      }
      state.crops.delete(t.id);
      t.cropId = null;
      t.consecutiveSameCropSeasons = t.lastHarvestedCropDefId === herb.id ? t.consecutiveSameCropSeasons + 1 : 1;
      t.lastHarvestedCropDefId = herb.id;
      // 偷天诀吸收灵草灵气 → 积累修为
      p.cultivation += herb.tier * ctx.params.breakthrough.harvestCultivationPerTier;
      p.bodyFoundation += herb.tier * ctx.params.breakthrough.harvestCultivationPerTier;
      emit(state, 'harvest', {
        defId: herb.id,
        quality,
        qualityScore,
        bonusYield,
        greenhouseProtected: crop.greenhouseProtected === true,
        greenhouseQualityScoreBonus: greenhouseHarvestBonus.qualityScoreBonus,
        greenhouseYieldBonus: greenhouseHarvestBonus.yieldBonus,
        // 引雷阵淬炼仅在触发时附加字段，保持非淬炼收获的事件载荷与旧版逐字节一致（golden replay 稳定）。
        ...(rodTempered ? { rodTempered, rodQualityScoreBonus: rodHarvestBonus.qualityScoreBonus, rodYieldBonus: rodHarvestBonus.yieldBonus } : {})
      });
      state.player.flags.add(FIRST_HARVEST_FLAG);
      wearTool(state, 'item.sickle', ctx.params.tools?.sickleDurability ?? 80);
      return;
    }
    case 'ship-item': {
      shipItem(state, a.itemId, a.count, ctx);
      return;
    }
    case 'ship-quality-item': {
      shipQualityItem(state, a.itemId, a.quality, a.count, ctx);
      return;
    }
    case 'deposit-item': {
      depositItem(state, a.itemId, a.count);
      return;
    }
    case 'withdraw-item': {
      withdrawItem(state, a.itemId, a.count);
      return;
    }
    case 'deposit-quality-item': {
      depositQualityItem(state, a.itemId, a.quality, a.count);
      return;
    }
    case 'withdraw-quality-item': {
      withdrawQualityItem(state, a.itemId, a.quality, a.count);
      return;
    }
    case 'place-facility': {
      placeFacility(state, a.facilityKind, a.at.x, a.at.y, { free: a.free });
      return;
    }
    case 'start-drying-job': {
      startDryingJob(state, a.facilityId, a.itemId, ctx, a.quality);
      return;
    }
    case 'start-facility-recipe-job': {
      startFacilityRecipeJob(state, a.facilityId, a.recipeId);
      return;
    }
    case 'start-sealing-job': {
      startSealingJob(state, a.facilityId);
      return;
    }
    case 'start-furnace-job': {
      startFurnaceJob(state, a.facilityId);
      return;
    }
    case 'collect-facility': {
      collectFacility(state, a.facilityId);
      return;
    }
    case 'dry-herb': {
      dryHerb(state, a.itemId, ctx, a.quality);
      return;
    }
    case 'seal-herb': {
      sealHerb(state);
      return;
    }
    case 'buy-shop-item': {
      buyShopItem(state, a.itemId, a.count);
      return;
    }
    case 'buy-festival-stall-item': {
      buyFestivalStallItem(state, a.itemId, ctx);
      return;
    }
    case 'explore': {
      exploreSite(state, a.site, ctx);
      return;
    }
    case 'delve-ruin': {
      delveRuin(state, ctx);
      return;
    }
    case 'upgrade': {
      performUpgrade(state, a.upgradeId);
      return;
    }
    case 'give-gift': {
      giveGift(state, a.npcId, a.itemId);
      return;
    }
    case 'complete-commission': {
      completeCommission(state, a.commissionId, ctx);
      return;
    }
    case 'resolve-staying-world-incident': {
      resolveStayingWorldIncident(state, ctx);
      return;
    }
    case 'accept-special-order': {
      acceptSpecialOrder(state, a.orderId);
      return;
    }
    case 'submit-special-order': {
      submitSpecialOrderItems(state, a.orderId, a.count);
      return;
    }
    case 'claim-special-order': {
      claimSpecialOrder(state, a.orderId);
      return;
    }
    case 'claim-mainline-quest': {
      claimMainlineQuest(state, a.questId);
      return;
    }
    case 'claim-ruin-chapter': {
      claimRuinChapter(state, a.chapterId);
      return;
    }
    case 'claim-npc-quest': {
      claimNpcQuest(state, a.questId);
      return;
    }
    case 'donate-archive': {
      donateToArchive(state, a.donationId);
      return;
    }
    case 'claim-archive-milestone': {
      claimArchiveMilestone(state, a.milestoneId);
      return;
    }
    case 'participate-festival': {
      participateFestival(state, ctx);
      return;
    }
    case 'train': {
      const cfg = params.bodyCultivation;
      const table = {
        'push-up': { stamina: cfg.pushUpStaminaCost, gain: cfg.pushUpGain, label: 'push-up' },
        'sit-up': { stamina: cfg.sitUpStaminaCost, gain: cfg.sitUpGain, label: 'sit-up' },
        squat: { stamina: cfg.squatStaminaCost, gain: cfg.squatGain, label: 'squat' },
        'long-run': { stamina: cfg.longRunStaminaCost, gain: cfg.longRunGain, label: 'long-run' }
      } as const;
      const entry = table[a.method];
      if (!tryStamina(entry.stamina)) return;
      p.bodyFoundation += entry.gain;
      p.cultivation += entry.gain;
      p.endurance += cfg.endurancePerSet;
      p.willpower += cfg.willpowerPerSet;
      emit(state, 'body-training', { method: entry.label, bodyGain: entry.gain });
      return;
    }
    case 'invoke-tribulation': {
      invokeTribulation(state, ctx);
      return;
    }
    case 'hunt-beast': {
      const surge = state.beastSurge;
      const cfg = params.celestial.beast;
      if (!surge || surge.beastsRemaining <= 0 || !tryStamina(cfg.huntStaminaCost)) return;
      p.hp = Math.max(0, p.hp - cfg.huntDamage * MILLI);
      surge.beastsRemaining -= 1;
      let coreDropped = false;
      const coreDef = ctx.content.items.get('item.beast-core');
      const rolledCore = ctx.rng.drop.chance(cfg.lootChancePerBeast);
      if (rolledCore && coreDef && itemCount(p, coreDef.id) < coreDef.stack) {
        coreDropped = mutateItem(p, coreDef.id, 1);
        if (coreDropped) emit(state, 'beast-loot', { cores: 1, itemId: coreDef.id });
      }
      // 妖兽守护稀有种子：猎杀额外概率掉落 ~stage 阶种子
      const seedTierMax = Math.max(1, p.stage);
      const seedCandidates = [...ctx.content.herbs.values()].filter(h => h.tier >= 1 && h.tier <= seedTierMax);
      if (seedCandidates.length > 0 && ctx.rng.drop.chance(cfg.seedDropChance)) {
        const herb = ctx.rng.drop.pick(seedCandidates);
        if (mutateItem(p, herb.seedId, 1)) emit(state, 'beast-seed', { itemId: herb.seedId });
      }
      emit(state, 'beast-hunted', { beastsRemaining: surge.beastsRemaining, damage: cfg.huntDamage, coreDropped });
      if (surge.beastsRemaining <= 0) {
        emit(state, 'beast-surge-end', { beastsRemaining: 0, hunted: true });
        state.beastSurge = null;
      }
      return;
    }
    case 'tame-guard-beast': {
      tameGuardBeast(state, ctx);
      return;
    }
    case 'feed-guard-beast': {
      feedGuardBeast(state, ctx, a.herbItemId);
      return;
    }
    case 'assign-guard-beast-patrol': {
      assignGuardBeastPatrol(state, a.beastId, a.tileId);
      return;
    }
    case 'eat-raw': {
      const herb = ctx.content.herbs.get(a.herbDefId);
      if (!herb || itemCount(p, a.herbDefId) <= 0) return;
      mutateItem(p, a.herbDefId, -1);
      // 丹毒积累：高阶草对凡骨更致命
      const stageMul = ctx.params.pillPoison.rawEatMultBase + ctx.params.pillPoison.rawEatMultStageSlope * state.player.stage;
      const gain = herb.rawPoisonValue * stageMul;
      p.pillPoison = Math.min(ctx.params.pillPoison.cap * MILLI, p.pillPoison + gain);
      emit(state, 'eat-raw', { defId: herb.id, poisonGain: gain });
      return;
    }
    case 'rest': {
      if (!tryStamina(30)) return; // 静修耗体力
      p.hp = Math.min(p.maxHp, p.hp + 10 * MILLI);
      p.pillPoison = Math.max(0, p.pillPoison - ctx.params.pillPoison.restBonusMax * MILLI);
      emit(state, 'rest', {});
      return;
    }
  }
}
