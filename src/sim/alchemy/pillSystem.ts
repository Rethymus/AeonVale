/**
 * 丹药服用（docs/06 §7.2 / docs/15 §3）。
 * applyPill：消耗丹药 → 应用效果（回血/清毒/避雷护体/强骨）+ 累积丹毒负荷。
 * wardMitigation 在下次天劫中减伤，渡劫后消耗。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { mutateItem, itemCount } from '@sim/world/player';

export interface PillApplyResult {
  applied: boolean;
  effects: string[];
}

export function applyPill(state: GameState, pillId: string, ctx: SimContext): PillApplyResult {
  const p = state.player;
  const pill = ctx.content.pills.get(pillId);
  if (!pill || itemCount(p, pillId) <= 0) return { applied: false, effects: [] };

  // 飞升丹前置：未达飞升前夜（stage≥7）拒服，避免误服浪费通关道具（docs/15 §3 pill.ascend）
  if (pill.effects.some((e) => e.kind === 'ascend') && p.stage < 7) {
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
        effects.push(`避雷护体${Math.round(eff.power * 100)}%`);
        break;
      case 'maxHpUp':
        p.maxHp += eff.power;
        p.hp = Math.min(p.maxHp, p.hp + eff.power);
        effects.push(`强骨+${eff.power / 1000}上限`);
        break;
      case 'madness':
        p.madnessValue += eff.power; // 走火丹：累积走火值，突破时触发走火入魔结局
        effects.push(`走火+${eff.power}`);
        break;
      case 'ascend':
        // 飞升丹：仅飞升前夜（stage≥7）服用触发飞升结局（docs/14 §8.1 stage7=飞升前夜 / docs/15 §3）
        if (p.stage >= 7 && !state.gameOver) {
          state.ending = 'ascension';
          state.gameOver = true;
          emit(state, 'ending', { ending: 'ascension' });
          effects.push('白日飞升');
        } else {
          effects.push('飞升前兆（需达飞升前夜）');
        }
        break;
      case 'temperBoost':
        // 淬体丹：下次天劫淬体效率 ×power（取最强不叠加，docs/15 §3）
        p.temperBoostMult = Math.max(p.temperBoostMult, eff.power);
        effects.push(`淬体×${eff.power}`);
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
