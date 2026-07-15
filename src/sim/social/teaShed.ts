import type { SimContext } from '@sim/world/context';
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { MILLI, Season } from '@sim/world/types';

export interface TeaShedRumor {
 id: string;
 title: string;
 lines: readonly string[];
}

/** 旧茶棚歇脚事件分支：特定节气日会偶遇一位茶客留下奇闻与点拨，额外增益意志。 */
export interface TeaShedTale {
 id: string;
 title: string;
 line: string;
 willpowerBonus: number;
}

export interface VisitTeaShedResult {
 ok: boolean;
 reason?: string;
 rumor: TeaShedRumor;
 season: Season;
 hpGain: number;
 poisonRelief: number;
 willpowerGain: number;
 staminaCost: number;
 streak: number;
 streakBonus: number;
 tale: TeaShedTale | null;
}

/** 旧茶棚歇脚的体力消耗随季而变：身体的安坐节律与四时相应。 */
const TEA_SHED_STAMINA_COST_BY_SEASON: Record<Season, number> = {
 spring: 18, // 生发，标准
 summer: 20, // 暑热难安
 autumn: 15, // 秋高气爽，最易安坐
 winter: 16, // 冬藏深息
};

/** 各季额外清闲收益（春为基准，零加成，保持既有节奏；其余三季各得一抹季节性格调）。 */
const TEA_SHED_SEASONAL_HP_MILLI: Record<Season, number> = { spring: 0, summer: 0, autumn: 0, winter: 4 };
const TEA_SHED_SEASONAL_POISON_CAP: Record<Season, number> = { spring: 0, summer: 1, autumn: 0, winter: 0 };
const TEA_SHED_SEASONAL_WILLPOWER: Record<Season, number> = { spring: 0, summer: 0, autumn: 60, winter: 0 };

/** 茶客奇闻池：每季第 5 的倍数日（5/10/15/20/25）会偶遇一位茶客留下点拨。 */
const TEA_SHED_TALES: readonly TeaShedTale[] = [
 { id: 'tale.wandering-sword', title: '游侠赠言', line: '一位游侠临行前留下一句：守住一亩三分地，比追着天道跑更难。', willpowerBonus: 40 },
 { id: 'tale.old-farmer', title: '老农的土方', line: '邻座老农说，越是留世的人，越要把每一茬收成当最后一茬来种。', willpowerBonus: 40 },
 { id: 'tale.mortal-lantern', title: '凡人灯火', line: '茶棚外凡人灯火又亮了一盏，你忽然觉得，能护住这点光已是修行。', willpowerBonus: 50 },
 { id: 'tale.hermit-advice', title: '隐士点拨', line: '角落里一位隐士搁下茶碗：体修不走天，走的是地；地把根扎稳了，天雷也劈不动。', willpowerBonus: 50 },
 { id: 'tale.merchant-rumor', title: '行商传闻', line: '行商说起外乡阵坊的新式护田阵，你默默记下几笔，回头好改进自家田里的布法。', willpowerBonus: 40 },
 { id: 'tale.pill-reject', title: '拒丹客', line: '邻座散商说自己早年拒过一枚捷径丹：靠丹催出来的境界，雷劫来了最先散。', willpowerBonus: 40 },
 { id: 'tale.fellow-farmer', title: '同田旧识', line: '一位旧年同在凡间种地的熟人认出你，笑着说：到底还是把那把锄头攥到了飞升边上。', willpowerBonus: 50 },
 { id: 'tale.silent-watch', title: '无言守望', line: '棚角老者整夜不语，只盯着远处灵田的方向——你忽然懂了，守田守到极致，便是无言的守望。', willpowerBonus: 40 },
 { id: 'tale.greenhouse-keeper', title: '棚主旧事', line: '老棚主讲起早年在暖棚里熬过整个寒冬的事：守得住一棚苗，就守得住一整年的指望。', willpowerBonus: 50 },
 { id: 'tale.rain-blessing', title: '喜雨兆', line: '茶客说昨夜那场雨下得正是时候，是老天给留得住田的人的一点回应。', willpowerBonus: 40 },
];

/** 今日是否为茶客奇闻日：按当季第几日确定性判定，无新持久字段。 */
export function isTeaShedTaleDay(state: GameState): boolean {
 return state.seasonDay > 0 && state.seasonDay % 5 === 0;
}

/** 奇闻日返回当日茶客奇闻（按日确定性轮换），否则返回 null。 */
export function getTeaShedTale(state: GameState): TeaShedTale | null {
 if (!isTeaShedTaleDay(state)) return null;
 const index = Math.floor(Math.max(1, state.day) / 5) % TEA_SHED_TALES.length;
 return TEA_SHED_TALES[index]!;
}

const TEA_SHED_RUMORS: readonly TeaShedRumor[] = [
 {
 id: 'quiet-harvest',
 title: '茶火慢熬',
 lines: ['棚里老火煨着药茶。', '散修说留世之后，守得住一季收成，也是与天争回来的日子。'],
 },
 {
 id: 'ward-boundary',
 title: '守境余谈',
 lines: ['来客提起村镇外新补的护田阵。', '你若肯留下，拳脚不必离地，也能替人间挡住一截风雨。'],
 },
 {
 id: 'vein-weather',
 title: '残脉风向',
 lines: ['茶棚窗边挂着残脉风铃。', '驳杂灵气最怕硬顶，先借阵势，再近身破局，体修才能走得更长。'],
 },
 {
 id: 'mortal-dawn',
 title: '凡人灯火',
 lines: ['夜里村灯连成细线。', '飞不飞升是一回事，能不能让凡人的灯火稳稳亮着，是另一回事。'],
 },
 {
 id: 'array-maintenance',
 title: '护阵余话',
 lines: ['茶客说起自家护田阵总在雷季后松一处。', '阵这东西，补得勤比布得大更顶用——和种田一个理。'],
 },
 {
 id: 'off-season-tea',
 title: '反季灵茶',
 lines: ['棚里烘着反季才有的半两茶尖。', '留世的人不赶时令，反倒能把时令里最细的那一茬留下来。'],
 },
 {
 id: 'mortal-craft',
 title: '凡人手艺',
 lines: ['棚外有凡匠在修整晒架。', '你说不清是修仙修到了这份从容，还是种田种回了这份手艺。'],
 },
];

