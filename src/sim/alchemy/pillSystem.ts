/**
 * 丹药服用。
 * applyPill：消耗丹药 → 应用效果（回血/清毒/承雷稳脉/强骨）+ 累积丹毒负荷。
 * wardMitigation 表示承雷丹临时稳住经络与空灵根裂隙，让雷气可入体淬炼但不至于立刻崩碎。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { mutateItem, itemCount } from '@sim/world/player';
import { triggerAscensionChoice } from '@sim/progression/postAscension';

export interface PillApplyResult {
  applied: boolean;
  effects: string[];
}

export function applyPill(state: GameState, pillId: string, ctx: SimContext): PillApplyResult {
  const p = state.player;
  const pill = ctx.content.pills.get(pillId);
  if (!pill || itemCount(p, pillId) <= 0) return { applied: false, effects: [] };

  // 飞升丹前置：未达飞升前夜（stage≥7）拒服，避免误服浪费通关道具
  if (pill.effects.some(e => e.kind === 'ascend') && p.stage < 7) {
    return { applied: false, effects: ['飞升前兆（需达飞升前夜 stage7）'] };
  }

  mutateItem(p, pillId, -1);

  const effects: string[] = [];
  for (const eff of pill.effects) {
    switch (eff.kind) {
      case 'heal':
        p.hp = Math.min(p.maxHp, p.hp + eff.power);
        effects.push(`回血${eff.power / 1000}`);
        break;
      case 'detox':
        p.pillPoison = Math.max(0, p.pillPoison - eff.power);
        effects.push(`清毒${eff.power / 1000}`);
        break;
      case 'lightningWard':
        p.wardMitigation = Math.max(p.wardMitigation, eff.power);
        effects.push(`承雷稳脉${Math.round(eff.power * 100)}%`);
        break;
      case 'maxHpUp':
        p.maxHp += eff.power;
        p.hp = Math.min(p.maxHp, p.hp + eff.power);
        effects.push(`强骨+${eff.power / 1000}上限`);
        break;
      case 'madness':
        // 走火丹：累积走火值，突破时触发走火入魔结局；blood-moon 等天象 ×madnessMod（T8）
        p.madnessValue += eff.power * (state.activeEvent?.madnessMod ?? 1);
        effects.push(`走火+${eff.power}`);
        break;
      case 'ascend':
        // 飞升丹：仅飞升前夜（stage≥7）服用触发飞升结局
        if (p.stage >= 7 && !state.gameOver) {
          if (triggerAscensionChoice(state)) effects.push('飞升在即');
          else effects.push('飞升抉择未定');
        } else {
          effects.push('飞升前兆（需达飞升前夜）');
        }
        break;
      case 'temperBoost':
        // 淬体丹：下次天劫淬体效率 ×power（取最强不叠加）
        p.temperBoostMult = Math.max(p.temperBoostMult, eff.power);
        effects.push(`淬体×${eff.power}`);
        break;
      case 'ironBone':
        // 铁骨丹：整场天劫减伤 power（与承雷稳脉叠加，取最强）
        p.ironBoneMitigation = Math.max(p.ironBoneMitigation, eff.power);
        effects.push(`铁骨减伤${Math.round(eff.power * 100)}%`);
        break;
      default:
        effects.push(eff.kind);
        break;
    }
  }
  p.pillPoison = Math.min(ctx.params.pillPoison.cap * 1000, p.pillPoison + pill.load);
  emit(state, 'eat-pill', { pillId, effects });
  return { applied: true, effects };
}
