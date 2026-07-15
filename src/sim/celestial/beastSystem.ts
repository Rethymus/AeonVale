/**
  * 妖兽潮系统。
 *
  * 因果链：灵气潮汐（event.qi-tide）活跃 → 灵草生长×1.5 疯长成熟 → 引来妖兽群抢食。
  * 这是 M4「天象奇遇引擎」的核心交付：事件不是一次性 buff，而是触发可复现的连锁后果。
 *
  * 行为：
  * - 触发：qi-tide 活跃 + 存在成熟作物 + 无活跃妖兽潮 + rng.beast 命中 surgeChancePerDay。
  * 生成 beastsRemaining ∈ [countMin, countMaxBase+stage]，持续 surgeDurationDays 日。
  * - 啃食：妖兽群停留至到时，每日啃食 min(妖兽数, 成熟作物) 株（摧毁作物 + 清空地块）。
  * 妖兽数在潮期间恒定（不因吃饱而离去），使 surgeDurationDays 成为有意义的威胁旋钮。
  * - 退去：surgeDurationDays 到时（即便仍有作物）或某日无食可吃（妖兽不空守空田）。
  * 被动退去无内丹；内丹仅由玩家主动猎妖获得。
 *
  * 确定性（C3）：触发与计数均走 ctx.rng.beast 流；无 Math.random() / 无 IO / 无渲染。
 */
import type { GameState, BeastSurge } from '@sim/world/state';
import { emit, nextEntityId } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { itemCount, mutateItem } from '@sim/world/player';
import { activeArrayCount, activeArraysCoveringTile, hasActiveArrayCoverage } from '@sim/tribulation/arrays';
import { MILLI } from '@sim/world/types';

export interface TameGuardBeastResult {
 ok: boolean;
 id?: number;
 reason?: string;
}

export interface FeedGuardBeastResult {
 ok: boolean;
 id?: number;
 reason?: string;
}

export interface AssignGuardBeastPatrolResult {
 ok: boolean;
 beastId?: number;
 tileId?: number;
 reason?: string;
}

export type GuardBeastSpecialty = NonNullable<GameState['guardBeasts'][number]['specialty']>;

const GUARD_SPECIALTY_BOND_THRESHOLD = 30;
/** 专长精通阈值：已固化专长且羁绊达此值 → 进入精通层，专长收益再升一档。与上方专长阈值同为模块常量，后续可一并提升为可调参。 */
const GUARD_SPECIALTY_MASTERY_BOND = 80;

export function guardBeastSpecialtyReady(beast: GameState['guardBeasts'][number]): boolean {
 return (beast.bond ?? 0) >= GUARD_SPECIALTY_BOND_THRESHOLD;
}

/** 已固化专长且羁绊达精通阈值 → 该巡守兽进入专长精通层。 */
export function guardBeastMasteryReady(beast: GameState['guardBeasts'][number]): boolean {
 return beast.specialty != null && (beast.bond ?? 0) >= GUARD_SPECIALTY_MASTERY_BOND;
}

function gainGuardBeastBond(state: GameState, ctx: SimContext, beast: GameState['guardBeasts'][number], gain: number): number {
 if (gain <= 0) return beast.bond ?? 0;
 const before = beast.bond ?? 0;
 const nextBond = Math.min(ctx.params.celestial.beast.guardBondMax, before + gain);
 beast.bond = nextBond;
 // 跨越专长精通阈值且已固化专长 → 发出精通解锁事件。
 if (beast.specialty && before < GUARD_SPECIALTY_MASTERY_BOND && nextBond >= GUARD_SPECIALTY_MASTERY_BOND) {
 emit(state, 'guard-beast-mastery-unlocked', { id: beast.id, specialty: beast.specialty, bond: nextBond });
 }
 return nextBond;
}

function unlockGuardBeastSpecialty(
 state: GameState,
 beastId: number,
 specialty: GuardBeastSpecialty,
): GameState['guardBeasts'][number] | null {
 const beast = state.guardBeasts.find((entry) => entry.id === beastId);
 if (!beast) return null;
 if (beast.specialty || !guardBeastSpecialtyReady(beast)) return beast;
 beast.specialty = specialty;
 emit(state, 'guard-beast-specialty-unlocked', { id: beast.id, specialty, bond: beast.bond });
 // 若专长固化时羁绊已达精通阈值（先靠投喂涨满、再首次出手的少见路径），补发精通解锁事件。
 if (guardBeastMasteryReady(beast)) {
 emit(state, 'guard-beast-mastery-unlocked', { id: beast.id, specialty, bond: beast.bond });
 }
 return beast;
}

