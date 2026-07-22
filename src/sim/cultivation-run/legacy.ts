/**
 * D27-e 劫灰传承纯 sim。
 *
 * 一世碑记只记录可序列化事实；候选由固定目录与真实经历推导；跨世 transition
 * 从全新的 CultivationRunState 开始，只应用玩家选定的一项知识与一件遗物。
 * 本模块不读写存储、DOM、时钟或隐式随机。
 */
import { DEFAULT_BALANCE, type BalanceParams } from '@sim/params';
import { createCultivationRunState } from './agenda';
import type { CultivationEventHistoryTag } from './events';
import {
  CULTIVATION_INSIGHT_NODES,
  type CultivationInsightNodeId
} from './insight';
import { clampInt } from './pressure';
import {
  CULTIVATION_ACTIVITY_IDS,
  type CultivationActivityCounts,
  type CultivationActivityId,
  type CultivationRunState
} from './types';

export interface CultivationLifeIdentity {
  readonly name: string;
  readonly portraitId: string;
}

export type CultivationDeathCause =
  | 'tribulation-overload'
  | 'tribulation-timeout'
  | 'lifespan-ended'
  | 'other';

export type CultivationEndingId = 'ascended' | 'survived' | 'other';

export type CultivationLifeConclusion =
  | { readonly kind: 'death'; readonly cause: CultivationDeathCause }
  | { readonly kind: 'ending'; readonly ending: CultivationEndingId };

export interface CultivationVocationTendency {
  readonly primaryActivity: CultivationActivityId | null;
  readonly activityCounts: CultivationActivityCounts;
}

export interface CultivationHerbLegacy {
  readonly scorchedCount: number;
  readonly preservedCount: number;
  readonly representativeHerb: string | null;
}

export interface CultivationAshEpitaph {
  readonly identity: CultivationLifeIdentity;
  readonly highestStage: number;
  readonly conclusion: CultivationLifeConclusion;
  readonly vocation: CultivationVocationTendency;
  readonly eventHistoryTags: readonly CultivationEventHistoryTag[];
  readonly unlockedKnowledgeNodeIds: readonly CultivationInsightNodeId[];
  readonly testament: string;
  readonly herbLegacy: CultivationHerbLegacy;
}

export interface CreateCultivationAshEpitaphRequest {
  readonly identity: CultivationLifeIdentity;
  readonly highestStage: number;
  readonly conclusion: CultivationLifeConclusion;
  readonly activityCounts?: Readonly<Partial<Record<CultivationActivityId, number>>>;
  readonly eventHistoryTags: readonly CultivationEventHistoryTag[];
  readonly unlockedKnowledgeNodeIds: readonly CultivationInsightNodeId[];
  readonly herbsScorched: number;
  readonly herbsPreserved: number;
  readonly representativeHerb?: string | null;
}

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizedActivityCounts(
  counts: Readonly<Partial<Record<CultivationActivityId, number>>> | undefined
): CultivationActivityCounts {
  return Object.fromEntries(
    CULTIVATION_ACTIVITY_IDS.map(activity => [activity, nonNegativeInteger(counts?.[activity] ?? 0)])
  ) as unknown as CultivationActivityCounts;
}

function deriveVocationTendency(
  counts: Readonly<Partial<Record<CultivationActivityId, number>>> | undefined
): CultivationVocationTendency {
  const activityCounts = normalizedActivityCounts(counts);
  const highestCount = Math.max(...CULTIVATION_ACTIVITY_IDS.map(activity => activityCounts[activity]));
  const primaryActivity = highestCount <= 0
    ? null
    : CULTIVATION_ACTIVITY_IDS.find(activity => activityCounts[activity] === highestCount) ?? null;
  return { primaryActivity, activityCounts };
}

