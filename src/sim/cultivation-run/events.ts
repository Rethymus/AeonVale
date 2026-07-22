/**
 * D27-c 事件纯 sim。
 *
 * 固定事件目录只读；候选抽样由 seed + agendaIndex + 显式 ordinal 决定。
 * 选择结算只改 CultivationRunState 既有字段，碑记与天劫影响以 tags 返回。
 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import { cultivationRunStateError } from './agenda';
import { cloneCultivationRunState } from './activities';
import { clampInt } from './pressure';
import type { CultivationRunState } from './types';

export const CULTIVATION_EVENT_CATEGORIES = ['mortal-life', 'celestial-omen', 'thematic-contrast'] as const;
export type CultivationEventCategory = (typeof CULTIVATION_EVENT_CATEGORIES)[number];

export type CultivationEventId =
  | 'neighbor-porridge'
  | 'cracked-furnace-wall'
  | 'seed-or-medicine'
  | 'delayed-wages'
  | 'broken-hoe-handle'
  | 'purple-cloud-over-fields'
  | 'distant-breakthrough-afterglow'
  | 'sect-tribute-board'
  | 'xiao-wuji-sword-scar';

export type CultivationEventResource =
  | 'lifespanRemainingDays'
  | 'insight'
  | 'herbs'
  | 'food'
  | 'spiritStones'
  | 'pills';

export type CultivationEventEffectField =
  | 'bodyFoundation'
  | 'endurance'
  | 'willpower'
  | 'pillPoison'
  | 'heavenDebt'
  | 'daoAttention'
  | 'pressure'
  | 'mortalHeart'
  | 'insight'
  | 'injury'
  | 'herbs'
  | 'food'
  | 'spiritStones'
  | 'pills';

export type CultivationEventHistoryTag =
  | 'returned-porridge-bowl'
  | 'repaired-neighbor-roof'
  | 'hired-kiln-mender'
  | 'patched-furnace-by-hand'
  | 'kept-mother-seeds'
  | 'traded-seeds-for-medicine'
  | 'waited-for-wages'
  | 'accepted-stale-rice'
  | 'rehafted-old-hoe'
  | 'worked-with-rope-repair'
  | 'harvested-before-purple-cloud'
  | 'kept-thunder-plot'
  | 'closed-window-to-keep-heart'
  | 'copied-breakthrough-sky-pattern'
  | 'paid-sect-tribute'
  | 'wrote-mortal-name-on-board'
  | 'protected-herb-basket'
  | 'copied-xiao-wuji-sword-scar';

export type CultivationTribulationTag =
  | 'protected-herbs:2'
  | 'starting-herb:thunder'
  | 'preview-level:+1'
  | 'ward-charge:+1'
  | 'source-power:+5'
  | 'sect-tally:cleared'
  | 'safe-range:-3'
  | 'sword-scar-obstacle:1'
  | 'second-lightning-source:1';

export interface CultivationEventCost {
  readonly resource: CultivationEventResource;
  readonly amount: number;
}

export type CultivationEventEffects = Readonly<Partial<Record<CultivationEventEffectField, number>>>;

export interface CultivationEventChoiceDefinition {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly costs: readonly CultivationEventCost[];
  readonly effects: CultivationEventEffects;
  readonly historyTags: readonly CultivationEventHistoryTag[];
  readonly tribulationTags: readonly CultivationTribulationTag[];
}

export interface CultivationEventDefinition {
  readonly id: CultivationEventId;
  readonly category: CultivationEventCategory;
  readonly minStage: number;
  readonly weight: number;
  readonly title: string;
  readonly detail: string;
  readonly detailTokens: readonly string[];
  readonly modernEcho: boolean;
  readonly choices: readonly [CultivationEventChoiceDefinition, CultivationEventChoiceDefinition];
}

export const CULTIVATION_EVENT_TEXT_BUDGET = {
  titleMaxChars: 14,
  detailMinChars: 18,
  detailMaxChars: 64,
  choiceLabelMaxChars: 12,
  choiceDetailMaxChars: 40,
  modernEchoMaxEvents: 1
} as const;

export const CULTIVATION_EVENTS: readonly CultivationEventDefinition[] = [
  {
    id: 'neighbor-porridge',
    category: 'mortal-life',
    minStage: 0,
    weight: 5,
    title: '门槛上的热粥',
    detail: '雨连下三夜，陶婶把一碗掺薯皮的热粥搁在门槛上，碗沿缺口特意朝着屋里。',
    detailTokens: ['薯皮', '碗沿缺口'],
    modernEcho: false,
    choices: [
      {
        id: 'return-grain',
        label: '回一捧留种粮',
        detail: '匀出自己的口粮，把洗净的旧陶碗送回去。',
        costs: [{ resource: 'food', amount: 1 }],
        effects: { pressure: -8, mortalHeart: 10 },
        historyTags: ['returned-porridge-bowl'],
        tribulationTags: []
      },
      {
        id: 'repair-roof',
        label: '替她补漏屋瓦',
        detail: '趁雨歇上屋，用半日光阴和筋骨还这碗人情。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 1 }],
        effects: { injury: 4, mortalHeart: 12, willpower: 200 },
        historyTags: ['repaired-neighbor-roof'],
        tribulationTags: []
      }
    ]
  },
  {
    id: 'cracked-furnace-wall',
    category: 'mortal-life',
    minStage: 0,
    weight: 5,
    title: '炉壁又开了一线',
    detail: '丹炉内壁的旧裂缝渗出药渣，灶边只剩半盆黄泥，窑匠却要三枚灵石。',
    detailTokens: ['药渣', '半盆黄泥'],
    modernEcho: false,
    choices: [
      {
        id: 'hire-mender',
        label: '请窑匠补炉',
        detail: '交足工钱，让懂火候的人把裂缝一次补稳。',
        costs: [{ resource: 'spiritStones', amount: 3 }],
        effects: { pressure: -6, insight: 1 },
        historyTags: ['hired-kiln-mender'],
        tribulationTags: []
      },
      {
        id: 'patch-by-hand',
        label: '自己和泥补缝',
        detail: '耗掉一日守着阴干，手背也被余火燎出水泡。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 1 }],
        effects: { injury: 5, insight: 2, pressure: 3 },
        historyTags: ['patched-furnace-by-hand'],
        tribulationTags: []
      }
    ]
  },
  {
    id: 'seed-or-medicine',
    category: 'mortal-life',
    minStage: 0,
    weight: 5,
    title: '留种还是换药',
    detail: '药铺肯收最后几株母草，柜上那丸止痛散却混着发苦的旧丹衣。',
    detailTokens: ['母草', '旧丹衣'],
    modernEcho: false,
    choices: [
      {
        id: 'keep-seeds',
        label: '留下母株种子',
        detail: '花一日晾种封罐，忍着旧伤等来年的苗。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 1 }],
        effects: { mortalHeart: 8, insight: 1, injury: 2 },
        historyTags: ['kept-mother-seeds'],
        tribulationTags: []
      },
      {
        id: 'trade-for-medicine',
        label: '换一丸止痛散',
        detail: '拿母草换眼前的轻省，也把陈丹的苦味咽下。',
        costs: [{ resource: 'herbs', amount: 3 }],
        effects: { pills: 1, injury: -12, pillPoison: 3000, mortalHeart: -3 },
        historyTags: ['traded-seeds-for-medicine'],
        tribulationTags: []
      }
    ]
  },
  {
    id: 'delayed-wages',
    category: 'mortal-life',
    minStage: 0,
    weight: 5,
    title: '短工钱又迟了',
    detail: '账房把木窗合到只剩一条缝，院里等工钱的人脚边堆着午后落下的槐叶。',
    detailTokens: ['木窗', '槐叶'],
    modernEcho: false,
    choices: [
      {
        id: 'wait-for-pay',
        label: '守到落锁讨钱',
        detail: '赔上一顿饭和两日工夫，等账房终于数出铜筹。',
        costs: [
          { resource: 'lifespanRemainingDays', amount: 2 },
          { resource: 'food', amount: 1 }
        ],
        effects: { spiritStones: 5, pressure: 10, willpower: 200 },
        historyTags: ['waited-for-wages'],
        tribulationTags: []
      },
      {
        id: 'take-stale-rice',
        label: '认下半袋陈米',
        detail: '少讨几枚工钱，先把带糠味的米背回灶房。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 1 }],
        effects: { food: 3, spiritStones: 1, pressure: 4, mortalHeart: -2 },
        historyTags: ['accepted-stale-rice'],
        tribulationTags: []
      }
    ]
  },
  {
    id: 'broken-hoe-handle',
    category: 'mortal-life',
    minStage: 0,
    weight: 5,
    title: '旧锄断了柄',
    detail: '锄柄从虫蛀处折断。他模糊想起一个叫保修的词，眼下却只有枣木、麻绳和起泡的手。',
    detailTokens: ['虫蛀', '麻绳'],
    modernEcho: true,
    choices: [
      {
        id: 'rehaft-hoe',
        label: '削枣木重接',
        detail: '少吃一顿，耐着性子把木楔一寸寸敲实。',
        costs: [
          { resource: 'lifespanRemainingDays', amount: 2 },
          { resource: 'food', amount: 1 }
        ],
        effects: { insight: 2, mortalHeart: 4, endurance: 100 },
        historyTags: ['rehafted-old-hoe'],
        tribulationTags: []
      },
      {
        id: 'rope-repair',
        label: '麻绳缠紧先用',
        detail: '省下木料钱，却让松动的锄头又震裂虎口。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 1 }],
        effects: { injury: 8, pressure: 5, bodyFoundation: 100 },
        historyTags: ['worked-with-rope-repair'],
        tribulationTags: []
      }
    ]
  },
  {
    id: 'purple-cloud-over-fields',
    category: 'celestial-omen',
    minStage: 0,
    weight: 2,
    title: '紫云压过田垄',
    detail: '紫云贴着山腰压来，未熟的引雷草叶尖先亮了，沟里的青蛙却一声不叫。',
    detailTokens: ['引雷草', '青蛙'],
    modernEcho: false,
    choices: [
      {
        id: 'harvest-overnight',
        label: '连夜抢收',
        detail: '用三日寿数和一顿饭，换回雷雨前的两筐草。',
        costs: [
          { resource: 'lifespanRemainingDays', amount: 3 },
          { resource: 'food', amount: 1 }
        ],
        effects: { herbs: 4, injury: 8, pressure: 10 },
        historyTags: ['harvested-before-purple-cloud'],
        tribulationTags: ['protected-herbs:2']
      },
      {
        id: 'watch-thunder-plot',
        label: '留一畦观雷',
        detail: '舍掉两株母草，记下叶脉亮起的先后次序。',
        costs: [
          { resource: 'lifespanRemainingDays', amount: 1 },
          { resource: 'herbs', amount: 2 }
        ],
        effects: { insight: 6, daoAttention: 500, pressure: 4 },
        historyTags: ['kept-thunder-plot'],
        tribulationTags: ['starting-herb:thunder', 'preview-level:+1']
      }
    ]
  },
  {
    id: 'distant-breakthrough-afterglow',
    category: 'celestial-omen',
    minStage: 0,
    weight: 2,
    title: '远山升起破境霞光',
    detail: '远山霞光亮得像白昼，村里人仍趁光补衣，针脚旁的灯油一滴也舍不得添。',
    detailTokens: ['补衣', '灯油'],
    modernEcho: false,
    choices: [
      {
        id: 'close-window',
        label: '合窗守住心神',
        detail: '耗一日闭门静坐，不拿凡人的日子同仙人比。',
        costs: [
          { resource: 'lifespanRemainingDays', amount: 1 },
          { resource: 'food', amount: 1 }
        ],
        effects: { pressure: -10, mortalHeart: 4, willpower: 300 },
        historyTags: ['closed-window-to-keep-heart'],
        tribulationTags: ['ward-charge:+1']
      },
      {
        id: 'copy-sky-pattern',
        label: '登坡拓下天纹',
        detail: '在冷风里守三日，把霞光退去前的纹路描完。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 3 }],
        effects: { injury: 5, pressure: 8, insight: 7, daoAttention: 700 },
        historyTags: ['copied-breakthrough-sky-pattern'],
        tribulationTags: ['preview-level:+1', 'source-power:+5']
      }
    ]
  },
  {
    id: 'sect-tribute-board',
    category: 'thematic-contrast',
    minStage: 1,
    weight: 1,
    title: '宗门贡赋榜贴进村口',
    detail: '新榜用朱砂写着仙门赐福，榜脚却压着三户欠粮人的指印和一张卖田契。',
    detailTokens: ['朱砂', '卖田契'],
    modernEcho: false,
    choices: [
      {
        id: 'pay-tribute',
        label: '缴清四枚灵石',
        detail: '换一张盖印凭帖，也认下这笔凡人躲不开的账。',
        costs: [{ resource: 'spiritStones', amount: 4 }],
        effects: { pressure: -4, mortalHeart: -3 },
        historyTags: ['paid-sect-tribute'],
        tribulationTags: ['sect-tally:cleared']
      },
      {
        id: 'write-mortal-name',
        label: '把凡名写回榜尾',
        detail: '用一日刻下名字，等巡榜弟子把它连皮削去。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 1 }],
        effects: { pressure: 10, willpower: 600, heavenDebt: 1000, daoAttention: 500 },
        historyTags: ['wrote-mortal-name-on-board'],
        tribulationTags: ['safe-range:-3']
      }
    ]
  },
  {
    id: 'xiao-wuji-sword-scar',
    category: 'thematic-contrast',
    minStage: 1,
    weight: 1,
    title: '萧无极留下的剑痕',
    detail: '萧无极踏云而过，随手一道剑痕劈开田埂；药篓翻在泥里，他没有回头。',
    detailTokens: ['田埂', '药篓'],
    modernEcho: false,
    choices: [
      {
        id: 'protect-herb-basket',
        label: '绕路护住药篓',
        detail: '多走三日山路，把沾泥的草一株株拣回来。',
        costs: [
          { resource: 'lifespanRemainingDays', amount: 3 },
          { resource: 'food', amount: 1 }
        ],
        effects: { mortalHeart: 5, pressure: 4 },
        historyTags: ['protected-herb-basket'],
        tribulationTags: ['sword-scar-obstacle:1']
      },
      {
        id: 'copy-sword-scar',
        label: '俯身拓下剑痕',
        detail: '让残意割开掌心，也要看清仙人随手一剑的去路。',
        costs: [{ resource: 'lifespanRemainingDays', amount: 1 }],
        effects: { injury: 12, pressure: 8, insight: 8, daoAttention: 1000 },
        historyTags: ['copied-xiao-wuji-sword-scar'],
        tribulationTags: ['second-lightning-source:1', 'preview-level:+1']
      }
    ]
  }
];

const NON_NEGATIVE_EFFECT_FIELDS: readonly CultivationEventEffectField[] = [
  'bodyFoundation',
  'endurance',
  'willpower',
  'pillPoison',
  'heavenDebt',
  'daoAttention',
  'insight',
  'herbs',
  'food',
  'spiritStones',
  'pills'
];

export interface CultivationEventStateDelta {
  readonly lifespanRemainingDays: number;
  readonly bodyFoundation: number;
  readonly endurance: number;
  readonly willpower: number;
  readonly pillPoison: number;
  readonly heavenDebt: number;
  readonly daoAttention: number;
  readonly pressure: number;
  readonly mortalHeart: number;
  readonly insight: number;
  readonly injury: number;
  readonly herbs: number;
  readonly food: number;
  readonly spiritStones: number;
  readonly pills: number;
}

export type CultivationEventErrorCode =
  | 'invalid-state'
  | 'event-unavailable'
  | 'choice-not-found'
  | 'insufficient-resource';

export interface CultivationEventError {
  readonly code: CultivationEventErrorCode;
  readonly eventId: CultivationEventId | null;
  readonly choiceId: string | null;
  readonly resource: CultivationEventResource | null;
}

export interface CultivationEventResolution {
  readonly eventId: CultivationEventId;
  readonly category: CultivationEventCategory;
  readonly choiceId: string;
  readonly historyTags: readonly CultivationEventHistoryTag[];
  readonly tribulationTags: readonly CultivationTribulationTag[];
  readonly delta: CultivationEventStateDelta;
}

export type ResolveCultivationEventChoiceResult =
  | {
      readonly ok: true;
      readonly state: CultivationRunState;
      readonly resolution: CultivationEventResolution;
    }
  | {
      readonly ok: false;
      readonly state: CultivationRunState;
      readonly error: CultivationEventError;
    };

export function cultivationEventCandidates(state: CultivationRunState, params: BalanceParams = DEFAULT_BALANCE): readonly CultivationEventDefinition[] {
  if (cultivationRunStateError(state, params) || state.status !== 'active') return [];
  return CULTIVATION_EVENTS.filter(event => state.stage >= event.minStage);
}

/** Stable 32-bit mixing; no ambient randomness or mutable PRNG stream. */
function eventRoll(seed: number, agendaIndex: number, ordinal: number): number {
  // Decimal spellings keep hash constants out of the repository's color-literal discipline scan.
  let value = (seed ^ Math.imul(agendaIndex + 1, 2654435761) ^ Math.imul(ordinal + 1, 2246822507)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 2146121005);
  value = Math.imul(value ^ (value >>> 15), 2221713035);
  return (value ^ (value >>> 16)) >>> 0;
}