function patrolAssignmentForTile(state: GameState, tileId: number) {
 return state.guardBeastPatrols.find((assignment) => assignment.tileId === tileId) ?? null;
}

function patrolBonusForTile(state: GameState, tileId: number): number {
 const assignment = patrolAssignmentForTile(state, tileId);
 if (!assignment) return 0;
 const beast = state.guardBeasts.find((entry) => entry.id === assignment.beastId);
 if (!beast || beast.vigor <= 0) return 0;
 // 专长精通层巡守兽在巡逻地块上提供更高护田优先级。
 if (guardBeastMasteryReady(beast)) return beast.specialty === 'field-ward' ? 4 : 3;
 return beast.specialty === 'field-ward' ? 3 : 2;
}

/** 阵守巡守兽在活跃阵法覆盖内巡逻时产生的农庄共振收益。
  * 仅当阵守（array-warden）专长、有精力、且巡逻地块处于活跃阵法覆盖内才共振；精通层收益翻倍。
  * 纯派生判定，不引入新持久字段（旧档自动兼容）。 */
export interface ArrayWardenResonance {
 moistureRetentionBonus: number; // 毫点：叠加到绝缘阵湿度保留
 healthProtectionBonus: number; // 毫点：叠加到绝缘阵作物健康保护
 qiRegenBonus: number; // 无量纲：叠加到引雷阵灵气恢复倍率
}

const ARRAY_WARDEN_RESONANCE_BASE: ArrayWardenResonance = {
 moistureRetentionBonus: 2 * MILLI,
 healthProtectionBonus: MILLI,
 qiRegenBonus: 0.05,
};
const ARRAY_WARDEN_RESONANCE_MASTER: ArrayWardenResonance = {
 moistureRetentionBonus: 4 * MILLI,
 healthProtectionBonus: 2 * MILLI,
 qiRegenBonus: 0.1,
};

export function arrayWardenResonanceForTile(state: GameState, tileId: number): ArrayWardenResonance | null {
 const assignment = patrolAssignmentForTile(state, tileId);
 if (!assignment) return null;
 const beast = state.guardBeasts.find((entry) => entry.id === assignment.beastId);
 if (!beast || beast.vigor <= 0 || beast.specialty !== 'array-warden') return null;
 // 仅当巡逻地块落在活跃阵法覆盖内才共振（阵守专长职责：守阵）。
 if (activeArraysCoveringTile(state, tileId).length <= 0) return null;
 return guardBeastMasteryReady(beast) ? ARRAY_WARDEN_RESONANCE_MASTER : ARRAY_WARDEN_RESONANCE_BASE;
}

/**
  * 阵守巡守兽在绝缘阵覆盖内巡逻时，额外强化绝缘阵的留世控温收益。
  * 每只符合条件的阵守巡守兽为暖棚日终控温贡献额外 careGainBonus / neglectBuffer；精通层翻倍。
  * 与 insulationClimateControlBonus 同形，便于在留世日终结算中按毫点叠加。
 */
export function arrayWardenInsulationClimateBoost(state: GameState): { careGainBonus: number; neglectBuffer: number } {
 let careGainBonus = 0;
 let neglectBuffer = 0;
 for (const assignment of state.guardBeastPatrols) {
 const beast = state.guardBeasts.find((entry) => entry.id === assignment.beastId);
 if (!beast || beast.vigor <= 0 || beast.specialty !== 'array-warden') continue;
 if (!hasActiveArrayCoverage(state, assignment.tileId, 'array.insulation')) continue;
 const tier = guardBeastMasteryReady(beast) ? 2 : 1;
 careGainBonus += tier;
 neglectBuffer += tier;
 }
 return { careGainBonus, neglectBuffer };
}

/** 是否存在「阵守巡守兽在活跃阵法覆盖内巡逻」的布防。 */
export function arrayWardenPatrolActive(state: GameState): boolean {
 for (const assignment of state.guardBeastPatrols) {
 const beast = state.guardBeasts.find((entry) => entry.id === assignment.beastId);
 if (!beast || beast.vigor <= 0 || beast.specialty !== 'array-warden') continue;
 if (activeArraysCoveringTile(state, assignment.tileId).length > 0) return true;
 }
 return false;
}