const TESTAMENT_BY_EVENT: Readonly<Record<CultivationEventHistoryTag, string>> = {
  'returned-porridge-bowl': '门槛上的碗已经洗净，后来人若有余粮，也替我还一捧人情。',
  'repaired-neighbor-roof': '屋瓦补过一回，愿后来人记得雷声之外也有人间风雨。',
  'hired-kiln-mender': '炉壁请懂行的人补稳了，别拿一世寿数去赌本可避免的裂缝。',
  'patched-furnace-by-hand': '炉缝里的黄泥还在，后来人点火前先摸一摸那道旧伤。',
  'kept-mother-seeds': '母株的种子留在罐底，别让这一畦断在我手里。',
  'traded-seeds-for-medicine': '我拿来年换过眼前一夜无痛，后来人莫把这笔账忘了。',
  'waited-for-wages': '欠下的工钱我讨回来了，凡人的日子也该一枚一枚算清。',
  'accepted-stale-rice': '灶房还有半袋陈米，糠味虽重，也够后来人走出第一步。',
  'rehafted-old-hoe': '旧锄换过一根枣木柄，木楔松了就再敲紧，路也一样。',
  'worked-with-rope-repair': '麻绳缠过的锄柄会震手，后来人若见裂口，别再硬撑。',
  'harvested-before-purple-cloud': '紫云来前抢下的草替我挡过一劫，余种留给下一双手。',
  'kept-thunder-plot': '我留了一畦看雷，叶脉亮起的次序已经批在残卷边上。',
  'closed-window-to-keep-heart': '我曾合窗不看仙人霞光，守住自己的日子并不比破境轻。',
  'copied-breakthrough-sky-pattern': '远山天纹已经拓下，后来人不必再替我受那三夜冷风。',
  'paid-sect-tribute': '贡赋凭帖压在箱底，愿后来人有一天不必再交这笔凡人账。',
  'wrote-mortal-name-on-board': '他们削掉过我的名字，后来人若还记得，就替我再写一次。',
  'protected-herb-basket': '沾泥的药草我一株株拣回来了，别让仙人的随手一剑白烧。',
  'copied-xiao-wuji-sword-scar': '剑痕的去路已经拓下，下一次别只仰头看仙人。'
};

function conclusionTestament(conclusion: CultivationLifeConclusion): string {
  if (conclusion.kind === 'ending') {
    if (conclusion.ending === 'ascended') return '这一回身体没有化灰，后来人替我记住：凡骨也走得到天外。';
    if (conclusion.ending === 'survived') return '这一世尚能收尾，未走完的残卷仍留给后来人续写。';
    return '路没有在我这里结束，后来人照着灰里的字继续走。';
  }
  if (conclusion.cause === 'tribulation-overload') return '我把雷引得太重，后来人先看清肉身上限，再替我叩天。';
  if (conclusion.cause === 'tribulation-timeout') return '步数耗尽时雷还是落下了，后来人别把准备留到最后。';
  if (conclusion.cause === 'lifespan-ended') return '余寿走尽，残卷未尽；后来人替我把下一页翻开。';
  return '身体归灰，路还留着；后来人从我停下的地方再走一步。';
}

function generateTestament(
  conclusion: CultivationLifeConclusion,
  eventHistoryTags: readonly CultivationEventHistoryTag[]
): string {
  const lastTrace = eventHistoryTags.at(-1);
  return lastTrace ? TESTAMENT_BY_EVENT[lastTrace] : conclusionTestament(conclusion);
}

function uniqueKnowledgeNodes(
  nodeIds: readonly CultivationInsightNodeId[]
): readonly CultivationInsightNodeId[] {
  const seen = new Set<CultivationInsightNodeId>();
  const result: CultivationInsightNodeId[] = [];
  for (const node of CULTIVATION_INSIGHT_NODES) {
    if (nodeIds.includes(node.id) && !seen.has(node.id)) {
      seen.add(node.id);
      result.push(node.id);
    }
  }
  return result;
}

export function createCultivationAshEpitaph(
  request: CreateCultivationAshEpitaphRequest
): CultivationAshEpitaph {
  const eventHistoryTags = [...request.eventHistoryTags];
  return {
    identity: { ...request.identity },
    highestStage: nonNegativeInteger(request.highestStage),
    conclusion: { ...request.conclusion },
    vocation: deriveVocationTendency(request.activityCounts),
    eventHistoryTags,
    unlockedKnowledgeNodeIds: uniqueKnowledgeNodes(request.unlockedKnowledgeNodeIds),
    testament: generateTestament(request.conclusion, eventHistoryTags),
    herbLegacy: {
      scorchedCount: nonNegativeInteger(request.herbsScorched),
      preservedCount: nonNegativeInteger(request.herbsPreserved),
      representativeHerb: request.representativeHerb?.trim() || null
    }
  };
}

