/**
 * D27-f 六境进程与终局分类。
 *
 * stage 0 保留为凡骨认劫入口；六个正式境界使用 stage 1..6。
 * 本模块只描述目录、顺序与终局事实，不改写当世状态，也不承载尚未定稿的寿元数值。
 */
import type { CultivationLifeConclusion } from './legacy';
import { CULTIVATION_RUN_MAX_STAGE } from './types';
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';

export const CULTIVATION_PRE_REALM_STAGE = 0 as const;
export const CULTIVATION_FINAL_STAGE = CULTIVATION_RUN_MAX_STAGE;

export type CultivationRealmStage = 1 | 2 | 3 | 4 | 5 | 6;
export type CultivationProgressionStage = typeof CULTIVATION_PRE_REALM_STAGE | CultivationRealmStage;

export interface CultivationRealmDefinition {
  readonly stage: CultivationRealmStage;
  readonly name: string;
}

/** 与传统修仙阅读经验对齐，但每一境仍由雷劫淬体而来。 */
export const CULTIVATION_REALMS = [
  { stage: 1, name: '练气' },
  { stage: 2, name: '筑基' },
  { stage: 3, name: '结丹' },
  { stage: 4, name: '元婴' },
  { stage: 5, name: '化神' },
  { stage: 6, name: '归一' }
] as const satisfies readonly CultivationRealmDefinition[];

const CULTIVATION_STAGE_EPITHETS = [
  '万气不留',
  '百缕存一',
  '经窍成渠',
  '雷髓凝核',
  '劫力化胎',
  '神念驭雷',
  '窃天为我'
] as const;

const CULTIVATION_RETENTION_PER_TEN_THOUSAND = [1, 100, 800, 2500, 4800, 7200, 10000] as const;

export interface CultivationStageCaps {
  readonly bodyFoundation: number;
  readonly endurance: number;
  readonly willpower: number;
}

export interface CultivationStageProfile {
  readonly stage: CultivationProgressionStage;
  readonly realmName: string;
  readonly epithet: string;
  readonly retentionPerTenThousand: number;
  readonly caps: CultivationStageCaps;
}

export function cultivationStageCaps(stage: number, params: BalanceParams = DEFAULT_BALANCE): CultivationStageCaps {
  const resolved = withDefaultBalanceParams(params);
  const safeStage = Math.max(0, Math.min(CULTIVATION_FINAL_STAGE, Number.isFinite(stage) ? Math.trunc(stage) : 0));
  const bodyFoundation = resolved.bodyCultivation.foundationCap[safeStage]
    ?? resolved.bodyCultivation.foundationCap.at(-1)
    ?? 0;
  return {
    bodyFoundation,
    endurance: Math.floor(bodyFoundation * 0.55),
    willpower: Math.floor(bodyFoundation * 0.4)
  };
}

export function cultivationStageProfile(stage: number, params: BalanceParams = DEFAULT_BALANCE): CultivationStageProfile {
  const safeStage = Math.max(0, Math.min(CULTIVATION_FINAL_STAGE, Number.isFinite(stage) ? Math.trunc(stage) : 0)) as CultivationProgressionStage;
  return {
    stage: safeStage,
    realmName: safeStage === 0 ? '凡骨' : cultivationRealmAt(safeStage)?.name ?? '凡骨',
    epithet: CULTIVATION_STAGE_EPITHETS[safeStage],
    retentionPerTenThousand: CULTIVATION_RETENTION_PER_TEN_THOUSAND[safeStage],
    caps: cultivationStageCaps(safeStage, params)
  };
}

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
