import type { GameState } from '@sim/world/state';
import { farmExpansionTier, hasUpgrade } from '@sim/buildings/upgrades';
import { commissionFlag, getDailyCommission, getActiveSpecialOrders } from '@sim/social/commissions';
import { getGreenhouseRumor, greenhouseNurseryTier, greenhouseVisitFlag } from '@sim/social/greenhouse';
import { ensureStayingWorldState } from './stayingWorld';
import { getTeaShedRumor, teaShedVisitFlag, hasTeaShedRegularAchievement } from '@sim/social/teaShed';
import { arrayWardenPatrolActive, guardBeastMasteryReady } from '@sim/celestial/beastSystem';
import { getCurrentStayingWorldIncident, hasResolvedStayingWorldIncidentForDay } from './stayingWorldIncidents';
import { hasRelationshipPerk } from '@sim/social/relationshipEvents';
import { archiveDonationCount } from '@sim/collection/archive';
import { milliToFp } from '@sim/world/types';

export type StayingWorldGoalTrack = 'warding' | 'quiet-life';

export interface StayingWorldGoalStatus {
  id: string;
  track: StayingWorldGoalTrack;
  title: string;
  summary: string;
  progressLabel: string;
  complete: boolean;
  priority: number;
}

function stayedDays(state: GameState): number {
  if (state.postAscension.mode !== 'stayed-in-world' || state.postAscension.ascensionDay == null) return 0;
  return Math.max(0, state.day - state.postAscension.ascensionDay);
}

function percentLabel(value: number): string {
  return `${Math.round(milliToFp(value))}%`;
}

function wardingGoals(state: GameState): StayingWorldGoalStatus[] {
  const goals: StayingWorldGoalStatus[] = [];
  const staying = ensureStayingWorldState(state);

  goals.push({
    id: 'warding-pressure',
    track: 'warding',
    title: '护田阵势巡稳',
    summary: '留世之后，镇守线不该只靠提示文案，日积月累的护田压力需要被你真正压住。',
    progressLabel: `压力 ${percentLabel(staying.wardingPressure)}｜连疏 ${staying.neglectedWardingDays} 日`,
    complete: staying.wardingPressure <= 35_000 && staying.neglectedWardingDays === 0,
    priority: staying.wardingPressure >= 60_000 ? 96 : staying.wardingPressure >= 36_000 ? 88 : 58
  });

  const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
  if (activeOrder) {
    goals.push({
      id: 'warding-special-order',
      track: 'warding',
      title: `镇守事务：${activeOrder.title}`,
      summary: `优先把${activeOrder.title}做完，稳住人间护田与乡镇秩序。`,
      progressLabel: `${activeOrder.progress}/${activeOrder.request.count}，剩${activeOrder.daysLeft}日`,
      complete: activeOrder.remaining <= 0,
      priority: 100
    });
  } else {
    const incident = getCurrentStayingWorldIncident(state);
    if (incident) {
      const done = hasResolvedStayingWorldIncidentForDay(state, state.day);
      goals.push({
        id: 'warding-incident',
        track: 'warding',
        title: `今日镇守事件：${incident.title}`,
        summary: incident.summary,
        progressLabel: done ? '今日已处置' : `待交 ${incident.itemId}×${incident.count}`,
        complete: done,
        priority: done ? 84 : 95
      });
    }
    const commission = getDailyCommission(state);
    if (commission && commission.requiresPostAscensionStay) {
      const done = state.flags.has(commissionFlag(state.day, commission.id));
      goals.push({
        id: 'warding-daily-commission',
        track: 'warding',
        title: `今日镇守：${commission.title}`,
        summary: `向${commission.npcId === 'npc.array-smith' ? '阵匠' : '守境人'}交付${commission.request.count}份物资，维持护田与巡查。`,
        progressLabel: done ? '今日已完成' : `待交 ${commission.request.itemId}×${commission.request.count}`,
        complete: done,
        priority: 90
      });
    }
  }

  const expansionTier = farmExpansionTier(state);
  const expansionGoalTier = 3;
  goals.push({
    id: 'warding-farm-expansion',
    track: 'warding',
    title: '农庄扩建',
    summary: '扩大可耕地与巡守范围，让留世后的农庄真正能撑起长期镇守。',
    progressLabel: expansionTier > 0 ? `已扩建至 ${expansionTier}/${expansionGoalTier} 阶` : `尚未完成一阶扩建（目标 ${expansionGoalTier} 阶）`,
    complete: expansionTier >= expansionGoalTier,
    priority: 70
  });

  const hasAutoload = hasUpgrade(state, 'farm-autoload-1');
  goals.push({
    id: 'warding-autoload',
    track: 'warding',
    title: '巡守兽搬运联动',
    summary: '补齐巡守兽与仓流联动，让守田不只靠人亲手来回奔走。',
    progressLabel: hasAutoload ? '已建成' : '未建成',
    complete: hasAutoload,
    priority: 60
  });

  const masteryBeast = state.guardBeasts.find(beast => guardBeastMasteryReady(beast)) ?? null;
  const topBond = state.guardBeasts.reduce((max, beast) => Math.max(max, beast.bond ?? 0), 0);
  goals.push({
    id: 'warding-guard-mastery',
    track: 'warding',
    title: '巡守专长精通',
    summary: '把巡守兽羁绊养到精通层（≥80），让长期护田伙伴的专长收益真正兑现。',
    progressLabel: masteryBeast ? `已精通：${masteryBeast.specialty}` : state.guardBeasts.length > 0 ? `最高羁绊 ${topBond}/100` : '尚无巡守兽',
    complete: masteryBeast != null,
    priority: 55
  });

  const wardenPatrol = arrayWardenPatrolActive(state);
  goals.push({
    id: 'warding-array-warden-patrol',
    track: 'warding',
    title: '阵守布防',
    summary: '把阵守专长巡守兽指派到活跃阵法覆盖内巡逻，让阵法与巡守真正互相增益。',
    progressLabel: wardenPatrol ? '已有阵守巡逻共振' : state.guardBeasts.some(beast => beast.specialty === 'array-warden') ? '有阵守兽但未在阵法覆盖内巡逻' : '尚无阵守巡守兽',
    complete: wardenPatrol,
    priority: 52
  });

  // 递送通达：补齐三大专长在目标层的对称——守田（精通）、阵守（巡逻覆盖）之外，
  // 递送专长也该有可见的成长终点（精通层 → 跑腿酬谢与协防搬运长期兑现）。
  const courierMaster = state.guardBeasts.find(beast => beast.specialty === 'courier' && guardBeastMasteryReady(beast)) ?? null;
  const courierBond = state.guardBeasts.filter(beast => beast.specialty === 'courier').reduce((max, beast) => Math.max(max, beast.bond ?? 0), 0);
  goals.push({
    id: 'warding-courier-mastery',
    track: 'warding',
    title: '递送通达',
    summary: '把一只递送专长巡守兽养到精通层，让跑腿酬谢与协防搬运真正兑现成长期收益。',
    progressLabel: courierMaster ? '已精通递送' : state.guardBeasts.some(beast => beast.specialty === 'courier') ? `最高羁绊 ${courierBond}/100` : '尚无递送专长巡守兽',
    complete: courierMaster != null,
    priority: 54
  });

  return goals;
}