export const CULTIVATION_KNOWLEDGE_LEGACY_IDS = [
  'knowledge:field-notes',
  'knowledge:foundation-rhythm',
  'knowledge:field-breathing',
  'knowledge:clear-furnace-sequence',
  'knowledge:thunder-guiding-stone',
  'knowledge:warding-pill-formula',
  'knowledge:violet-omen-rubbing',
  'knowledge:ash-annotated-vow'
] as const;

export type CultivationKnowledgeLegacyId = (typeof CULTIVATION_KNOWLEDGE_LEGACY_IDS)[number];

export const CULTIVATION_RELIC_LEGACY_IDS = [
  'relic:old-hoe',
  'relic:cracked-furnace',
  'relic:annotated-notebook',
  'relic:field-jade'
] as const;

export type CultivationRelicLegacyId = (typeof CULTIVATION_RELIC_LEGACY_IDS)[number];

export interface CultivationLegacyStartingEffect {
  readonly insight: number;
  readonly mortalHeart: number;
  readonly herbs: number;
  readonly food: number;
  readonly spiritStones: number;
  readonly pills: number;
}

export interface CultivationKnowledgeCandidate {
  readonly id: CultivationKnowledgeLegacyId;
  readonly label: string;
  readonly inheritedNodeId: CultivationInsightNodeId | null;
  readonly startingEffect: CultivationLegacyStartingEffect;
}

export interface CultivationRelicCandidate {
  readonly id: CultivationRelicLegacyId;
  readonly label: string;
  readonly startingEffect: CultivationLegacyStartingEffect;
}

const ZERO_STARTING_EFFECT: CultivationLegacyStartingEffect = {
  insight: 0,
  mortalHeart: 0,
  herbs: 0,
  food: 0,
  spiritStones: 0,
  pills: 0
};

function startingEffect(
  overrides: Partial<CultivationLegacyStartingEffect>
): CultivationLegacyStartingEffect {
  return { ...ZERO_STARTING_EFFECT, ...overrides };
}

const FIELD_NOTES_KNOWLEDGE: CultivationKnowledgeCandidate = {
  id: 'knowledge:field-notes',
  label: '前人田边批注',
  inheritedNodeId: null,
  startingEffect: startingEffect({ insight: 1 })
};

const KNOWLEDGE_BY_NODE: Readonly<Record<CultivationInsightNodeId, CultivationKnowledgeCandidate>> = {
  'foundation-rhythm': {
    id: 'knowledge:foundation-rhythm',
    label: '吐纳记骨批注',
    inheritedNodeId: 'foundation-rhythm',
    startingEffect: startingEffect({ insight: 2 })
  },
  'field-breathing': {
    id: 'knowledge:field-breathing',
    label: '田息同调批注',
    inheritedNodeId: 'field-breathing',
    startingEffect: startingEffect({ insight: 2 })
  },
  'clear-furnace-sequence': {
    id: 'knowledge:clear-furnace-sequence',
    label: '澄炉次第批注',
    inheritedNodeId: 'clear-furnace-sequence',
    startingEffect: startingEffect({ insight: 2 })
  },
  'thunder-guiding-stone': {
    id: 'knowledge:thunder-guiding-stone',
    label: '引雷阵图残页',
    inheritedNodeId: 'thunder-guiding-stone',
    startingEffect: startingEffect({ insight: 2 })
  },
  'warding-pill-formula': {
    id: 'knowledge:warding-pill-formula',
    label: '护脉丹方残页',
    inheritedNodeId: 'warding-pill-formula',
    startingEffect: startingEffect({ insight: 2 })
  },
  'violet-omen-rubbing': {
    id: 'knowledge:violet-omen-rubbing',
    label: '紫劫兆拓本',
    inheritedNodeId: 'violet-omen-rubbing',
    startingEffect: startingEffect({ insight: 2 })
  },
  'ash-annotated-vow': {
    id: 'knowledge:ash-annotated-vow',
    label: '劫灰誓批',
    inheritedNodeId: 'ash-annotated-vow',
    startingEffect: startingEffect({ insight: 2 })
  }
};

