/**
 * D27-c 残卷参悟纯 sim。
 *
 * 固定七节点图只负责知识解锁契约：不抽样、不计时、不触碰 UI。调用方必须把
 * `budget` 随参悟阶段状态一起保存，成功后使用返回的新 budget，才能落实每轮最多
 * 一个节点的限制。
 */
import type { CultivationRunState } from './types';

export const CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA = 1 as const;

export const CULTIVATION_INSIGHT_NODE_IDS = [
  'foundation-rhythm',
  'field-breathing',
  'clear-furnace-sequence',
  'thunder-guiding-stone',
  'warding-pill-formula',
  'violet-omen-rubbing',
  'ash-annotated-vow'
] as const;

export type CultivationInsightNodeId = (typeof CULTIVATION_INSIGHT_NODE_IDS)[number];

export type CultivationInsightNodeCategory =
  | 'activity-upgrade'
  | 'array-stone'
  | 'pill-recipe'
  | 'tribulation-intel'
  | 'narrative-annotation';

export const CULTIVATION_INSIGHT_EFFECT_TAGS = [
  'activity:training:foundation-rhythm',
  'activity:farming:field-breathing',
  'activity:alchemy:clear-furnace',
  'tribulation:block:thunder-guiding-stone',
  'tribulation:pill:warding-formula',
  'tribulation:preview:violet-omen',
  'narrative:annotation:ash-vow'
] as const;

export type CultivationInsightEffectTag = (typeof CULTIVATION_INSIGHT_EFFECT_TAGS)[number];

export interface CultivationInsightNodeDefinition {
  readonly id: CultivationInsightNodeId;
  readonly label: string;
  readonly category: CultivationInsightNodeCategory;
  readonly insightCost: number;
  /** 已解锁列表是历史顺序；这些节点必须先于目标节点出现。 */
  readonly prerequisiteNodeIds: readonly CultivationInsightNodeId[];
  readonly effectTags: readonly CultivationInsightEffectTag[];
}

/** 固定 DAG：一根起笔、两条活动分支、阵石/丹方汇流，再抵达劫兆与叙事批注。 */
export const CULTIVATION_INSIGHT_NODES = [
  {
    id: 'foundation-rhythm',
    label: '吐纳记骨',
    category: 'activity-upgrade',
    insightCost: 2,
    prerequisiteNodeIds: [],
    effectTags: ['activity:training:foundation-rhythm']
  },
  {
    id: 'field-breathing',
    label: '田息同调',
    category: 'activity-upgrade',
    insightCost: 3,
    prerequisiteNodeIds: ['foundation-rhythm'],
    effectTags: ['activity:farming:field-breathing']
  },
  {
    id: 'clear-furnace-sequence',
    label: '澄炉次第',
    category: 'activity-upgrade',
    insightCost: 3,
    prerequisiteNodeIds: ['foundation-rhythm'],
    effectTags: ['activity:alchemy:clear-furnace']
  },
  {
    id: 'thunder-guiding-stone',
    label: '引雷阵石',
    category: 'array-stone',
    insightCost: 4,
    prerequisiteNodeIds: ['field-breathing'],
    effectTags: ['tribulation:block:thunder-guiding-stone']
  },
  {
    id: 'warding-pill-formula',
    label: '护脉丹方',
    category: 'pill-recipe',
    insightCost: 4,
    prerequisiteNodeIds: ['clear-furnace-sequence'],
    effectTags: ['tribulation:pill:warding-formula']
  },
  {
    id: 'violet-omen-rubbing',
    label: '紫劫兆拓',
    category: 'tribulation-intel',
    insightCost: 5,
    prerequisiteNodeIds: ['thunder-guiding-stone', 'warding-pill-formula'],
    effectTags: ['tribulation:preview:violet-omen']
  },
  {
    id: 'ash-annotated-vow',
    label: '劫灰誓批',
    category: 'narrative-annotation',
    insightCost: 2,
    prerequisiteNodeIds: ['violet-omen-rubbing'],
    effectTags: ['narrative:annotation:ash-vow']
  }
] as const satisfies readonly CultivationInsightNodeDefinition[];

const NODE_BY_ID: ReadonlyMap<string, CultivationInsightNodeDefinition> = new Map(
  CULTIVATION_INSIGHT_NODES.map(node => [node.id, node])
);

export interface CultivationInsightAgendaBudget {
  readonly agendaIndex: number;
  readonly unlockedThisAgenda: number;
  readonly maxUnlocksPerAgenda: number;
}

export interface UnlockCultivationInsightNodeRequest {
  readonly state: CultivationRunState;
  readonly unlockedNodeIds: readonly string[];
  readonly targetNodeId: string;
  readonly budget: CultivationInsightAgendaBudget;
}

