/** D27-d：由棋盘光路和当世准备计算雷威，并判定淬体结果。 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import type { TribulationPreparation } from '@sim/cultivation-run/preparation';
import { idx } from './beam';
import type { BlockKind, SokobanState } from './types';

export type TribulationResult = 'unreached' | 'insufficient' | 'perfect' | 'survived' | 'overload' | 'timeout';

export interface BeamPowerBreakdown {
  readonly sourcePower: number;
  readonly pathConductivityMilli: number;
  readonly arrayStoneModifierMilli: number;
  readonly herbModifierMilli: number;
  readonly eventModifierMilli: number;
  readonly beamPower: number;
}

export interface TribulationOutcome {
  readonly reachedBody: boolean;
  readonly beamPower: number;
  readonly result: TribulationResult;
  readonly movesUsed: number;
  readonly herbsScorched: number;
  readonly pillsConsumed: readonly string[];
  readonly bodyDamage: number;
  readonly temperingGain: number;
  readonly breakdown: BeamPowerBreakdown;
}

function multiplyMilli(value: number, modifierMilli: number): number {
  return Math.floor((value * modifierMilli) / 1000);
}

function blockModifier(kind: BlockKind, mirrorMilli: number, conductorMilli: number): number {
  if (kind === 'mirror') return mirrorMilli;
  if (kind === 'conductor') return conductorMilli;
  return 1000;
}

export function calculateBeamPower(
  state: SokobanState,
  preparation: TribulationPreparation,
  params: BalanceParams = DEFAULT_BALANCE
): BeamPowerBreakdown {
  const p = withDefaultBalanceParams(params).cultivationRun.tribulation;
  const pathLoss = state.beam.cells.length * p.pathCellLossMilli;
  const pathConductivityMilli = Math.max(p.minimumPathConductivityMilli, 1000 - pathLoss);
  let arrayStoneModifierMilli = 1000;
  for (const cell of state.beam.cells) {
    const kind = state.board.blocks[idx(state.board, cell.x, cell.y)] ?? 'none';
    arrayStoneModifierMilli = multiplyMilli(
      arrayStoneModifierMilli,
      blockModifier(kind, p.mirrorModifierMilli, p.conductorModifierMilli)
    );
  }
  let herbModifierMilli = 1000;
  // scorched 表示本次雷威结算前已经烧毁的灵草；只有当前光路上的新鲜灵草参与本次倍率。
  for (const herb of state.beam.herbsHit) {
    if (state.scorched[idx(state.board, herb.x, herb.y)]) continue;
    herbModifierMilli = multiplyMilli(herbModifierMilli, p.herbHitModifierMilli);
  }

  const sourcePowerBonus = Number.isFinite(preparation.sourcePowerBonus)
    ? Math.floor(preparation.sourcePowerBonus)
    : 0;
  const eventModifierMilli = Number.isFinite(preparation.eventPowerModifierMilli)
    ? Math.max(1, Math.floor(preparation.eventPowerModifierMilli))
    : 1000;
  const sourcePower = Math.max(0, p.baseSourcePower + sourcePowerBonus);
  let beamPower = sourcePower;
  beamPower = multiplyMilli(beamPower, pathConductivityMilli);
  beamPower = multiplyMilli(beamPower, arrayStoneModifierMilli);
  beamPower = multiplyMilli(beamPower, herbModifierMilli);
  beamPower = multiplyMilli(beamPower, eventModifierMilli);
  return {
    sourcePower,
    pathConductivityMilli,
    arrayStoneModifierMilli,
    herbModifierMilli,
    eventModifierMilli,
    beamPower
  };
}

function classifyResult(state: SokobanState, preparation: TribulationPreparation, beamPower: number): TribulationResult {
  if (state.status === 'lost') return 'timeout';
  if (!state.beam.reachedBody) return 'unreached';
  if (beamPower < preparation.minTemperingPower) return 'insufficient';
  if (beamPower > preparation.maxSurvivablePower) return 'overload';
  if (beamPower >= preparation.sweetSpotMinPower && beamPower <= preparation.sweetSpotMaxPower) return 'perfect';
  return 'survived';
}

export function evaluateTribulation(
  state: SokobanState,
  preparation: TribulationPreparation,
  params: BalanceParams = DEFAULT_BALANCE
): TribulationOutcome {
  const p = withDefaultBalanceParams(params).cultivationRun.tribulation;
  const breakdown = calculateBeamPower(state, preparation, params);
  const result = classifyResult(state, preparation, breakdown.beamPower);
  const herbsScorched = state.scorched.reduce((sum, scorched) => sum + (scorched ? 1 : 0), 0);
  const bodyDamage = result === 'overload'
    ? breakdown.beamPower - preparation.maxSurvivablePower
    : result === 'survived'
      ? Math.max(1, Math.min(
          Math.abs(breakdown.beamPower - preparation.sweetSpotMinPower),
          Math.abs(breakdown.beamPower - preparation.sweetSpotMaxPower)
        ))
      : result === 'timeout'
        ? p.timeoutBodyDamage
        : 0;
  const temperingGain = result === 'perfect'
    ? breakdown.beamPower * p.perfectTemperingGainMultiplier
    : result === 'survived'
      ? breakdown.beamPower * p.survivedTemperingGainMultiplier
      : result === 'insufficient'
        ? breakdown.beamPower * p.insufficientTemperingGainMultiplier
        : 0;
  return {
    reachedBody: state.beam.reachedBody,
    beamPower: breakdown.beamPower,
    result,
    movesUsed: state.movesUsed,
    herbsScorched,
    pillsConsumed: [],
    bodyDamage,
    temperingGain,
    breakdown
  };
}