/** 妖兽潮触发的因果前提：仅灵气潮汐活跃时才可能引兽。 */
export function qiTideActive(state: GameState): boolean {
 return state.activeEvent?.defId === 'event.qi-tide';
}

/** 当前田间的成熟作物列表：同时编码妖兽诱饵优先级与巡守兽护田优先级。 */
function matureCrops(state: GameState): Array<{ tileId: number; defId: string; lurePriority: number; guardPriority: number }> {
 const out: Array<{ tileId: number; defId: string; lurePriority: number; guardPriority: number }> = [];
 for (const [tileId, crop] of state.crops) {
 if (crop.stage !== 'mature') continue;
 let lurePriority = 0;
 let guardPriority = 0;
 if (hasActiveArrayCoverage(state, tileId, 'array.lightning-rod')) lurePriority += 1;
 if (hasActiveArrayCoverage(state, tileId, 'array.lightning-rod')) guardPriority -= 1;
 if (hasActiveArrayCoverage(state, tileId, 'array.insulation')) {
 lurePriority -= 1;
 guardPriority += 1;
 }
 guardPriority += patrolBonusForTile(state, tileId);
 out.push({ tileId, defId: crop.defId, lurePriority, guardPriority });
 }
 out.sort((a, b) => b.lurePriority - a.lurePriority || a.tileId - b.tileId);
 return out;
}

function insulationRepelsSurge(state: GameState, prey: ReturnType<typeof matureCrops>): boolean {
 if (prey.length <= 0) return false;
 if (activeArrayCount(state, 'array.insulation') <= 0) return false;
 for (const crop of prey) {
 if (!hasActiveArrayCoverage(state, crop.tileId, 'array.insulation')) return false;
 if (hasActiveArrayCoverage(state, crop.tileId, 'array.lightning-rod')) return false;
 }
 return true;
}

function guardBeastLimit(state: GameState, ctx: SimContext): number {
 const cfg = ctx.params.celestial.beast;
 return cfg.guardBeastLimitBase + state.player.stage * cfg.guardBeastLimitStageBonus;
}

/** 高境界玩家驯养巡守兽自带更高起始羁绊：修为越高，与灵兽气机越相通。低境界（stage≤1）保持 0。 */
function tamedStartingBond(state: GameState, ctx: SimContext): number {
 const cfg = ctx.params.celestial.beast;
 return Math.min(cfg.guardBondMax, Math.max(0, (state.player.stage - 1) * 2));
}

/** 消耗猎妖资源驯养巡守兽：不算传统驭兽，只是守田与预警。 */
export function tameGuardBeast(state: GameState, ctx: SimContext): TameGuardBeastResult {
 const cfg = ctx.params.celestial.beast;
 if (state.guardBeasts.length >= guardBeastLimit(state, ctx)) return { ok: false, reason: '巡守兽栏位不足' };
 if (itemCount(state.player, 'item.beast-core') < cfg.tameCoreCost) return { ok: false, reason: '妖兽内丹不足' };
 if (itemCount(state.player, 'item.spirit-stone') < cfg.tameSpiritStoneCost) return { ok: false, reason: '灵石不足' };

mutateItem(state.player, 'item.beast-core', -cfg.tameCoreCost);
 mutateItem(state.player, 'item.spirit-stone', -cfg.tameSpiritStoneCost);
 const id = nextEntityId(state);
 const startingBond = tamedStartingBond(state, ctx);
 state.guardBeasts.push({ id, vigor: cfg.guardVigorMax, maxVigor: cfg.guardVigorMax, bond: startingBond, specialty: null });
 emit(state, 'guard-beast-tamed', { id, coreCost: cfg.tameCoreCost, spiritStoneCost: cfg.tameSpiritStoneCost, startingBond });
 return { ok: true, id };
}

