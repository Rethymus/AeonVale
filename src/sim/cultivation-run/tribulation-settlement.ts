/** D27-d：把天劫输出统一回写到当世状态。 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import {
  TRIBULATION_SESSION_PILL_IDS,
  type TribulationSessionOutcome
} from '@sim/sokoban/tribulation-session';
import { cloneCultivationRunState } from './activities';
import { cultivationRunStateError } from './agenda';
import { clampInt } from './pressure';
import { resolveCultivationProgression } from './progression';
import type { CultivationRunState } from './types';

export type CultivationTribulationSettlementKind =
  | 'breakthrough'
  | 'ascended'
  | 'insufficient'
  | 'death-prevented'
  | 'death';

export interface ApplyCultivationTribulationOutcomeRequest {
  readonly state: CultivationRunState;
  readonly outcome: TribulationSessionOutcome;
  /** 只扣除由本世灵田带入棋盘且实际烧毁的灵草，不把生成器自带草算进库存。 */
  readonly preparedHerbsScorched: number;
}

export interface CultivationTribulationSettlement {
  readonly kind: CultivationTribulationSettlementKind;
  readonly stageBefore: number;
  readonly stageAfter: number;
  readonly herbsLost: number;
  readonly pillsConsumed: number;
  readonly injuryGained: number;
  readonly temperingGained: number;
  readonly lifespanGained: number;
}

export type ApplyCultivationTribulationOutcomeErrorCode =
  | 'invalid-state'
  | 'run-ended'
  | 'unresolved-outcome'
  | 'invalid-outcome'
  | 'invalid-consumption';

export type ApplyCultivationTribulationOutcomeResult =
  | {
      readonly ok: true;
      readonly state: CultivationRunState;
      readonly settlement: CultivationTribulationSettlement;
    }
  | {
      readonly ok: false;
      readonly state: CultivationRunState;
      readonly error: ApplyCultivationTribulationOutcomeErrorCode;
    };

function reject(
  state: CultivationRunState,
  error: ApplyCultivationTribulationOutcomeErrorCode
): ApplyCultivationTribulationOutcomeResult {
  return { ok: false, state, error };
}

function nonNegativeInteger(value: number): number | null {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isFatalResult(outcome: TribulationSessionOutcome): boolean {
  return outcome.result === 'overload' || outcome.result === 'timeout';
}

function outcomeIsConsistent(outcome: TribulationSessionOutcome): boolean {
  if (outcome.fatal && outcome.deathPrevented) return false;
  if (outcome.wardConsumed !== outcome.deathPrevented) return false;
  if (isFatalResult(outcome)) {
    if (!outcome.fatal && !outcome.deathPrevented) return false;
  } else if (outcome.fatal || outcome.deathPrevented || outcome.wardConsumed) {
    return false;
  }
  return nonNegativeInteger(outcome.bodyDamage) !== null
    && nonNegativeInteger(outcome.temperingGain) !== null;
}

function pillsAreKnown(outcome: TribulationSessionOutcome): boolean {
  return outcome.pillsConsumed.every(
    pill => pill === TRIBULATION_SESSION_PILL_IDS.undo || pill === TRIBULATION_SESSION_PILL_IDS.ward
  );
}

export function applyCultivationTribulationOutcome(
  request: ApplyCultivationTribulationOutcomeRequest,
  params: BalanceParams = DEFAULT_BALANCE
): ApplyCultivationTribulationOutcomeResult {
  const resolved = withDefaultBalanceParams(params);
  if (cultivationRunStateError(request.state, resolved)) return reject(request.state, 'invalid-state');
  if (request.state.status !== 'active') return reject(request.state, 'run-ended');
  if (request.outcome.result === 'unreached') return reject(request.state, 'unresolved-outcome');
  if (!outcomeIsConsistent(request.outcome)) return reject(request.state, 'invalid-outcome');

  const requestedHerbLoss = nonNegativeInteger(request.preparedHerbsScorched);
  const pillConsumption = nonNegativeInteger(request.outcome.pillsConsumed.length);
  if (requestedHerbLoss === null || pillConsumption === null) return reject(request.state, 'invalid-consumption');
  if (!pillsAreKnown(request.outcome)) return reject(request.state, 'invalid-consumption');
  if (pillConsumption > request.state.pills || requestedHerbLoss > request.state.herbs) {
    return reject(request.state, 'invalid-consumption');
  }

  const next = cloneCultivationRunState(request.state);
  const stageBefore = next.stage;
  const herbsLost = requestedHerbLoss;
  const injuryBefore = next.injury;
  const temperingGained = request.outcome.temperingGain;
  next.herbs -= herbsLost;
  next.pills -= pillConsumption;
  next.injury = clampInt(
    next.injury + request.outcome.bodyDamage,
    0,
    resolved.cultivationRun.injuryCap
  );
  next.bodyFoundation += temperingGained;

  let kind: CultivationTribulationSettlementKind;
  let lifespanGained = 0;
  if (request.outcome.fatal) {
    kind = 'death';
    next.status = 'tribulation-ended';
  } else if (request.outcome.deathPrevented) {
    kind = 'death-prevented';
  } else if (request.outcome.result === 'perfect' || request.outcome.result === 'survived') {
    const progression = resolveCultivationProgression(next.stage, 'tribulation-succeeded');
    if (!progression.ok) return reject(request.state, 'invalid-state');
    if (progression.kind === 'ascended') {
      kind = 'ascended';
      next.status = 'ascended';
    } else {
      kind = 'breakthrough';
      next.stage = progression.stageAfter;
      lifespanGained = Math.max(0, Math.floor(resolved.bodyCultivation.lifespanBreakthroughGain));
      next.lifespanRemainingDays += lifespanGained;
    }
  } else {
    kind = 'insufficient';
  }

  if (cultivationRunStateError(next, resolved)) return reject(request.state, 'invalid-outcome');

  return {
    ok: true,
    state: next,
    settlement: {
      kind,
      stageBefore,
      stageAfter: next.stage,
      herbsLost,
      pillsConsumed: pillConsumption,
      injuryGained: next.injury - injuryBefore,
      temperingGained,
      lifespanGained
    }
  };
}