function quietLifeGoals(state: GameState): StayingWorldGoalStatus[] {
  const goals: StayingWorldGoalStatus[] = [];
  const staying = ensureStayingWorldState(state);
  const nurseryTier = greenhouseNurseryTier(state);
  const nurseryGoalTier = 3;
  goals.push({
    id: 'quiet-life-greenhouse-nursery',
    track: 'quiet-life',
    title: '暖棚苗床扩建',
    summary: '把暖棚从临时育苗处扩成稳定留种的苗床，才能真正养出离季灵苗。',
    progressLabel: nurseryTier > 0 ? `已扩建至 ${nurseryTier}/${nurseryGoalTier} 阶` : `尚未扩建（目标 ${nurseryGoalTier} 阶）`,
    complete: nurseryTier >= nurseryGoalTier,
    priority: 85
  });

  const teaDone = state.flags.has(teaShedVisitFlag(state.day));
  const teaRumor = getTeaShedRumor(state);
  goals.push({
    id: 'quiet-life-tea-shed',
    track: 'quiet-life',
    title: '旧茶棚歇脚',
    summary: `${teaRumor.title}，留世后的日子也该有安静坐下来的时候。`,
    progressLabel: teaDone ? '今日已歇脚' : '今日未歇脚',
    complete: teaDone,
    priority: 80
  });

  const greenhouseDone = state.flags.has(greenhouseVisitFlag(state.day));
  const greenhouseRumor = getGreenhouseRumor(state);
  goals.push({
    id: 'quiet-life-greenhouse',
    track: 'quiet-life',
    title: '暖棚养护',
    summary: `${greenhouseRumor.title}，把四时留种与过冬育苗慢慢养稳。`,
    progressLabel: greenhouseDone ? '今日已养护' : '今日未养护',
    complete: greenhouseDone,
    priority: 75
  });

  const days = stayedDays(state);
  goals.push({
    id: 'quiet-life-harmony',
    track: 'quiet-life',
    title: '四时家常回稳',
    summary: '茶棚歇脚、暖棚养护这些小事，会慢慢决定留世后的日子到底是安稳还是发涩。',
    progressLabel: `和谐 ${percentLabel(staying.quietHarmony)}｜连疏 ${staying.neglectedQuietDays} 日｜稳住 ${staying.stableDays} 日`,
    complete: staying.quietHarmony >= 70_000 && staying.stableDays >= 3,
    priority: staying.quietHarmony < 45_000 ? 86 : staying.quietHarmony < 60_000 ? 78 : 72
  });

  const teaRegular = hasTeaShedRegularAchievement(state);
  goals.push({
    id: 'quiet-life-tea-regular',
    track: 'quiet-life',
    title: '旧茶棚常客',
    summary: '连续多日到旧茶棚歇脚，把“采菊东篱”的慢节奏真正过成习惯。',
    progressLabel: teaRegular ? '已成常客（满 3 日连击）' : '尚未达成 3 日连击',
    complete: teaRegular,
    priority: 68
  });

  goals.push({
    id: 'quiet-life-settle',
    track: 'quiet-life',
    title: '留世安居',
    summary: '不再追逐飞升后，继续把日子过成一套稳定的四季循环。',
    progressLabel: `已留世 ${days} 日｜稳住 ${staying.stableDays} 日`,
    complete: days >= 7 && staying.stableDays >= 3,
    priority: 50
  });

  // 故交同心：与山谷 NPC 结下深交（320 好感事件）。把新加的体修社交深度
  // 接入留世目标层，让长期经营的玩家看到人情味兑现为可见进度。
  const tier2Perks = ['wandering-cultivator-320', 'herb-gatherer-320', 'array-smith-320'] as const;
  const tier2Count = tier2Perks.reduce((acc, perk) => acc + (hasRelationshipPerk(state, perk) ? 1 : 0), 0);
  goals.push({
    id: 'quiet-life-deep-bond',
    track: 'quiet-life',
    title: '故交同心',
    summary: '与游方散修、采药女、阵匠中任一位结下深交（320 好感），把山谷真正过成有人情味的家。',
    progressLabel: tier2Count > 0 ? `已结深交 ${tier2Count}/3 位` : '尚未与任何人结下深交（320 好感）',
    complete: tier2Count > 0,
    priority: 62
  });

  // 藏经补遗：把藏经阁捐献接入留世目标，让收集线在终局也有可见进度。
  const donations = archiveDonationCount(state);
  const donationGoal = 3;
  goals.push({
    id: 'quiet-life-archive',
    track: 'quiet-life',
    title: '藏经补遗',
    summary: '把游历所得的残卷、灵草、丹方捐入藏经阁，让山谷的传承因你留世而更完整。',
    progressLabel: `已捐 ${donations}/${donationGoal} 件`,
    complete: donations >= donationGoal,
    priority: 58
  });

  return goals;
}

