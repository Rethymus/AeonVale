/**
 * 炼丹系统。
 *
 * resolveBrew：纯函数，给定材料 + 平均火候 + 玩家阶段 → 解析产出（炸炉/成丹/残丹/废丹）。
 * 流程：聚合药性向量（按提取系数）→ 七情配伍汇总 → 炸炉判定（相反必炸 OR 寒热冲突超阈）
 * → 配方多重集匹配 + 火候/药性对齐打分 → 最高分产出。
 * brewPills：消耗材料 + 应用结果（出丹/炸炉伤/丹毒）。
 *
 * 这是"非线性炼丹"的数学实现：同料异火/异序出异丹（涌现），七情决定增效/净毒/炸炉。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { RecipeDef } from '@content/defs';
import type { PropertyVector } from '@sim/world/types';
import { inventoryCanFitRewards, mutateItem, itemCount } from '@sim/world/player';
import { FIRST_HARVEST_FLAG, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG } from '@sim/story/onboarding';
import * as Pv from './property';
import { summarizePairings } from './compatibility';

export interface BrewMaterial {
  herbId: string;
  qty: number;
}
export interface BrewInput {
  materials: BrewMaterial[];
  avgHeatMilli: number; // 炼制全程平均火候
}
export interface BrewResult {
  outcome: 'exploded' | 'pill' | 'flawed' | 'waste';
  pillId?: string;
  quality: number; // 0..1
  poisonGainMilli: number;
  hpDamageMilli: number;
  furnaceVec: PropertyVector;
  /** R3-C2-b：药性冲突接近炸炉但未炸（conflict ∈ (explosion×conflictRatio, explosion)），UI 亚阈警告。 */
  warningConflict?: boolean;
}

export interface TutorialBrewAttemptResult {
  attempted: boolean;
  completed: boolean;
  retryable: boolean;
  brew: BrewResult | null;
  reason?: 'harvest-required' | 'already-completed' | 'kit-unavailable' | 'recipe-unavailable' | 'inventory-full';
}

const TUTORIAL_WARD_RECIPE_ID = 'recipe.ward-pill';

function multisetEqual(a: { herbId: string; qty: number }[], b: { herbId: string; qty: number }[]): boolean {
  if (a.length === 0 && b.length === 0) return false; // 空炉不匹配任何配方
  const ma = new Map<string, number>();
  for (const x of a) ma.set(x.herbId, (ma.get(x.herbId) ?? 0) + x.qty);
  const mb = new Map<string, number>();
  for (const x of b) mb.set(x.herbId, (mb.get(x.herbId) ?? 0) + x.qty);
  if (ma.size !== mb.size) return false;
  for (const [k, v] of ma) if (mb.get(k) !== v) return false;
  return true;
}

/** 纯函数：解析一次炼制的产出（不修改 state）。 */
export function resolveBrew(state: GameState, input: BrewInput, ctx: SimContext): BrewResult {
  const { params, content } = ctx;
  const stage = state.player.stage;

  // 1. 展开材料 + 七情汇总
  const herbIds: string[] = [];
  for (const m of input.materials) for (let i = 0; i < m.qty; i++) herbIds.push(m.herbId);
  const pairing = summarizePairings(herbIds);

  // 2. 聚合炉内药性向量（按提取系数）
  let furnaceVec: PropertyVector = Pv.ZERO_PROPERTY;
  for (const m of input.materials) {
    const herb = content.herbs.get(m.herbId);
    if (!herb) continue;
    const natH = Pv.naturalHeat(herb.baseProperty);
    const ext = Pv.extraction(input.avgHeatMilli, natH);
    furnaceVec = Pv.add(furnaceVec, Pv.scale(herb.baseProperty, m.qty * ext));
  }

  // 3. 炸炉判定：相反必炸 OR 寒热冲突 > explosionThreshold(stage)
  const expThreshold = (params.alchemy.explosionThresholdBase + params.alchemy.explosionThresholdStageSlope * stage + (state.activeEvent?.alchemyTolMod ?? 0)) * 1000;
  const conflict = Pv.conflictMagnitude(furnaceVec);
  if (pairing.guaranteedExplosion || conflict > expThreshold) {
    //：丹毒反噬 20、HP 伤 15
    return { outcome: 'exploded', quality: 0, poisonGainMilli: 20_000, hpDamageMilli: 15_000, furnaceVec };
  }
  // R3-C2-b：亚阈警告——药性冲突接近炸炉（conflict > explosion×conflictRatio，docs/06 §5.2 / docs/20 R7）。
  const warningConflict = conflict > expThreshold * params.alchemy.conflictRatio;

  // 4. 配方匹配（材料多重集）+ 打分
  const candidates = [...content.recipes.values()].filter(r => multisetEqual(r.inputs, input.materials));
  let best: { recipe: RecipeDef; score: number } | null = null;
  for (const r of candidates) {
    const [lo, hi] = r.idealHeatRange;
    const center = (lo + hi) / 2;
    const half = (hi - lo) / 2 || 1;
    const dev = Math.abs(input.avgHeatMilli - center) / half;
    const heatScore = dev <= 1 ? 1 : Math.max(0, 1 - (dev - 1)); // 区间内满分，外线性衰减
    const propAlign = Pv.balanceScore(furnaceVec, r.targetProperty, params.alchemy.balanceNorm * 1000);
    const score = (0.45 * heatScore + 0.45 * propAlign + 0.1) * pairing.qualityMult;
    if (!best || score > best.score) best = { recipe: r, score };
  }

  const score = best?.score ?? 0;
  if (!best || score < 0.4) {
    return { outcome: 'waste', quality: score, poisonGainMilli: 3_000, hpDamageMilli: 0, furnaceVec, warningConflict };
  }
  const pillDef = best.recipe.outputPillId ? content.pills.get(best.recipe.outputPillId) : undefined;
  const load = (pillDef?.load ?? 0) * pairing.poisonRetention;
  const outcome = score >= 0.7 ? 'pill' : 'flawed';
  return {
    outcome,
    pillId: best.recipe.outputPillId,
    quality: score,
    poisonGainMilli: Math.max(0, load),
    hpDamageMilli: 0,
    furnaceVec,
    warningConflict
  };
}

