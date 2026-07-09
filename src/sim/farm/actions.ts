/**
 * 玩家动作应用（docs/04 控制 / docs/08 流程）。
 * 每个动作校验可行性（地块/库存/体力）后变更 state，并发事件。
 * 动作按 DayInput.actions 顺序执行；体力不足则跳过该动作（不致命错误）。
 */
import type { GameState } from '@sim/world/state';
import { tileAt, nextEntityId, emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { PlayerAction } from '@sim/world/input';
import { mutateItem, itemCount } from '@sim/world/player';
import { MILLI } from '@sim/world/types';
import type { CropInstance } from './crop';
import { isPlantable, isTillable } from './tile';

export function applyAction(state: GameState, a: PlayerAction, ctx: SimContext): void {
  const p = state.player;
  const params = ctx.params;
  const tryStamina = (cost: number): boolean => {
    if (p.stamina < cost * MILLI) return false;
    p.stamina -= cost * MILLI;
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
      const t = tileAt(state, a.at.x, a.at.y);
      if (t && isTillable(t) && tryStamina(params.player.tillStaminaCost)) {
        t.tilled = true;
        emit(state, 'till', { x: a.at.x, y: a.at.y });
      }
      return;
    }
    case 'sow': {
      const t = tileAt(state, a.at.x, a.at.y);
      const herb = ctx.content.seedToHerb.get(a.seedId);
      if (!t || !herb || !isPlantable(t)) return;
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
      };
      state.crops.set(t.id, crop);
      t.cropId = id;
      emit(state, 'sow', { defId: herb.id, tileId: t.id });
      return;
    }
    case 'water': {
      const t = tileAt(state, a.at.x, a.at.y);
      if (t && t.cropId != null && tryStamina(params.player.waterStaminaCost)) {
        t.wateredToday = true;
        t.moisture = Math.min(100 * MILLI, t.moisture + 30 * MILLI);
      }
      return;
    }
    case 'channel-qi': {
      const t = tileAt(state, a.at.x, a.at.y);
      if (t && t.cropId != null && tryStamina(params.player.channelStaminaCost)) {
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
      if (!tryStamina(params.player.waterStaminaCost)) return;
      for (const y of herb.yield) {
        const ch = y.chance ?? 1;
        if (ctx.rng.drop.chance(ch)) mutateItem(p, y.itemId, y.count);
      }
      state.crops.delete(t.id);
      t.cropId = null;
      t.consecutiveSameCropSeasons += 1;
      // 偷天诀吸收灵草灵气 → 积累修为（docs/09 §1；farm→progression 耦合）
      p.cultivation += herb.tier * ctx.params.breakthrough.harvestCultivationPerTier;
      emit(state, 'harvest', { defId: herb.id });
      return;
    }
    case 'eat-raw': {
      const herb = ctx.content.herbs.get(a.herbDefId);
      if (!herb || itemCount(p, a.herbDefId) <= 0) return;
      mutateItem(p, a.herbDefId, -1);
      // 丹毒积累（docs/06 §1.1 / 14 §3.1）：高阶草对凡骨更致命
      const stageMul =
        ctx.params.pillPoison.rawEatMultBase +
        ctx.params.pillPoison.rawEatMultStageSlope * state.player.stage;
      const gain = herb.rawPoisonValue * stageMul;
      p.pillPoison = Math.min(ctx.params.pillPoison.cap * MILLI, p.pillPoison + gain);
      emit(state, 'eat-raw', { defId: herb.id, poisonGain: gain });
      return;
    }
    case 'rest': {
      p.hp = Math.min(p.maxHp, p.hp + 10 * MILLI);
      p.pillPoison = Math.max(0, p.pillPoison - ctx.params.pillPoison.restBonusMax * MILLI);
      emit(state, 'rest', {});
      return;
    }
  }
}
