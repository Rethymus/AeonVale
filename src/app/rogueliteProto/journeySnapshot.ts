/**
 * 修途旅程快照 · 形状守卫（P1：自 surface 控制器闭包导出为纯函数）。
 *
 * 快照来自 localStorage（经 runSave 信封），restore 前必须过本守卫：
 * 不合格形状一律回落新档（surface.start 的 continue 分支），绝不把畸形
 * 数据强转进 sim 状态。零运行时依赖（全部 type-only import），node 可单测。
 */
import type {
  CultivationAshEpitaph,
  CultivationLegacyCandidates,
  CultivationTribulationSettlement,
  TribulationPreparation
} from '@sim/cultivation-run';
import type { PreparedPuzzlePlacement, SokobanState, TribulationSessionOutcome, TribulationSessionState } from '@sim/sokoban';
import type { CultivationRunMachineState } from '../cultivationRun/machine';
import type { CultivationAgendaDraft } from '../cultivationRun/presenter';
import type { ScrollPage } from './meta';

export type RogueliteProtoPhase =
  | 'opening'
  | 'life-intro'
  | 'omen'
  | 'planning'
  | 'schedule-resolving'
  | 'event'
  | 'insight'
  | 'tribulation-choice'
  | 'tribulation'
  | 'aftermath'
  | 'legacy'
  | 'ending'
  | 'lifespan-ended';

export interface CultivationJourneySnapshot {
  readonly version: 1;
  readonly phase: RogueliteProtoPhase;
  readonly openingBeatIndex: number;
  readonly stage: number;
  readonly seedSalt: number;
  readonly state: SokobanState;
  readonly machineState: CultivationRunMachineState;
  readonly preparation: TribulationPreparation;
  readonly preparedPuzzle: PreparedPuzzlePlacement | null;
  readonly tribulationSession: TribulationSessionState | null;
  readonly tribulationOutcome: TribulationSessionOutcome | null;
  readonly agendaDraft: CultivationAgendaDraft;
  readonly agendaCycleStartIndex: number;
  readonly agendaTargetIndex: number;
  readonly pendingEpitaph: CultivationAshEpitaph | null;
  readonly pendingLegacyCandidates: CultivationLegacyCandidates | null;
  readonly generation: number;
  readonly settlementApplied: boolean;
  readonly lastSettlement: CultivationTribulationSettlement | null;
  readonly tribulationFeedback: string | null;
  readonly agendaFeedback: string;
  readonly agendaFeedbackTone: 'neutral' | 'success' | 'error';
  readonly lastScroll: ScrollPage | null;
  readonly deadRun: boolean;
}

/**
 * 快照浅形状门（version + 关键标量类型 + 四大复合字段为对象）。
 * 已知边界（有意保持现状）：复合字段仅验 typeof 'object'（数组可通过）；
 * 其余可空字段不在此验——restore 逐字段赋值时缺失键落为 undefined，
 * 由各 phase 的既有守卫兜底。加严属行为变更（可能使旧档回落新档），需单独授权。
 */
export function isJourneySnapshot(value: unknown): value is CultivationJourneySnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CultivationJourneySnapshot>;
  return candidate.version === 1
    && typeof candidate.phase === 'string'
    && typeof candidate.openingBeatIndex === 'number'
    && typeof candidate.stage === 'number'
    && typeof candidate.seedSalt === 'number'
    && typeof candidate.generation === 'number'
    && Boolean(candidate.state && typeof candidate.state === 'object')
    && Boolean(candidate.machineState && typeof candidate.machineState === 'object')
    && Boolean(candidate.preparation && typeof candidate.preparation === 'object')
    && Boolean(candidate.agendaDraft && typeof candidate.agendaDraft === 'object');
}