export function teaShedVisitFlag(day: number): string {
 return `tea-shed-visit.${day}`;
}

/**
  * 连续前序留世日已在旧茶棚歇脚的天数（不含今日；扫描上限 7 日，够判定常客两档奖励）。
  * 由 flags 派生，不引入新持久字段（旧档自动兼容）。design spec P2 茶棚/闲居支线。
 */
export function teaShedVisitStreak(state: GameState): number {
 let prior = 0;
 for (let day = state.day - 1; day >= 1 && prior < 7; day -= 1) {
 if (state.flags.has(teaShedVisitFlag(day))) prior += 1;
 else break;
 }
 return prior;
}

/** 旧茶棚常客成就：首次达到 3 日连击后永久记录（一次性目标锚点）。 */
export const TEA_REGULAR_ACHIEVEMENT_FLAG = 'tea-shed-regular-achieved';

export function hasTeaShedRegularAchievement(state: GameState): boolean {
 return state.flags.has(TEA_REGULAR_ACHIEVEMENT_FLAG);
}

export function getTeaShedRumor(state: GameState): TeaShedRumor {
 const index = (state.day + state.seasonDay + state.player.stage) % TEA_SHED_RUMORS.length;
 return TEA_SHED_RUMORS[index]!;
}

export function visitTeaShed(state: GameState, ctx: SimContext): VisitTeaShedResult {
 const rumor = getTeaShedRumor(state);
 const season = state.season;
 if (state.postAscension.mode !== 'stayed-in-world') {
 return { ok: false, reason: '唯有留世后方能在旧茶棚安坐听闻', rumor, season, hpGain: 0, poisonRelief: 0, willpowerGain: 0, staminaCost: 0, streak: 0, streakBonus: 0, tale: null };
 }

const visitFlag = teaShedVisitFlag(state.day);
 if (state.flags.has(visitFlag)) {
 return { ok: false, reason: '今日已在旧茶棚歇过脚', rumor, season, hpGain: 0, poisonRelief: 0, willpowerGain: 0, staminaCost: 0, streak: 0, streakBonus: 0, tale: null };
 }

// 季节性体力消耗：身体的安坐节律随四时相应。
 const staminaCost = TEA_SHED_STAMINA_COST_BY_SEASON[season] * MILLI;
 if (state.player.stamina < staminaCost) {
 return { ok: false, reason: '体力不足', rumor, season, hpGain: 0, poisonRelief: 0, willpowerGain: 0, staminaCost, streak: 0, streakBonus: 0, tale: null };
 }

// 常客连击：连续歇脚放大意志与排毒，资深常客（≥7 日）再升一档。
 const streak = teaShedVisitStreak(state) + 1; // 今日计入
 const masterRegular = streak >= 7;
 const regular = streak >= 3;
 const streakBonus = masterRegular ? 2 : regular ? 1 : 0;

// 季节性清闲收益：春为基准（零加成，保持既有节奏），夏清暑排毒、秋凝志、冬养藏深息。
 const seasonalHp = TEA_SHED_SEASONAL_HP_MILLI[season] * MILLI;
 const seasonalPoisonCap = TEA_SHED_SEASONAL_POISON_CAP[season];
 const seasonalWillpower = TEA_SHED_SEASONAL_WILLPOWER[season];

// 歇脚事件分支：奇闻日偶遇茶客留下点拨，额外增益意志。
 // 常客在奇闻日与茶客共鸣，奇闻意志收益翻倍。
 const tale = getTeaShedTale(state);
 const baseTaleWillpower = tale?.willpowerBonus ?? 0;
 const regularTaleResonance = regular && tale != null;
 const taleWillpower = regularTaleResonance ? baseTaleWillpower * 2 : baseTaleWillpower;

state.player.stamina -= staminaCost;
 const hpGain = 8 * MILLI + seasonalHp;
 const poisonReliefCap = (ctx.params.pillPoison.restBonusMax + streakBonus + seasonalPoisonCap) * MILLI;
 const poisonRelief = Math.min(state.player.pillPoison, poisonReliefCap);
 const willpowerGain = 180 + (masterRegular ? 240 : regular ? 120 : 0) + seasonalWillpower + taleWillpower;
 state.player.hp = Math.min(state.player.maxHp, state.player.hp + hpGain);
 state.player.pillPoison = Math.max(0, state.player.pillPoison - poisonRelief);
 state.player.willpower += willpowerGain;
 state.flags.add(visitFlag);
 if (streak >= 3) state.flags.add(TEA_REGULAR_ACHIEVEMENT_FLAG);
 emit(state, 'tea-shed-visit', {
 rumorId: rumor.id,
 season,
 hpGain,
 poisonRelief,
 willpowerGain,
 staminaCost,
 streak,
 streakBonus,
 seasonalHpGain: seasonalHp,
 seasonalPoisonCapBonus: seasonalPoisonCap,
 seasonalWillpowerGain: seasonalWillpower,
 taleId: tale?.id ?? null,
 taleWillpowerGain: taleWillpower,
 regularTaleResonance,
 });

return { ok: true, rumor, season, hpGain, poisonRelief, willpowerGain, staminaCost, streak, streakBonus, tale };
}