export function getStayingWorldGoals(state: GameState): StayingWorldGoalStatus[] {
  if (state.postAscension.mode !== 'stayed-in-world') return [];
  return [...wardingGoals(state), ...quietLifeGoals(state)].sort((a, b) => b.priority - a.priority || Number(a.complete) - Number(b.complete));
}

export function getPrimaryStayingWorldGoal(state: GameState): StayingWorldGoalStatus | null {
  const goals = getStayingWorldGoals(state);
  return goals.find(goal => !goal.complete) ?? goals[0] ?? null;
}

export function renderStayingWorldGoals(state: GameState): string {
  const goals = getStayingWorldGoals(state);
  if (goals.length === 0) return '—— 留世目标 ——\n（未留世）';
  const lines = ['—— 留世目标 ——'];
  const warding = goals.filter(goal => goal.track === 'warding').slice(0, 2);
  const quietPool = goals.filter(goal => goal.track === 'quiet-life');
  const quietLife = [quietPool.find(goal => goal.id === 'quiet-life-tea-shed'), quietPool.find(goal => goal.id === 'quiet-life-greenhouse')].filter((goal): goal is StayingWorldGoalStatus => goal != null);
  const picked = [...warding, ...quietLife];
  for (const goal of picked) {
    const prefix = goal.complete ? '[已成]' : goal.track === 'warding' ? '[镇守]' : '[闲居]';
    lines.push(`${prefix} ${goal.title}`);
    lines.push(` ${goal.progressLabel}`);
  }
  return lines.join('\n');
}
