import type { GameEvent } from '@sim';
import type { ContentRegistry } from '@content/defs';
import { inferOnboardingObjectiveId, onboardingObjectiveAssetId, primaryObjectiveLine, stripObjectivePrefix } from './onboardingObjective';

export interface SummaryPresentation {
  message: string;
  assetId?: string;
}

export function composeEndDayToastMessage(summaryMessage: string, advanceToast: string | null): string {
  if (!advanceToast) return summaryMessage;
  if (summaryMessage.includes('下一步：')) return summaryMessage;
  return `${summaryMessage}\n${advanceToast}`;
}

interface SummaryHintRouteRule {
  assetId: string;
  exact: readonly string[];
  aliases: readonly string[];
}

const SUMMARY_HINT_ROUTE_RULES: ReadonlyArray<SummaryHintRouteRule> = [
  {
    assetId: 'loc.festival-ground',
    exact: ['先去节日会场看看今日摊位，再决定要不要参与会场试礼。', '灵芽节已开，先去会场转一圈再安排今日农务。'],
    aliases: ['节日会场', '灵芽节', '炎阳祭', '金秋会', '寒岁祭', '会场']
  },
  {
    assetId: 'loc.tea-shed',
    exact: ['先去旧茶棚歇脚，把今日闲居节奏落下来。'],
    aliases: ['旧茶棚', '茶棚']
  },
  {
    assetId: 'loc.greenhouse',
    exact: ['优先补暖棚苗床，让离季育苗真正稳定。'],
    aliases: ['暖棚', '苗床']
  },
  {
    assetId: 'loc.drying-yard',
    exact: ['先看晾晒架旁还有没有空位，把秋收药材及时转成稳定货。'],
    aliases: ['晾晒架旁', '晾晒场', '晾晒']
  },
  {
    assetId: 'loc.array-shed',
    exact: ['去阵坊核对阵核和符炉，再决定补哪一块控场能力。', '去阵器棚核对阵核和符炉，再决定补哪一块控场能力。'],
    aliases: ['阵器棚', '阵坊', '阵法', '阵核', '符炉']
  },
  {
    assetId: 'loc.herb-plot',
    exact: [],
    aliases: ['露根药圃', '药圃']
  },
  {
    assetId: 'loc.creek-field',
    exact: [],
    aliases: ['溪边药田', '药田']
  },
  {
    assetId: 'loc.ruin-gate',
    exact: ['若想推进旧阵线，先去遗迹寻访或捐藏经。'],
    aliases: ['遗迹门口', '遗迹', '旧阵', '藏经']
  },
  {
    assetId: 'loc.spirit-vein',
    exact: ['若想补炼体材料，先探残脉，再回来和他换路。'],
    aliases: ['残脉入口', '残脉']
  },
  {
    assetId: 'loc.valley-market',
    exact: ['去山谷集市补几颗种子，把第二轮药材接上。'],
    aliases: ['山谷集市', '集市', '补种子']
  },
  {
    assetId: 'loc.farmstead',
    exact: [],
    aliases: ['农庄']
  }
];

function summaryHintAssetId(normalizedHint: string): string | undefined {
  for (const rule of SUMMARY_HINT_ROUTE_RULES) {
    if (rule.exact.includes(normalizedHint)) return rule.assetId;
  }
  for (const rule of SUMMARY_HINT_ROUTE_RULES) {
    if (rule.aliases.some(alias => normalizedHint.includes(alias))) return rule.assetId;
  }
  return undefined;
}

function firstLoopMilestoneLabel(objectiveHint: string, signals: { shippingSettlement: boolean }): string {
  const objectiveId = inferOnboardingObjectiveId(objectiveHint);
  if (signals.shippingSettlement && objectiveId === 'first-market-restock') return '首轮出货结清';
  if (objectiveId === 'first-loop-complete') return '首轮农务闭环已成';
  return '';
}

function shippingLineLabel(
  content: ContentRegistry,
  line: {
    itemId?: string;
    quality?: string | null;
    count?: number;
    total?: number;
    demand?: { source?: 'commission' | 'special-order'; priceBonus?: number };
  }
): string {
  const itemName = content.items.get(line.itemId ?? '')?.displayName ?? line.itemId ?? '未知物品';
  const qualityPrefix = line.quality ? `${line.quality}` : '';
  const demandTag = line.demand?.source ? `〔${line.demand.source === 'special-order' ? '订单热需' : '委托热需'}+${line.demand.priceBonus ?? 0}〕` : '';
  return `${qualityPrefix}${itemName}×${line.count ?? 0}（${line.total ?? 0}）${demandTag}`;
}