export function sampleCultivationEvent(
  state: CultivationRunState,
  ordinal: number,
  params: BalanceParams = DEFAULT_BALANCE
): CultivationEventDefinition | null {
  if (!Number.isInteger(ordinal) || ordinal < 0) return null;
  const candidates = cultivationEventCandidates(state, params);
  const totalWeight = candidates.reduce((sum, event) => sum + event.weight, 0);
  if (totalWeight <= 0) return null;
  let roll = eventRoll(state.seed, state.agendaIndex, ordinal) % totalWeight;
  for (const event of candidates) {
    if (roll < event.weight) return event;
    roll -= event.weight;
  }
  return candidates[candidates.length - 1] ?? null;
}

function stateDelta(before: CultivationRunState, after: CultivationRunState): CultivationEventStateDelta {
  return {
    lifespanRemainingDays: after.lifespanRemainingDays - before.lifespanRemainingDays,
    bodyFoundation: after.bodyFoundation - before.bodyFoundation,
    endurance: after.endurance - before.endurance,
    willpower: after.willpower - before.willpower,
    pillPoison: after.pillPoison - before.pillPoison,
    heavenDebt: after.heavenDebt - before.heavenDebt,
    daoAttention: after.daoAttention - before.daoAttention,
    pressure: after.pressure - before.pressure,
    mortalHeart: after.mortalHeart - before.mortalHeart,
    insight: after.insight - before.insight,
    injury: after.injury - before.injury,
    herbs: after.herbs - before.herbs,
    food: after.food - before.food,
    spiritStones: after.spiritStones - before.spiritStones,
    pills: after.pills - before.pills
  };
}