export type CultivationInsightUnlockErrorCode =
  | 'invalid-insight'
  | 'invalid-agenda-budget'
  | 'agenda-unlock-limit-reached'
  | 'unknown-unlocked-node'
  | 'duplicate-unlocked-node'
  | 'invalid-unlocked-topology'
  | 'unknown-target-node'
  | 'already-unlocked'
  | 'missing-prerequisite'
  | 'insufficient-insight';

export interface CultivationInsightUnlockError {
  readonly code: CultivationInsightUnlockErrorCode;
  readonly targetNodeId: string;
  readonly missingPrerequisiteNodeIds: readonly CultivationInsightNodeId[];
}

export type UnlockCultivationInsightNodeResult =
  | {
      readonly ok: true;
      readonly state: CultivationRunState;
      readonly unlockedNodeIds: readonly CultivationInsightNodeId[];
      /** 当前全部已解锁节点的累计效果，按固定图顺序输出，供后续天劫契约消费。 */
      readonly effectTags: readonly CultivationInsightEffectTag[];
      readonly budget: CultivationInsightAgendaBudget;
      readonly unlockedNode: CultivationInsightNodeDefinition;
    }
  | {
      readonly ok: false;
      readonly state: CultivationRunState;
      readonly unlockedNodeIds: readonly string[];
      readonly budget: CultivationInsightAgendaBudget;
      readonly error: CultivationInsightUnlockError;
    };

function failure(
  request: UnlockCultivationInsightNodeRequest,
  code: CultivationInsightUnlockErrorCode,
  missingPrerequisiteNodeIds: readonly CultivationInsightNodeId[] = []
): UnlockCultivationInsightNodeResult {
  return {
    ok: false,
    state: { ...request.state },
    unlockedNodeIds: [...request.unlockedNodeIds],
    budget: { ...request.budget },
    error: { code, targetNodeId: request.targetNodeId, missingPrerequisiteNodeIds: [...missingPrerequisiteNodeIds] }
  };
}

function validatedUnlockedNodes(
  request: UnlockCultivationInsightNodeRequest
): { readonly ids: readonly CultivationInsightNodeId[]; readonly seen: ReadonlySet<CultivationInsightNodeId> } | CultivationInsightUnlockErrorCode {
  const ids: CultivationInsightNodeId[] = [];
  const seen = new Set<CultivationInsightNodeId>();

  for (const rawId of request.unlockedNodeIds) {
    const node = NODE_BY_ID.get(rawId);
    if (!node) return 'unknown-unlocked-node';
    if (seen.has(node.id)) return 'duplicate-unlocked-node';
    if (node.prerequisiteNodeIds.some(prerequisite => !seen.has(prerequisite))) return 'invalid-unlocked-topology';
    ids.push(node.id);
    seen.add(node.id);
  }

  return { ids, seen };
}

function effectTagsFor(unlockedNodeIds: ReadonlySet<CultivationInsightNodeId>): readonly CultivationInsightEffectTag[] {
  return CULTIVATION_INSIGHT_NODES.flatMap(node => (unlockedNodeIds.has(node.id) ? [...node.effectTags] : []));
}

export function unlockCultivationInsightNode(
  request: UnlockCultivationInsightNodeRequest
): UnlockCultivationInsightNodeResult {
  if (!Number.isInteger(request.state.insight) || request.state.insight < 0) return failure(request, 'invalid-insight');

  const { budget } = request;
  if (
    !Number.isInteger(budget.agendaIndex)
    || !Number.isInteger(budget.unlockedThisAgenda)
    || !Number.isInteger(budget.maxUnlocksPerAgenda)
    || budget.agendaIndex !== request.state.agendaIndex
    || budget.unlockedThisAgenda < 0
    || budget.maxUnlocksPerAgenda !== CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA
    || budget.unlockedThisAgenda > budget.maxUnlocksPerAgenda
  ) {
    return failure(request, 'invalid-agenda-budget');
  }
  if (budget.unlockedThisAgenda >= budget.maxUnlocksPerAgenda) return failure(request, 'agenda-unlock-limit-reached');

  const validated = validatedUnlockedNodes(request);
  if (typeof validated === 'string') return failure(request, validated);

  const target = NODE_BY_ID.get(request.targetNodeId);
  if (!target) return failure(request, 'unknown-target-node');
  if (validated.seen.has(target.id)) return failure(request, 'already-unlocked');

  const missingPrerequisites = target.prerequisiteNodeIds.filter(prerequisite => !validated.seen.has(prerequisite));
  if (missingPrerequisites.length > 0) return failure(request, 'missing-prerequisite', missingPrerequisites);
  if (request.state.insight < target.insightCost) return failure(request, 'insufficient-insight');

  const nextIds = [...validated.ids, target.id];
  const nextSet = new Set(nextIds);
  return {
    ok: true,
    state: { ...request.state, insight: request.state.insight - target.insightCost },
    unlockedNodeIds: nextIds,
    effectTags: effectTagsFor(nextSet),
    budget: { ...budget, unlockedThisAgenda: budget.unlockedThisAgenda + 1 },
    unlockedNode: target
  };
}