/** 应用已解析的炼丹结果；正式炼丹与教学成丹共享此副作用入口。 */
function applyResolvedBrew(state: GameState, res: BrewResult, ctx: SimContext): void {
  const p = state.player;
  const poisonCap = ctx.params.pillPoison.cap * 1000;
  if (res.outcome === 'exploded') {
    p.pillPoison = Math.min(poisonCap, p.pillPoison + res.poisonGainMilli);
    p.hp = Math.max(0, p.hp - res.hpDamageMilli);
    emit(state, 'furnace-explosion', { poison: res.poisonGainMilli, hp: res.hpDamageMilli });
  } else if (res.outcome === 'pill' || res.outcome === 'flawed') {
    if (res.pillId) mutateItem(state.player, res.pillId, 1);
    p.pillPoison = Math.min(poisonCap, p.pillPoison + res.poisonGainMilli);
    emit(state, 'brew-success', { pillId: res.pillId, quality: res.quality, flawed: res.outcome === 'flawed' });
  } else {
    p.pillPoison = Math.min(poisonCap, p.pillPoison + res.poisonGainMilli);
    emit(state, 'brew-waste', {});
  }
}

/** 执行炼丹：消耗材料并应用结果。材料不足则不消耗、不出丹。返回结果。 */
export function brewPills(state: GameState, input: BrewInput, ctx: SimContext): BrewResult {
  for (const m of input.materials) {
    if (itemCount(state.player, m.herbId) < m.qty) {
      return { outcome: 'waste', quality: 0, poisonGainMilli: 0, hpDamageMilli: 0, furnaceVec: Pv.ZERO_PROPERTY };
    }
  }
  const res = resolveBrew(state, input, ctx);
  if ((res.outcome === 'pill' || res.outcome === 'flawed') && res.pillId && !inventoryCanFitRewards(state.player, [{ itemId: res.pillId, count: 1 }], ctx.content)) {
    return { outcome: 'waste', quality: 0, poisonGainMilli: 0, hpDamageMilli: 0, furnaceVec: res.furnaceVec };
  }
  for (const m of input.materials) mutateItem(state.player, m.herbId, -m.qty);
  applyResolvedBrew(state, res, ctx);
  return res;
}

/** 首次收获后准备一份不可出售、不会进入背包的正式承雷丹药材包。 */
export function prepareTutorialAlchemyKit(state: GameState, ctx: SimContext): boolean {
  const flags = state.player.flags;
  if (!flags.has(FIRST_HARVEST_FLAG)) return false;
  if (flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG) || flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)) return false;
  const recipe = ctx.content.recipes.get(TUTORIAL_WARD_RECIPE_ID);
  if (!recipe) return false;
  flags.add(TUTORIAL_ALCHEMY_KIT_FLAG);
  emit(state, 'tutorial-alchemy-kit-ready', {
    recipeId: recipe.id,
    inputs: recipe.inputs.map(input => ({ ...input }))
  });
  return true;
}

/** 用虚拟药包执行正式承雷丹方；失败保留药包，成功只产一枚并永久门禁。 */
export function brewTutorialWardPill(state: GameState, avgHeatMilli: number, ctx: SimContext): TutorialBrewAttemptResult {
  const flags = state.player.flags;
  if (!flags.has(FIRST_HARVEST_FLAG)) return { attempted: false, completed: false, retryable: false, brew: null, reason: 'harvest-required' };
  if (flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)) return { attempted: false, completed: true, retryable: false, brew: null, reason: 'already-completed' };
  if (!flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)) return { attempted: false, completed: false, retryable: true, brew: null, reason: 'kit-unavailable' };
  const recipe = ctx.content.recipes.get(TUTORIAL_WARD_RECIPE_ID);
  if (!recipe) return { attempted: false, completed: false, retryable: false, brew: null, reason: 'recipe-unavailable' };

  const heat = Math.max(0, Math.min(100_000, Math.round(Number.isFinite(avgHeatMilli) ? avgHeatMilli : 0)));
  const input = { materials: recipe.inputs.map(entry => ({ herbId: entry.herbId, qty: entry.qty })), avgHeatMilli: heat };
  const brew = resolveBrew(state, input, ctx);
  const completesTutorial = (brew.outcome === 'pill' || brew.outcome === 'flawed') && brew.pillId === recipe.outputPillId;
  if (completesTutorial && !inventoryCanFitRewards(state.player, [{ itemId: recipe.outputPillId, count: 1 }], ctx.content)) {
    emit(state, 'tutorial-brew-rejected', { reason: 'inventory-full', recipeId: recipe.id });
    return { attempted: false, completed: false, retryable: true, brew: null, reason: 'inventory-full' };
  }

  if (completesTutorial) {
    applyResolvedBrew(state, brew, ctx);
    flags.delete(TUTORIAL_ALCHEMY_KIT_FLAG);
    flags.add(TUTORIAL_ALCHEMY_BREWED_FLAG);
  }
  emit(state, 'tutorial-brew-resolved', {
    recipeId: recipe.id,
    pillId: brew.pillId,
    avgHeatMilli: heat,
    outcome: brew.outcome,
    quality: brew.quality,
    completed: completesTutorial,
    retryable: !completesTutorial
  });
  return { attempted: true, completed: completesTutorial, retryable: !completesTutorial, brew };
}
