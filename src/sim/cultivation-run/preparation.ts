/** D27-d：把一世日程状态压缩成天劫模块可消费的纯数据契约。 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import type { BlockKind } from '@sim/sokoban/types';
import { clampInt } from './pressure';
import type { CultivationRunState } from './types';

export type PreparedHerbKind = 'conductive-moss';

export interface PreparedHerb {
  readonly kind: PreparedHerbKind;
  readonly count: number;
}

export interface TribulationPreparation {
  readonly minTemperingPower: number;
  readonly maxSurvivablePower: number;
  readonly sweetSpotMinPower: number;
  readonly sweetSpotMaxPower: number;
  readonly moveBudgetBonus: number;
  readonly previewLevel: number;
  readonly undoCharges: number;
  readonly wardCharges: number;
  readonly protectedHerbCount: number;
  readonly unlockedBlockKinds: readonly Exclude<BlockKind, 'none'>[];
  readonly startingHerbs: readonly PreparedHerb[];
  readonly sourcePowerBonus: number;
  readonly eventPowerModifierMilli: number;
  readonly pressure: number;
  readonly mortalHeart: number;
}

/** 事件与参悟通过显式修正接入；不让 preparation 反向读取内容模块。 */
export interface TribulationPreparationModifiers {
  readonly minTemperingPowerBonus?: number;
  readonly maxSurvivablePowerBonus?: number;
  readonly moveBudgetBonus?: number;
  readonly previewLevelBonus?: number;
  readonly undoChargesBonus?: number;
  readonly wardChargesBonus?: number;
  readonly protectedHerbCountBonus?: number;
  readonly sourcePowerBonus?: number;
  readonly eventPowerModifierMilli?: number;
  readonly unlockedBlockKinds?: readonly Exclude<BlockKind, 'none'>[];
}

function finiteFloor(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Math.floor(value!) : fallback;
}

function nonNegativeFloor(value: number | undefined): number {
  return Math.max(0, finiteFloor(value));
}

function uniqueBlockKinds(kinds: readonly Exclude<BlockKind, 'none'>[] | undefined): readonly Exclude<BlockKind, 'none'>[] {
  if (!kinds) return [];
  const allowed: readonly Exclude<BlockKind, 'none'>[] = ['mirror', 'conductor', 'insulator'];
  return allowed.filter(kind => kinds.includes(kind));
}

export function deriveTribulationPreparation(
  state: CultivationRunState,
  modifiers: TribulationPreparationModifiers = {},
  params: BalanceParams = DEFAULT_BALANCE
): TribulationPreparation {
  const resolved = withDefaultBalanceParams(params).cultivationRun.tribulation;
  const minTemperingPower = Math.max(
    0,
    resolved.baseMinTemperingPower
      + state.stage * resolved.stageMinTemperingPower
      + Math.floor(state.willpower / resolved.willpowerPerMinPower)
      + finiteFloor(modifiers.minTemperingPowerBonus)
  );
  const pressureOverage = Math.max(0, state.pressure - resolved.pressurePenaltyThreshold);
  const rawMaxPower = resolved.baseMaxSurvivablePower
    + state.stage * resolved.stageMaxSurvivablePower
    + Math.floor(state.bodyFoundation / resolved.bodyFoundationPerMaxPower)
    + Math.floor(state.endurance / resolved.endurancePerMaxPower)
    - Math.floor(state.injury / resolved.injuryPerMaxPowerPenalty)
    - Math.floor(pressureOverage / resolved.pressurePerMaxPowerPenalty)
    + finiteFloor(modifiers.maxSurvivablePowerBonus);
  const maxSurvivablePower = Math.max(minTemperingPower + resolved.minimumSafeWidth, rawMaxPower);
  const safeWidth = maxSurvivablePower - minTemperingPower;
  const sweetInset = Math.floor((safeWidth * resolved.sweetSpotInsetMilli) / 1000);
  const sweetSpotMinPower = minTemperingPower + sweetInset;
  const sweetSpotMaxPower = maxSurvivablePower - sweetInset;
  const previewLevel = clampInt(
    Math.floor(state.insight / resolved.insightPerPreviewLevel) + finiteFloor(modifiers.previewLevelBonus),
    0,
    resolved.maxPreviewLevel
  );
  // 丹药分配互斥：先保留一丹一护持，达到 ward 上限后，剩余丹药才按配比折算撤步。
  const wardChargesFromPills = Math.min(state.pills, resolved.maxWardCharges);
  const remainingPills = Math.max(0, state.pills - wardChargesFromPills);
  const pillsPerUndoCharge = Math.max(1, Math.floor(resolved.pillsPerUndoCharge));
  const undoCharges = clampInt(
    Math.floor(remainingPills / pillsPerUndoCharge) + finiteFloor(modifiers.undoChargesBonus),
    0,
    resolved.maxUndoCharges
  );
  const wardCharges = clampInt(
    wardChargesFromPills + finiteFloor(modifiers.wardChargesBonus),
    0,
    resolved.maxWardCharges
  );
  const protectedHerbCount = clampInt(
    state.herbs + finiteFloor(modifiers.protectedHerbCountBonus),
    0,
    resolved.maxPreparedHerbs
  );
  const eventPowerModifierMilli = Math.max(1, finiteFloor(modifiers.eventPowerModifierMilli, 1000));

  return {
    minTemperingPower,
    maxSurvivablePower,
    sweetSpotMinPower,
    sweetSpotMaxPower,
    moveBudgetBonus: Math.floor(state.mortalHeart / resolved.mortalHeartPerMoveBudgetBonus) + nonNegativeFloor(modifiers.moveBudgetBonus),
    previewLevel,
    undoCharges,
    wardCharges,
    protectedHerbCount,
    unlockedBlockKinds: uniqueBlockKinds(modifiers.unlockedBlockKinds),
    startingHerbs: protectedHerbCount > 0 ? [{ kind: 'conductive-moss', count: protectedHerbCount }] : [],
    sourcePowerBonus: finiteFloor(modifiers.sourcePowerBonus),
    eventPowerModifierMilli,
    pressure: state.pressure,
    mortalHeart: state.mortalHeart
  };
}
