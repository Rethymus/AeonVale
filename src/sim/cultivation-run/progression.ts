/**
 * D27-f 六境进程与终局分类。
 *
 * stage 0 保留为凡骨认劫入口；六个正式境界使用 stage 1..6。
 * 本模块只描述目录、顺序与终局事实，不改写当世状态，也不承载尚未定稿的寿元数值。
 */
import type { CultivationLifeConclusion } from './legacy';
import { CULTIVATION_RUN_MAX_STAGE } from './types';

export const CULTIVATION_PRE_REALM_STAGE = 0 as const;
export const CULTIVATION_FINAL_STAGE = CULTIVATION_RUN_MAX_STAGE;

export type CultivationRealmStage = 1 | 2 | 3 | 4 | 5 | 6;
export type CultivationProgressionStage = typeof CULTIVATION_PRE_REALM_STAGE | CultivationRealmStage;

export interface CultivationRealmDefinition {
  readonly stage: CultivationRealmStage;
  readonly name: string;
}

/** D27/22 已有六重淬体正典；不复用旧七阶制的境界名。 */
export const CULTIVATION_REALMS = [
  { stage: 1, name: '察漏' },
  { stage: 2, name: '引路' },
  { stage: 3, name: '借势' },
  { stage: 4, name: '淬骨' },
  { stage: 5, name: '守我' },
  { stage: 6, name: '归一' }
] as const satisfies readonly CultivationRealmDefinition[];

export function isCultivationProgressionStage(stage: number): stage is CultivationProgressionStage {
  return Number.isInteger(stage) && stage >= CULTIVATION_PRE_REALM_STAGE && stage <= CULTIVATION_FINAL_STAGE;
}

export function cultivationRealmAt(stage: number): CultivationRealmDefinition | null {
  if (!Number.isInteger(stage) || stage < 1 || stage > CULTIVATION_FINAL_STAGE) return null;
  return CULTIVATION_REALMS[stage - 1] ?? null;
}

export function isFinalCultivationStage(stage: number): stage is typeof CULTIVATION_FINAL_STAGE {
  return stage === CULTIVATION_FINAL_STAGE;
}

/**
 * 返回成功渡劫后进入的 stage。stage 0 会进入第一境；第六境已无下一境。
 * 非整数、负数和旧七阶制的 stage 7 均不属于 D27 六境进程。
 */
export function nextCultivationStage(stage: number): CultivationRealmStage | null {
  if (!isCultivationProgressionStage(stage) || isFinalCultivationStage(stage)) return null;
  return (stage + 1) as CultivationRealmStage;
}

export type CultivationProgressionEvent = 'lifespan-exhausted' | 'tribulation-succeeded';

/** 可直接并入 createCultivationAshEpitaph 请求的稳定终局事实。 */
export interface CultivationProgressionEpitaphData {
  readonly highestStage: CultivationProgressionStage;
  readonly conclusion: CultivationLifeConclusion;
}

export type CultivationProgressionResolution =
  | {
      readonly ok: true;
      readonly kind: 'stage-advanced';
      readonly terminal: false;
      readonly stageBefore: CultivationProgressionStage;
      readonly stageAfter: CultivationRealmStage;
      readonly epitaphData: null;
    }
  | {
      readonly ok: true;
      readonly kind: 'lifespan-ended';
      readonly terminal: true;
      readonly stageBefore: CultivationProgressionStage;
      readonly stageAfter: CultivationProgressionStage;
      readonly epitaphData: CultivationProgressionEpitaphData;
    }
  | {
      readonly ok: true;
      readonly kind: 'ascended';
      readonly terminal: true;
      readonly stageBefore: typeof CULTIVATION_FINAL_STAGE;
      readonly stageAfter: typeof CULTIVATION_FINAL_STAGE;
      readonly epitaphData: CultivationProgressionEpitaphData;
    }
  | {
      readonly ok: false;
      readonly error: 'invalid-stage';
      readonly stageBefore: number;
    };

/**
 * 按已发生的离散事件分类进程，避免为“同一刻寿尽且渡劫成功”臆造优先级。
 */
export function resolveCultivationProgression(stage: number, event: CultivationProgressionEvent): CultivationProgressionResolution {
  if (!isCultivationProgressionStage(stage)) {
    return { ok: false, error: 'invalid-stage', stageBefore: stage };
  }

  if (event === 'lifespan-exhausted') {
    const conclusion: CultivationLifeConclusion = { kind: 'death', cause: 'lifespan-ended' };
    return {
      ok: true,
      kind: 'lifespan-ended',
      terminal: true,
      stageBefore: stage,
      stageAfter: stage,
      epitaphData: { highestStage: stage, conclusion }
    };
  }

  const nextStage = nextCultivationStage(stage);
  if (nextStage !== null) {
    return {
      ok: true,
      kind: 'stage-advanced',
      terminal: false,
      stageBefore: stage,
      stageAfter: nextStage,
      epitaphData: null
    };
  }

  const conclusion: CultivationLifeConclusion = { kind: 'ending', ending: 'ascended' };
  return {
    ok: true,
    kind: 'ascended',
    terminal: true,
    stageBefore: CULTIVATION_FINAL_STAGE,
    stageAfter: CULTIVATION_FINAL_STAGE,
    epitaphData: { highestStage: CULTIVATION_FINAL_STAGE, conclusion }
  };
}
