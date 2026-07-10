/**
 * 进阶系统：《偷天换劫诀》阶段 / 突破（docs/09 / docs/14 §8）。
 *
 * 核心循环闭环：farm→alchemy→tribulation(淬体累积 cultivation)→cultivation≥xCap→突破→下一阶段。
 * 凡人恒弱（C5）：maxHP 缓涨、baseDamage 陡涨；突破成功率受丹毒惩罚（炼丹闭环）。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { BalanceParams } from '@sim/params';
import type { CultivationStage } from '@sim/world/types';

/** 阶段修为上限（docs/14 §8.1 / 09 §1.1，7 阶 ×1.8）。 */
export function stageQiCap(stage: CultivationStage, params: BalanceParams): number {
  return params.breakthrough.xCap[stage - 1] ?? Number.POSITIVE_INFINITY;
}

/** 是否修为满、可触发天劫→突破（docs/05 §1.1）。 */
export function readyForBreakthrough(state: GameState, params: BalanceParams): boolean {
  return state.player.stage >= 1 && state.player.stage <= 6 && state.player.cultivation >= stageQiCap(state.player.stage, params);
}

export interface BreakthroughResult {
  success: boolean;
  madness: boolean;
  newStage: CultivationStage;
}

/**
 * 突破（docs/09 §3）。前提：修为满 + 刚扛过天劫。
 * 成功率公式（docs/14 §8.3）：successRate ∈ [0.05,0.95]，丹毒是最大负权（炼丹闭环）。
 * 走火入魔：madnessValue 高时概率触发（负面/结局）。
 */
export function breakthrough(state: GameState, ctx: SimContext, survivedTribulation: boolean): BreakthroughResult {
  const p = state.player;
  const params = ctx.params;
  if (!readyForBreakthrough(state, params) || !survivedTribulation) {
    return { success: false, madness: false, newStage: p.stage };
  }

  // 走火入魔检定（docs/09 §3.3 / docs/02 走火入魔结局）
  const madnessChance = p.madnessValue / (params.breakthrough.madnessCap * 2);
  if (ctx.rng.alchemy.next() < madnessChance) {
    state.ending = 'madness';
    state.gameOver = true;
    p.madnessValue = 0;
    emit(state, 'ending', { ending: 'madness' });
    return { success: false, madness: true, newStage: p.stage };
  }

  // 成功率（docs/14 §8.3）
  const prepScore = 0.5; // 简化：M3 接入阵法完整度/丹药齐备度
  const xSurplus = Math.min(0.3, (p.cultivation - stageQiCap(p.stage, params)) / stageQiCap(p.stage, params));
  let successRate =
    params.breakthrough.successBase +
    params.breakthrough.successPrepBonus * prepScore +
    params.breakthrough.successXSurplus * xSurplus +
    params.breakthrough.successPoisonPenalty * (p.pillPoison / (params.pillPoison.cap * 1000));
  successRate = Math.max(0.05, Math.min(0.95, successRate));

  if (ctx.rng.alchemy.next() > successRate) {
    // 险胜：留在原阶段，修为折损 30%（可挽回的局部失败，docs/09 §3.3）
    p.cultivation = Math.round(p.cultivation * 0.7);
    emit(state, 'breakthrough-near', { stage: p.stage });
    return { success: false, madness: false, newStage: p.stage };
  }

  // 突破成功
  const oldCap = stageQiCap(p.stage, params);
  const newStage = Math.min(7, p.stage + 1) as CultivationStage;
  p.stage = newStage;
  p.cultivation = Math.round((p.cultivation - oldCap) * 0.3); // 溢出保留 30%
  p.temperingStack = 0;
  p.maxHp = params.player.stageMaxHp[newStage - 1] ?? p.maxHp;
  p.hp = p.maxHp; // 突破回满
  p.pillPoison = Math.round(p.pillPoison * 0.5); // 突破排毒
  emit(state, 'breakthrough', { stage: newStage });
  // 突破至 stage 7（飞升前夜）→ 达成飞升结局（docs/02 正结局）
  if (newStage === 7) {
    state.ending = 'ascension';
    state.gameOver = true;
    emit(state, 'ending', { ending: 'ascension' });
  }
  return { success: true, madness: false, newStage };
}