const RELIC_CATALOG: Readonly<Record<CultivationRelicLegacyId, CultivationRelicCandidate>> = {
  'relic:old-hoe': {
    id: 'relic:old-hoe',
    label: '旧锄',
    startingEffect: startingEffect({ herbs: 1, food: 1 })
  },
  'relic:cracked-furnace': {
    id: 'relic:cracked-furnace',
    label: '裂炉',
    startingEffect: startingEffect({ pills: 1 })
  },
  'relic:annotated-notebook': {
    id: 'relic:annotated-notebook',
    label: '批注本',
    startingEffect: startingEffect({ insight: 1, spiritStones: 1 })
  },
  'relic:field-jade': {
    id: 'relic:field-jade',
    label: '护田玉',
    startingEffect: startingEffect({ mortalHeart: 5, food: 1 })
  }
};

export interface CultivationLegacyCandidates {
  readonly knowledge: readonly CultivationKnowledgeCandidate[];
  readonly relics: readonly CultivationRelicCandidate[];
}

function hasAnyTrace(
  epitaph: CultivationAshEpitaph,
  traces: readonly CultivationEventHistoryTag[]
): boolean {
  return traces.some(trace => epitaph.eventHistoryTags.includes(trace));
}

export function deriveCultivationLegacyCandidates(
  epitaph: CultivationAshEpitaph
): CultivationLegacyCandidates {
  const knowledge = [
    FIELD_NOTES_KNOWLEDGE,
    ...epitaph.unlockedKnowledgeNodeIds.map(nodeId => KNOWLEDGE_BY_NODE[nodeId])
  ];
  const relicIds: CultivationRelicLegacyId[] = ['relic:old-hoe'];

  if (
    epitaph.vocation.primaryActivity === 'alchemy'
    || hasAnyTrace(epitaph, ['hired-kiln-mender', 'patched-furnace-by-hand'])
  ) relicIds.push('relic:cracked-furnace');
  if (
    epitaph.vocation.primaryActivity === 'insight'
    || epitaph.unlockedKnowledgeNodeIds.length > 0
    || hasAnyTrace(epitaph, ['copied-breakthrough-sky-pattern', 'copied-xiao-wuji-sword-scar'])
  ) relicIds.push('relic:annotated-notebook');
  if (
    epitaph.vocation.primaryActivity === 'farming'
    || epitaph.vocation.primaryActivity === 'rest'
    || hasAnyTrace(epitaph, ['kept-mother-seeds', 'protected-herb-basket', 'returned-porridge-bowl'])
  ) relicIds.push('relic:field-jade');

  return {
    knowledge: knowledge.map(candidate => ({
      ...candidate,
      startingEffect: { ...candidate.startingEffect }
    })),
    relics: relicIds.map(id => ({
      ...RELIC_CATALOG[id],
      startingEffect: { ...RELIC_CATALOG[id].startingEffect }
    }))
  };
}

export interface CultivationLegacySelection {
  readonly knowledgeId: string;
  readonly relicId: string;
}

export type CultivationLegacySelectionErrorCode =
  | 'knowledge-not-offered'
  | 'relic-not-offered';

export interface CultivationLegacySelectionError {
  readonly code: CultivationLegacySelectionErrorCode;
  readonly selection: CultivationLegacySelection;
}

export type CultivationLegacySelectionValidation =
  | {
      readonly ok: true;
      readonly knowledge: CultivationKnowledgeCandidate;
      readonly relic: CultivationRelicCandidate;
    }
  | {
      readonly ok: false;
      readonly error: CultivationLegacySelectionError;
    };

export function validateCultivationLegacySelection(
  candidates: CultivationLegacyCandidates,
  selection: CultivationLegacySelection
): CultivationLegacySelectionValidation {
  const knowledge = candidates.knowledge.find(candidate => candidate.id === selection.knowledgeId);
  if (!knowledge) {
    return {
      ok: false,
      error: { code: 'knowledge-not-offered', selection: { ...selection } }
    };
  }
  const relic = candidates.relics.find(candidate => candidate.id === selection.relicId);
  if (!relic) {
    return {
      ok: false,
      error: { code: 'relic-not-offered', selection: { ...selection } }
    };
  }
  return {
    ok: true,
    knowledge: { ...knowledge, startingEffect: { ...knowledge.startingEffect } },
    relic: { ...relic, startingEffect: { ...relic.startingEffect } }
  };
}