function fallbackHintForSummary(
  hasObjectiveHint: boolean,
  signals: {
    harvest: boolean;
    shippingBlocked: boolean;
    shippingSettlement: boolean;
    celestialStart: boolean;
    matureCount: number;
  }
): string {
  if (hasObjectiveHint) return '';
  if (signals.shippingBlocked) return '先腾出储物戒空位，再把昨夜出货结清。';
  if (signals.shippingSettlement) return '回农庄看看哪块地该补种、浇水或顺手再收一轮。';
  if (signals.harvest) return '先巡一遍农庄，看看要不要立刻出货、补种，或把新收药材转去加工。';
  if (signals.matureCount > 0) return '先把成熟灵草收掉，再决定出货、加工还是留作后用。';
  if (signals.celestialStart) return '留意天象带来的加成与风险，再安排今天的农务路线。';
  return '';
}

function normalizedObjectiveHint(objectiveHint: string): string {
  return stripObjectivePrefix(primaryObjectiveLine(objectiveHint));
}

function objectiveRelayLine(objectiveHint: string): string {
  const extraLines = objectiveHint
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(1);
  if (extraLines.length === 0) return '';

  const relay = extraLines.find(line => line.startsWith('操作：') || line.startsWith('动线：')) ?? extraLines[0] ?? '';
  if (relay.startsWith('操作：')) return `接力：${relay.replace(/^操作：/, '')}`;
  if (relay.startsWith('动线：')) return `接力：${relay.replace(/^动线：/, '')}`;
  return `接力：${relay}`;
}

function settlementPurposeLine(milestoneLabel: string, signals: { shippingSettlement: boolean }): string {
  if (milestoneLabel === '首轮出货结清' && signals.shippingSettlement) {
    return '用途：灵石先补种子、炉料与备劫消耗。';
  }
  return '';
}

export function daySummaryMessage(day: number, events: readonly GameEvent[], content: ContentRegistry, breakthroughReady: boolean, objectiveHint = ''): string {
  const evStart = events.find(e => e.type === 'celestial-start');
  const loot = events.find(e => e.type === 'beast-loot');
  const hunted = events.find(e => e.type === 'beast-hunted');
  const shippingSettlement = events.find(e => e.type === 'shipping-settlement');
  const shippingBlocked = events.find(e => e.type === 'shipping-blocked');
  const harvest = events.find(e => e.type === 'harvest');
  const matures = events.filter(e => e.type === 'crop-mature').length;
  const normalizedHint = normalizedObjectiveHint(objectiveHint);
  const relayLine = objectiveRelayLine(objectiveHint);
  const milestoneLabel = firstLoopMilestoneLabel(objectiveHint, {
    shippingSettlement: Boolean(shippingSettlement)
  });
  const purposeLine = settlementPurposeLine(milestoneLabel, {
    shippingSettlement: Boolean(shippingSettlement)
  });
  const fallbackHint = fallbackHintForSummary(normalizedHint.length > 0 || breakthroughReady, {
    harvest: Boolean(harvest),
    shippingBlocked: Boolean(shippingBlocked),
    shippingSettlement: Boolean(shippingSettlement),
    celestialStart: Boolean(evStart),
    matureCount: matures
  });

  let msg = `第 ${day} 日`;
  if (loot) {
    msg = `猎妖得内丹 ×${(loot.payload as { cores?: number })?.cores ?? 0}`;
  } else if (hunted) {
    msg = '猎妖成功，未得内丹';
  } else if (shippingBlocked) {
    msg = `出货未结：${(shippingBlocked.payload as { reason?: string })?.reason ?? '储物戒已满'}`;
  } else if (shippingSettlement) {
    const payload = shippingSettlement.payload as {
      total?: number;
      lines?: Array<{
        itemId?: string;
        quality?: string | null;
        count?: number;
        total?: number;
        demand?: { source?: 'commission' | 'special-order'; priceBonus?: number };
      }>;
    };
    const lines = (payload.lines ?? []).slice(0, 2).map(line => shippingLineLabel(content, line));
    const detail = lines.length > 0 ? `｜${lines.join('、')}${(payload.lines?.length ?? 0) > 2 ? ' 等' : ''}` : '';
    msg = `出货结算：得灵石 ×${payload.total ?? 0}${detail}`;
  } else if (evStart) {
    msg = `【天象·${(evStart.payload as { displayName?: string })?.displayName ?? ''}】降临！`;
  } else if (matures > 0) {
    msg = `${matures} 株灵草成熟`;
  } else if (harvest) {
    msg = '今日已有灵草入袋';
  }

  if (milestoneLabel) msg = `${milestoneLabel}｜${msg}`;
  if (purposeLine) msg += `｜${purposeLine}`;

  if (normalizedHint) msg += `｜下一步：${normalizedHint}`;
  else if (fallbackHint) msg += `｜明日关注：${fallbackHint}`;

  if (relayLine) msg += `｜${relayLine}`;

  if (breakthroughReady) msg += '　⚠ 体魄已至极限，按 T 主动引劫';
  return msg;
}

