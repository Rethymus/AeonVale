/**
 * 进阶系统：《偷天换劫诀》阶段 / 突破。
 *
 * 核心循环闭环：苦练/种田→炼丹→主动引劫→天劫淬体→体魄根基达标→突破。
 * 凡人恒弱（C5）：maxHP 缓涨、baseDamage 陡涨；突破成功率受丹毒惩罚（炼丹闭环）。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { BalanceParams } from '@sim/params';
import type { CultivationStage } from '@sim/world/types';
import { MILLI } from '@sim/world/types';
import { itemCount } from '@sim/world/player';
import { bodyFoundationCap, isPostAscensionProgressionFrozen, normalizeBodyCultivation, readyToInvokeTribulation } from './bodyCultivation';

/** 阶段修为上限。 */
export function stageQiCap(stage: CultivationStage, params: BalanceParams): number {
  return bodyFoundationCap(stage, params);
}

/** 是否体魄根基已满、可主动引劫→突破。 */
export function readyForBreakthrough(state: GameState, params: BalanceParams): boolean {
  return readyToInvokeTribulation(state, params);
}

/**
 * 突破准备度评分。
 *
 * 阵法完整度（arrayScore）+ 丹药齐备度（pillScore）两轴：
 * arrayScore = min(activeArrays / MIN_ARRAYS, 1.0) 阵法数 ≥ MIN_ARRAYS(2) 即满分
 * pillScore = 有避雷丹（ward-basic 或 ward-greater）→ 1.0，无 → 0.0
 * prepScore = 0.4 × arrayScore + 0.6 × pillScore ∈ [0, 1]
 *
 * 这是"种田—炼丹—布阵—渡劫"闭环在数值上的体现：充分准备→更高突破成功率。
 */
export function computePrepScore(state: GameState): number {
  const MIN_ARRAYS = 2;
  const activeArrays = [...state.arrays.values()].filter(a => a.active).length;
  const arrayScore = Math.min(activeArrays / MIN_ARRAYS, 1.0);

  // 丹药齐备度：wardMitigation>0（服丹后设置）OR 背包有避雷丹（可在突破前服用）
  const hasWardPill = state.player.wardMitigation > 0 || itemCount(state.player, 'pill.ward-basic') > 0 || itemCount(state.player, 'pill.ward-greater') > 0 || itemCount(state.player, 'pill.ward-heaven') > 0;
  const pillScore = hasWardPill ? 1.0 : 0.0;

  return 0.4 * arrayScore + 0.6 * pillScore;
}

export interface BreakthroughResult {
  success: boolean;
  madness: boolean;
  newStage: CultivationStage;
  prepScore: number; // 本次突破时的准备度（调试/测试用）
}

/**
 * 突破。前提：修为满 + 刚扛过天劫。
 * 成功率公式：successRate ∈ [0.05,0.95]，丹毒是最大负权（炼丹闭环）。
 * 走火入魔：madnessValue 高时概率触发（负面/结局）。
 */
export function breakthrough(state: GameState, ctx: SimContext, survivedTribulation: boolean): BreakthroughResult {
  const p = state.player;
  const params = ctx.params;
  normalizeBodyCultivation(state, params);
  if (isPostAscensionProgressionFrozen(state)) {
    return { success: false, madness: false, newStage: p.stage, prepScore: 0 };
  }
  if (!readyForBreakthrough(state, params) || !survivedTribulation) {
    return { success: false, madness: false, newStage: p.stage, prepScore: 0 };
  }

  // 走火入魔检定
  const madnessChance = p.madnessValue / (params.breakthrough.madnessCap * 2);
  if (ctx.rng.alchemy.next() < madnessChance) {
    state.ending = 'madness';
    state.gameOver = true;
    p.madnessValue = 0;
    emit(state, 'ending', { ending: 'madness' });
    return { success: false, madness: true, newStage: p.stage, prepScore: 0 };
  }

  // 准备度评分（M3：阵法完整度 + 丹药齐备度）
  const prepScore = computePrepScore(state);

  const cap = stageQiCap(p.stage, params);
  const xSurplus = Math.min(0.3, (p.bodyFoundation - cap) / cap);
  let successRate = params.breakthrough.successBase + params.breakthrough.successPrepBonus * prepScore + params.breakthrough.successXSurplus * xSurplus + params.breakthrough.successPoisonPenalty * (p.pillPoison / (params.pillPoison.cap * 1000));
  successRate = Math.max(0.05, Math.min(0.95, successRate));

  if (ctx.rng.alchemy.next() > successRate) {
    // 险胜：留在原阶段，体魄根基折损 30%（可挽回的局部失败）
    p.bodyFoundation = Math.round(p.bodyFoundation * 0.7);
    p.cultivation = Math.round(p.cultivation * 0.7);
    emit(state, 'breakthrough-near', { stage: p.stage });
    return { success: false, madness: false, newStage: p.stage, prepScore };
  }

  // 突破成功
  const oldCap = stageQiCap(p.stage, params);
  const newStage = Math.min(7, p.stage + 1) as CultivationStage;
  p.stage = newStage;
  p.bodyFoundation = Math.round((p.bodyFoundation - oldCap) * 0.3); // 溢出保留 30%
  p.cultivation = p.bodyFoundation; // 兼容旧 UI/测试的镜像值
  p.temperingStack = 0;
  p.maxHp = (params.player.stageMaxHp[newStage - 1] ?? 100) * MILLI; // 阶段 maxHP（点→毫点）
  p.hp = p.maxHp; // 突破回满
  p.pillPoison = Math.round(p.pillPoison * 0.5); // 突破排毒
  p.lifespanRemainingDays += params.bodyCultivation.lifespanBreakthroughGain;
  p.daoAttention = Math.round(p.daoAttention * 0.85);
  emit(state, 'breakthrough', { stage: newStage });
  // 高阶灵草种子获取改由 游方散仙赠种 + 猎妖掉种（rate-limited）提供；
  // 突破发种会灌满 proxy 16 格背包→挤掉避雷丹/飞升丹发放→代理崩，故不在此发。
  // 突破至 stage 7（飞升前夜）：不再自动飞升——需炼服飞升丹 pill.ascend 才达成飞升结局
  if (newStage === 7) {
    emit(state, 'eve-of-ascension', { stage: 7 });
  }
  return { success: true, madness: false, newStage, prepScore };
}