export function feedGuardBeast(state: GameState, ctx: SimContext, herbItemId: string): FeedGuardBeastResult {
 const beast = state.guardBeasts[0];
 if (!beast) return { ok: false, reason: '尚无巡守兽' };
 if (!ctx.content.herbs.has(herbItemId)) return { ok: false, reason: '不是灵草' };
 if (itemCount(state.player, herbItemId) < 1) return { ok: false, reason: '灵草不足' };
 const cfg = ctx.params.celestial.beast;
 const herb = ctx.content.herbs.get(herbItemId)!;
 // 高阶灵草喂养羁绊加成：珍稀灵草更能拉近与巡守兽的羁绊。
 const baseGain = cfg.guardFeedBondGain;
 const tierBonus = herb.tier >= 3 ? baseGain : herb.tier >= 2 ? Math.ceil(baseGain / 2) : 0;
 mutateItem(state.player, herbItemId, -1);
 beast.vigor = Math.min(beast.maxVigor, beast.vigor + cfg.guardFeedVigorGain);
 gainGuardBeastBond(state, ctx, beast, baseGain + tierBonus);
 emit(state, 'guard-beast-fed', { id: beast.id, herbItemId, herbTier: herb.tier, vigor: beast.vigor, bond: beast.bond, bondGain: baseGain + tierBonus, bondTierBonus: tierBonus });
 return { ok: true, id: beast.id };
}

export function assignGuardBeastPatrol(state: GameState, beastId: number, tileId: number): AssignGuardBeastPatrolResult {
 const beast = state.guardBeasts.find((entry) => entry.id === beastId);
 if (!beast) return { ok: false, reason: '巡守兽不存在' };
 if (itemCount(state.player, 'item.guard-beast-whistle') < 1) return { ok: false, reason: '缺少守田兽哨' };
 const tile = state.tiles[tileId];
 if (!tile) return { ok: false, reason: '巡逻地块不存在' };

state.guardBeastPatrols = state.guardBeastPatrols.filter((assignment) => assignment.beastId !== beastId && assignment.tileId !== tileId);
 state.guardBeastPatrols.push({ beastId, tileId, assignedDay: state.day });
 emit(state, 'guard-beast-patrol-assigned', { beastId, tileId, assignedDay: state.day });
 return { ok: true, beastId, tileId };
}

function recoverGuardBeasts(state: GameState, ctx: SimContext): void {
 const base = ctx.params.celestial.beast.guardVigorRecoveryPerDay;
 if (base <= 0) return;
 for (const beast of state.guardBeasts) {
 const before = beast.vigor;
 // 专长精通层巡守兽日终精力恢复更快。
 const recovery = guardBeastMasteryReady(beast) ? base + 1 : base;
 beast.vigor = Math.min(beast.maxVigor, beast.vigor + recovery);
 if (beast.vigor !== before) emit(state, 'guard-beast-recover', { id: beast.id, vigor: beast.vigor });
 }
}

function guardVigorCost(beast: GameState['guardBeasts'][number], ctx: SimContext): number {
 const cfg = ctx.params.celestial.beast;
 if ((beast.bond ?? 0) >= cfg.guardBondCostReductionThreshold) return Math.max(1, cfg.guardVigorCostReduced);
 return Math.max(1, cfg.guardVigorCostPerBlock);
}

function blockedPreyIndices(
 prey: ReturnType<typeof matureCrops>,
 incomingCount: number,
 blockedCount: number,
): number[] {
 const candidates = prey
 .slice(0, incomingCount)
 .map((crop, index) => ({ index, guardPriority: crop.guardPriority, tileId: crop.tileId }))
 .sort((a, b) => b.guardPriority - a.guardPriority || a.tileId - b.tileId);
 return candidates.slice(0, blockedCount).map((entry) => entry.index).sort((a, b) => a - b);
}

function guardBlocks(state: GameState, ctx: SimContext, incomingBeasts: number, prey: ReturnType<typeof matureCrops>): number {
 let remaining = Math.min(incomingBeasts, prey.length);
 let blockedCount = 0;
 for (const beast of state.guardBeasts) {
 const cost = guardVigorCost(beast, ctx);
 while (remaining > 0 && beast.vigor >= cost) {
 beast.vigor -= cost;
 const bond = gainGuardBeastBond(state, ctx, beast, ctx.params.celestial.beast.guardBondGainPerBlock);
 const specialtyBefore = beast.specialty;
 const specialtyAfter = unlockGuardBeastSpecialty(state, beast.id, 'field-ward')?.specialty ?? specialtyBefore;
 blockedCount += 1;
 remaining -= 1;
 emit(state, 'guard-beast-block', {
 id: beast.id,
 vigor: beast.vigor,
 bond,
 bondGain: ctx.params.celestial.beast.guardBondGainPerBlock,
 specialty: specialtyAfter,
 specialtyUnlocked: specialtyBefore !== specialtyAfter ? specialtyAfter : undefined,
 });
 }
 if (remaining <= 0) break;
 }
 return blockedCount;
}