export interface TransitionToHeirRequest {
  readonly previousState: CultivationRunState;
  readonly epitaph: CultivationAshEpitaph;
  readonly selection: CultivationLegacySelection;
  readonly heirIdentity: CultivationLifeIdentity;
  readonly heirSeed: number;
  readonly params?: BalanceParams;
}

export interface CultivationInheritedLegacy {
  readonly predecessor: CultivationAshEpitaph;
  readonly heirIdentity: CultivationLifeIdentity;
  readonly selectedKnowledge: CultivationKnowledgeCandidate;
  readonly selectedRelic: CultivationRelicCandidate;
  readonly inheritedKnowledgeNodeIds: readonly CultivationInsightNodeId[];
}

export type TransitionToHeirErrorCode =
  | CultivationLegacySelectionErrorCode
  | 'invalid-heir-seed';

export type TransitionToHeirResult =
  | {
      readonly ok: true;
      readonly state: CultivationRunState;
      readonly legacy: CultivationInheritedLegacy;
    }
  | {
      readonly ok: false;
      /** 原子失败：保持调用方传入的前世状态引用。 */
      readonly state: CultivationRunState;
      readonly error: {
        readonly code: TransitionToHeirErrorCode;
        readonly selection: CultivationLegacySelection;
      };
    };

function addStartingEffects(
  state: CultivationRunState,
  knowledge: CultivationKnowledgeCandidate,
  relic: CultivationRelicCandidate,
  params: BalanceParams
): CultivationRunState {
  const effect = {
    insight: knowledge.startingEffect.insight + relic.startingEffect.insight,
    mortalHeart: knowledge.startingEffect.mortalHeart + relic.startingEffect.mortalHeart,
    herbs: knowledge.startingEffect.herbs + relic.startingEffect.herbs,
    food: knowledge.startingEffect.food + relic.startingEffect.food,
    spiritStones: knowledge.startingEffect.spiritStones + relic.startingEffect.spiritStones,
    pills: knowledge.startingEffect.pills + relic.startingEffect.pills
  };
  return {
    ...state,
    insight: state.insight + effect.insight,
    mortalHeart: clampInt(state.mortalHeart + effect.mortalHeart, 0, params.cultivationRun.mortalHeartCap),
    herbs: state.herbs + effect.herbs,
    food: state.food + effect.food,
    spiritStones: state.spiritStones + effect.spiritStones,
    pills: state.pills + effect.pills
  };
}

export function transitionToHeir(request: TransitionToHeirRequest): TransitionToHeirResult {
  if (!Number.isInteger(request.heirSeed)) {
    return {
      ok: false,
      state: request.previousState,
      error: { code: 'invalid-heir-seed', selection: { ...request.selection } }
    };
  }

  const candidates = deriveCultivationLegacyCandidates(request.epitaph);
  const validation = validateCultivationLegacySelection(candidates, request.selection);
  if (!validation.ok) {
    return {
      ok: false,
      state: request.previousState,
      error: { code: validation.error.code, selection: { ...request.selection } }
    };
  }

  const params = request.params ?? DEFAULT_BALANCE;
  const baseline = createCultivationRunState({ seed: request.heirSeed, params });
  const state = addStartingEffects(baseline, validation.knowledge, validation.relic, params);
  const inheritedNodeId = validation.knowledge.inheritedNodeId;
  return {
    ok: true,
    state,
    legacy: {
      predecessor: {
        ...request.epitaph,
        identity: { ...request.epitaph.identity },
        conclusion: { ...request.epitaph.conclusion },
        vocation: {
          primaryActivity: request.epitaph.vocation.primaryActivity,
          activityCounts: { ...request.epitaph.vocation.activityCounts }
        },
        eventHistoryTags: [...request.epitaph.eventHistoryTags],
        unlockedKnowledgeNodeIds: [...request.epitaph.unlockedKnowledgeNodeIds],
        herbLegacy: { ...request.epitaph.herbLegacy }
      },
      heirIdentity: { ...request.heirIdentity },
      selectedKnowledge: validation.knowledge,
      selectedRelic: validation.relic,
      inheritedKnowledgeNodeIds: inheritedNodeId ? [inheritedNodeId] : []
    }
  };
}