function summaryAssetId(events: readonly GameEvent[], _content: ContentRegistry, breakthroughReady: boolean, objectiveHint: string): string | undefined {
  const normalizedHint = normalizedObjectiveHint(objectiveHint);
  const objectiveId = inferOnboardingObjectiveId(objectiveHint);
  const onboardingAssetId = onboardingObjectiveAssetId(objectiveId);
  const hintedLocationAssetId = summaryHintAssetId(normalizedHint);
  if (breakthroughReady && hintedLocationAssetId === undefined) return 'loc.array-shed';

  const fallbackHint = fallbackHintForSummary(normalizedHint.length > 0 || breakthroughReady, {
    harvest: events.some(e => e.type === 'harvest'),
    shippingBlocked: events.some(e => e.type === 'shipping-blocked'),
    shippingSettlement: events.some(e => e.type === 'shipping-settlement'),
    celestialStart: events.some(e => e.type === 'celestial-start'),
    matureCount: events.filter(e => e.type === 'crop-mature').length
  });
  const fallbackLocationAssetId = summaryHintAssetId(fallbackHint);

  const loot = events.find(e => e.type === 'beast-loot');
  if (loot) return 'loc.spirit-vein';
  if (events.some(e => e.type === 'beast-hunted')) return 'sprite.guard-beast';

  const shippingBlocked = events.find(e => e.type === 'shipping-blocked');
  if (shippingBlocked) return hintedLocationAssetId ?? fallbackLocationAssetId ?? 'loc.farmstead';

  const shippingSettlement = events.find(e => e.type === 'shipping-settlement');
  if (shippingSettlement) {
    if (objectiveId === 'first-sow' || objectiveId === 'first-water') return onboardingAssetId;
    if (hintedLocationAssetId) return hintedLocationAssetId;
    return fallbackLocationAssetId ?? 'loc.farmstead';
  }

  const evStart = events.find(e => e.type === 'celestial-start');
  if (evStart) return 'loc.array-shed';

  if (events.some(e => e.type === 'harvest')) {
    if (objectiveId === 'first-sow' || objectiveId === 'first-water') return onboardingAssetId;
    return hintedLocationAssetId ?? 'loc.herb-plot';
  }

  if (events.some(e => e.type === 'crop-mature')) {
    if (objectiveId === 'first-sow' || objectiveId === 'first-water') return onboardingAssetId;
    return hintedLocationAssetId ?? 'loc.herb-plot';
  }
  if (breakthroughReady) return 'loc.array-shed';

  if (objectiveId === 'first-sow' || objectiveId === 'first-water') return onboardingAssetId;
  return hintedLocationAssetId ?? fallbackLocationAssetId ?? 'loc.farmstead';
}

export function daySummaryPresentation(day: number, events: readonly GameEvent[], content: ContentRegistry, breakthroughReady: boolean, objectiveHint = ''): SummaryPresentation {
  return {
    message: daySummaryMessage(day, events, content, breakthroughReady, objectiveHint),
    assetId: summaryAssetId(events, content, breakthroughReady, objectiveHint)
  };
}
