/**
 * D27-b 修仙日程纯 sim：类型契约。
 *
 * 本切片刻意独立于旧 GameState，只承载“一世日程”验证所需的最小状态。
 * 所有字段均为可序列化数据；无 DOM、IO、时钟或隐式随机。
 */

export const CULTIVATION_ACTIVITY_IDS = ['training', 'farming', 'alchemy', 'livelihood', 'insight', 'rest'] as const;
export const CULTIVATION_RUN_MAX_STAGE = 6 as const;

export type CultivationActivityId = (typeof CULTIVATION_ACTIVITY_IDS)[number];

export type CultivationActivityCounts = Readonly<Record<CultivationActivityId, number>>;

export const CULTIVATION_ACTIVITY_LABELS: Readonly<Record<CultivationActivityId, string>> = {
  training: '苦练',
  farming: '灵田',
  alchemy: '炼丹',
  livelihood: '谋生',
  insight: '参悟',
  rest: '歇息'
};

export type CultivationRunStatus = 'active' | 'lifespan-ended' | 'tribulation-ended' | 'ascended';

/**
 * 一世日程层的最小状态。
 * body/endurance/willpower/pillPoison 与既有 Player 字段保持同量纲（毫点）；
 * pressure/mortalHeart/injury 使用 0..100 的玩家面点数。
 */
export interface CultivationRunState {
  readonly seed: number;
  stage: number;
  agendaIndex: number;
  status: CultivationRunStatus;
  lifespanRemainingDays: number;
  bodyFoundation: number;
  endurance: number;
  willpower: number;
  pillPoison: number;
  heavenDebt: number;
  daoAttention: number;
  pressure: number;
  mortalHeart: number;
  insight: number;
  injury: number;
  herbs: number;
  food: number;
  spiritStones: number;
  pills: number;
}

export interface CultivationAgenda {
  readonly slots: readonly CultivationActivityId[];
}

export interface CultivationActivityDelta {
  readonly lifespanRemainingDays: number;
  readonly bodyFoundation: number;
  readonly endurance: number;
  readonly willpower: number;
  readonly pillPoison: number;
  readonly pressure: number;
  readonly mortalHeart: number;
  readonly insight: number;
  readonly injury: number;
  readonly herbs: number;
  readonly food: number;
  readonly spiritStones: number;
  readonly pills: number;
}

export interface CultivationActivityResolution {
  readonly slotIndex: number;
  readonly activity: CultivationActivityId;
  readonly consecutiveCount: number;
  readonly efficiencyMilli: number;
  readonly pressureCrisis: boolean;
  readonly poisonCrisis: boolean;
  readonly delta: CultivationActivityDelta;
}

export type CultivationAgendaErrorCode =
  | 'invalid-state'
  | 'invalid-slot-count'
  | 'run-ended'
  | 'insufficient-lifespan'
  | 'insufficient-food'
  | 'insufficient-herbs'
  | 'insufficient-spirit-stones';

export interface CultivationAgendaError {
  readonly code: CultivationAgendaErrorCode;
  readonly slotIndex: number | null;
  readonly activity: CultivationActivityId | null;
}

export type CultivationAgendaResolution =
  | {
      readonly ok: true;
      readonly state: CultivationRunState;
      readonly slots: readonly CultivationActivityResolution[];
    }
  | {
      readonly ok: false;
      readonly state: CultivationRunState;
      readonly slots: readonly [];
      readonly error: CultivationAgendaError;
    };