function eventById(eventId: CultivationEventId): CultivationEventDefinition | null {
  return CULTIVATION_EVENTS.find(event => event.id === eventId) ?? null;
}

function insufficientCost(state: CultivationRunState, choice: CultivationEventChoiceDefinition): CultivationEventResource | null {
  for (const cost of choice.costs) {
    if (state[cost.resource] < cost.amount) return cost.resource;
  }
  return null;
}

export function resolveCultivationEventChoice(
  state: CultivationRunState,
  eventId: CultivationEventId,
  choiceId: string,
  params: BalanceParams = DEFAULT_BALANCE
): ResolveCultivationEventChoiceResult {
  const resolved = withDefaultBalanceParams(params);
  const original = cloneCultivationRunState(state);
  if (cultivationRunStateError(state, resolved) || state.status !== 'active') {
    return {
      ok: false,
      state: original,
      error: { code: 'invalid-state', eventId, choiceId, resource: null }
    };
  }

  const event = eventById(eventId);
  if (!event || state.stage < event.minStage) {
    return {
      ok: false,
      state: original,
      error: { code: 'event-unavailable', eventId, choiceId, resource: null }
    };
  }
  const choice = event.choices.find(candidate => candidate.id === choiceId);
  if (!choice) {
    return {
      ok: false,
      state: original,
      error: { code: 'choice-not-found', eventId, choiceId, resource: null }
    };
  }

  const missing = insufficientCost(state, choice);
  if (missing) {
    return {
      ok: false,
      state: original,
      error: { code: 'insufficient-resource', eventId, choiceId, resource: missing }
    };
  }

  const next = cloneCultivationRunState(state);
  for (const cost of choice.costs) next[cost.resource] -= cost.amount;
  for (const [field, delta] of Object.entries(choice.effects) as [CultivationEventEffectField, number][]) {
    next[field] += delta;
  }

  next.pressure = clampInt(next.pressure, 0, resolved.cultivationRun.pressureCap);
  next.mortalHeart = clampInt(next.mortalHeart, 0, resolved.cultivationRun.mortalHeartCap);
  next.injury = clampInt(next.injury, 0, resolved.cultivationRun.injuryCap);
  next.pillPoison = clampInt(next.pillPoison, 0, resolved.pillPoison.cap * 1000);
  for (const field of NON_NEGATIVE_EFFECT_FIELDS) next[field] = Math.max(0, Math.round(next[field]));
  next.status = next.lifespanRemainingDays === 0 ? 'lifespan-ended' : 'active';

  return {
    ok: true,
    state: next,
    resolution: {
      eventId: event.id,
      category: event.category,
      choiceId: choice.id,
      historyTags: choice.historyTags,
      tribulationTags: choice.tribulationTags,
      delta: stateDelta(state, next)
    }
  };
}
