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
      default:
        // ironBone/temperBoost/madness：M4 扩展
        effects.push(eff.kind);
        break;
    }
  }
  p.pillPoison = Math.min(ctx.params.pillPoison.cap * 1000, p.pillPoison + pill.load);
  emit(state, 'eat-pill', { pillId, effects });
  return { applied: true, effects };
}