export function applyGuardBeastIncidentAssistBond(state: GameState, ctx: SimContext, beastId: number): number | null {
 const beast = state.guardBeasts.find((entry) => entry.id === beastId);
 if (!beast) return null;
 return gainGuardBeastBond(state, ctx, beast, ctx.params.celestial.beast.guardBondGainPerIncidentAssist);
}

export function applyGuardBeastSpecialtyProgress(
 state: GameState,
 beastId: number,
 specialty: GuardBeastSpecialty,
): GuardBeastSpecialty | null {
 const beast = unlockGuardBeastSpecialty(state, beastId, specialty);
 return beast?.specialty ?? null;
}

export function preferredGuardBeastForPatrol(state: GameState): GameState['guardBeasts'][number] | null {
 let best: GameState['guardBeasts'][number] | null = null;
 for (const assignment of state.guardBeastPatrols) {
 const beast = state.guardBeasts.find((entry) => entry.id === assignment.beastId);
 if (!beast || beast.vigor <= 0) continue;
 if (!best || beast.bond > best.bond || (beast.bond === best.bond && beast.id < best.id)) best = beast;
 }
 return best;
}

/**
  * 推进妖兽潮：若活跃则啃食成熟作物并结算退去；否则按因果链尝试触发。
  * 在 resolveDayEnd 中于 applyFarmDayEnd 之后调用（保证当日新成熟的作物可被啃食）。
 */
export function tickBeasts(state: GameState, ctx: SimContext): BeastSurge | null {
 recoverGuardBeasts(state, ctx);
 const bs = state.beastSurge;
 if (bs) {
 // ── 啃食阶段：妖兽群每日啃食 min(妖兽数, 成熟作物) 株，停留至到时或无食 ──
 const prey = matureCrops(state);
 if (insulationRepelsSurge(state, prey)) {
 emit(state, 'beast-surge-repelled', {
 beastsRemaining: bs.beastsRemaining,
 insulatedTileIds: prey.map((crop) => crop.tileId),
 insulationArrayCount: activeArrayCount(state, 'array.insulation'),
 });
 emit(state, 'beast-surge-end', { beastsRemaining: bs.beastsRemaining, repelled: true });
 state.beastSurge = null;
 return null;
 }
 const incoming = Math.min(bs.beastsRemaining, prey.length);
 const blocked = guardBlocks(state, ctx, bs.beastsRemaining, prey);
 const blockedSet = new Set(blockedPreyIndices(prey, incoming, blocked));
 let eaten = 0;
 for (let i = 0; i < incoming; i++) {
 if (blockedSet.has(i)) continue;
 const { tileId, defId } = prey[i]!;
 const tile = state.tiles[tileId];
 if (tile) tile.cropId = null;
 state.crops.delete(tileId);
 emit(state, 'beast-eat-crop', { defId, tileId });
 eaten += 1;
 }
 if (blocked > 0) {
 const protectedTileIds = [...blockedSet].map((index) => prey[index]!.tileId);
 emit(state, 'guard-beast-patrol', { blocked, eaten, protectedTileIds });
 }
 bs.daysLeft -= 1;
 // 退去：到时（daysLeft≤0）或今日无食可吃（妖兽不空守空田）。被动退去不授予猎妖战利品。
 if (bs.daysLeft <= 0 || prey.length === 0) {
 emit(state, 'beast-surge-end', { beastsRemaining: bs.beastsRemaining });
 state.beastSurge = null;
 }
 return state.beastSurge;
 }

// ── 触发阶段：灵气潮汐 + 成熟作物 + 概率 ──
 if (!qiTideActive(state)) return null;
 if (matureCrops(state).length === 0) return null;
 const p = ctx.params.celestial.beast;
 if (!ctx.rng.beast.chance(p.surgeChancePerDay)) return null;

const countMax = p.countMaxBase + state.player.stage;
 const count = ctx.rng.beast.intRange(p.countMin, countMax + 1); // [countMin, countMax]
 state.beastSurge = { beastsRemaining: count, daysLeft: p.surgeDurationDays };
 emit(state, 'beast-surge-start', { count, durationDays: p.surgeDurationDays });
 return state.beastSurge;
}
