import { describe, expect, it } from 'vitest';
import { createSimContext, createWorld, DEFAULT_BALANCE, getLocationServiceAvailability, getLocationServiceOptions, getTeaShedRumor, isTeaShedTaleDay, teaShedVisitFlag, visitTeaShed, type GameState, type SimContext } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { TEA_SHED_TALES, getTeaShedTale } from '@sim/social/teaShed';
import { buildRegistry } from '@content/registry';
import { MILLI, Season } from '@sim/world/types';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx };
}

function setupTaleDay(day: number): { state: GameState; ctx: SimContext } {
 const { state, ctx } = setup();
 state.postAscension.mode = 'stayed-in-world';
 state.day = day;
 state.seasonDay = day; // 当季第 day 日（day ≤ 28 仍在春季）
 state.player.stamina = 100 * MILLI;
 return { state, ctx };
}

describe('茶客奇闻池 完整性与轮换覆盖', () => {
 it('所有奇闻 id 唯一，且 floor(day/5)%length 轮换能在 length 日内全覆盖', () => {
 const ids = TEA_SHED_TALES.map((tale) => tale.id);
 expect(new Set(ids).size).toBe(ids.length); // 无重复 id
 const { state } = setup();
 state.postAscension.mode = 'stayed-in-world';
 const seen = new Set<string>();
 for (let i = 1; i <= TEA_SHED_TALES.length; i += 1) {
 state.day = 5 * i;
 state.seasonDay = 5; // 合法奇闻日（seasonDay % 5 === 0）
 const tale = getTeaShedTale(state);
 expect(tale).not.toBeNull();
 seen.add(tale!.id);
 }
 expect(seen.size).toBe(TEA_SHED_TALES.length); // 全覆盖
 });
});

describe('茶棚传闻池 ', () => {
 it('扩容为 7 类后，getTeaShedRumor 在两周内覆盖全部条目', () => {
 const { state } = setup();
 const seen = new Set<string>();
 for (let day = 1; day <= 14; day += 1) {
 state.day = day;
 state.seasonDay = day;
 seen.add(getTeaShedRumor(state).id);
 }
 expect(seen.size).toBe(7);
 for (const id of ['quiet-harvest', 'ward-boundary', 'vein-weather', 'mortal-dawn', 'array-maintenance', 'off-season-tea', 'mortal-craft']) {
 expect(seen.has(id)).toBe(true);
 }
 });
});

describe('旧茶棚留世循环', () => {
 it('未留世时茶棚服务关闭，留世后开放', () => {
 const { state } = setup();
 expect(getLocationServiceAvailability(state, 'tea-shed', 'tea-rest')).toEqual({ open: false, reason: '留世后开放' });
 expect(getLocationServiceOptions(state, 'tea-shed')).toEqual([]);

state.postAscension.mode = 'stayed-in-world';
 expect(getLocationServiceAvailability(state, 'tea-shed', 'tea-rest')).toEqual({ open: true, reason: null });
 expect(getLocationServiceOptions(state, 'tea-shed').map((option) => option.command)).toEqual(['show-tea-shed']);
 });

it('留世后可在旧茶棚每日歇脚一次并获得稳定收益', () => {
 const { state, ctx } = setup();
 state.postAscension.mode = 'stayed-in-world';
 state.player.hp = 70 * MILLI;
 state.player.pillPoison = 2 * MILLI;
 state.player.stamina = 100 * MILLI;

const result = visitTeaShed(state, ctx);

expect(result.ok).toBe(true);
 expect(result.hpGain).toBe(8 * MILLI);
 expect(result.poisonRelief).toBe(1 * MILLI);
 expect(result.willpowerGain).toBe(180);
 expect(state.player.hp).toBe(78 * MILLI);
 expect(state.player.pillPoison).toBe(1 * MILLI);
 expect(state.player.willpower).toBe(180);
 expect(state.player.stamina).toBe(82 * MILLI);
 expect(state.flags.has(teaShedVisitFlag(state.day))).toBe(true);
 expect(state.events.at(-1)).toMatchObject({ type: 'tea-shed-visit', payload: { rumorId: result.rumor.id, hpGain: 8 * MILLI, poisonRelief: 1 * MILLI, willpowerGain: 180 } });
 expect(roundTripEqual(state)).toBe(true);
 });

it('同日不可重复歇脚，未留世或体力不足也会拒绝', () => {
 const { state, ctx } = setup();
 const pre = visitTeaShed(state, ctx);
 expect(pre).toMatchObject({ ok: false, reason: '唯有留世后方能在旧茶棚安坐听闻' });

state.postAscension.mode = 'stayed-in-world';
 state.player.stamina = 17 * MILLI;
 const tired = visitTeaShed(state, ctx);
 expect(tired).toMatchObject({ ok: false, reason: '体力不足' });

state.player.stamina = 100 * MILLI;
 expect(visitTeaShed(state, ctx).ok).toBe(true);
 const repeat = visitTeaShed(state, ctx);
 expect(repeat).toMatchObject({ ok: false, reason: '今日已在旧茶棚歇过脚' });
 });
});

describe('旧茶棚常客连击 ', () => {
 function setupStaying(seed = 1): { state: GameState; ctx: SimContext } {
 const { state, ctx } = setup(seed);
 state.postAscension.mode = 'stayed-in-world';
 state.player.stamina = 100 * MILLI;
 state.player.pillPoison = 5 * MILLI;
 return { state, ctx };
 }

it('首次歇脚无连击加成（基准收益不变）', () => {
 const { state, ctx } = setupStaying();
 const result = visitTeaShed(state, ctx);
 expect(result.ok).toBe(true);
 expect(result.streak).toBe(1);
 expect(result.streakBonus).toBe(0);
 expect(result.willpowerGain).toBe(180);
 expect(result.poisonRelief).toBe(1 * MILLI);
 });

it('连续歇脚满 3 日形成常客，意志与排毒收益提升', () => {
 const { state, ctx } = setupStaying();
 state.flags.add(teaShedVisitFlag(1));
 state.flags.add(teaShedVisitFlag(2));
 state.day = 3;

const result = visitTeaShed(state, ctx);

expect(result.ok).toBe(true);
 expect(result.streak).toBe(3);
 expect(result.streakBonus).toBe(1);
 expect(result.willpowerGain).toBe(300); // 180 + 120
 expect(result.poisonRelief).toBe(2 * MILLI); // 常客排毒上限 +1
 });

it('连续歇脚满 7 日形成资深常客，收益再升一档', () => {
 const { state, ctx } = setupStaying();
 for (let day = 1; day <= 6; day += 1) state.flags.add(teaShedVisitFlag(day));
 state.day = 7;

const result = visitTeaShed(state, ctx);

expect(result.ok).toBe(true);
 expect(result.streak).toBe(7);
 expect(result.streakBonus).toBe(2);
 expect(result.willpowerGain).toBe(420); // 180 + 240
 expect(result.poisonRelief).toBe(3 * MILLI); // 资深常客排毒上限 +2
 });

it('中途漏歇一日会打断连击，从最近一段重新计起', () => {
 const { state, ctx } = setupStaying();
 state.flags.add(teaShedVisitFlag(1));
 // 第 2 日漏歇
 state.flags.add(teaShedVisitFlag(3));
 state.flags.add(teaShedVisitFlag(4));
 state.day = 5;

const result = visitTeaShed(state, ctx);

// 从第 4 日回扫：4✓、3✓、2✗ 断链 → 仅 2 日前序 + 今日 = 3 日常客（非资深）
 expect(result.streak).toBe(3);
 expect(result.willpowerGain).toBe(300);
 });
});

describe('旧茶棚季节性清闲收益 ', () => {
 function setupSeason(season: Season): { state: GameState; ctx: SimContext } {
 const { state, ctx } = setup();
 state.postAscension.mode = 'stayed-in-world';
 state.season = season;
 state.player.stamina = 100 * MILLI;
 state.player.hp = 50 * MILLI;
 state.player.pillPoison = 5 * MILLI;
 return { state, ctx };
 }

it('春季为基准：体力消耗 18，无季节加成（hp/排毒/意志保持基础值）', () => {
 const { state, ctx } = setupSeason('spring');
 const result = visitTeaShed(state, ctx);

expect(result.ok).toBe(true);
 expect(result.season).toBe('spring');
 expect(result.staminaCost).toBe(18 * MILLI);
 expect(result.hpGain).toBe(8 * MILLI);
 expect(result.poisonRelief).toBe(1 * MILLI); // restBonusMax=1，无季节/连击加成
 expect(result.willpowerGain).toBe(180);
 expect(state.player.stamina).toBe(82 * MILLI);
 expect(state.player.hp).toBe(58 * MILLI);
 });

it('夏季清暑：体力消耗 20，排毒上限 +1', () => {
 const { state, ctx } = setupSeason('summer');
 const result = visitTeaShed(state, ctx);

expect(result.season).toBe('summer');
 expect(result.staminaCost).toBe(20 * MILLI);
 expect(result.poisonRelief).toBe(2 * MILLI); // restBonusMax 1 + 季节 1
 expect(state.player.stamina).toBe(80 * MILLI);
 expect(state.player.pillPoison).toBe(3 * MILLI); // 5 - 2
 });

it('秋季凝志：体力消耗 15，额外意志 +60', () => {
 const { state, ctx } = setupSeason('autumn');
 const result = visitTeaShed(state, ctx);

expect(result.season).toBe('autumn');
 expect(result.staminaCost).toBe(15 * MILLI);
 expect(result.willpowerGain).toBe(240); // 180 + 60
 expect(state.player.stamina).toBe(85 * MILLI);
 });

it('冬季养藏：体力消耗 16，额外回血 +4', () => {
 const { state, ctx } = setupSeason('winter');
 const result = visitTeaShed(state, ctx);

expect(result.season).toBe('winter');
 expect(result.staminaCost).toBe(16 * MILLI);
 expect(result.hpGain).toBe(12 * MILLI); // 8 + 4
 expect(state.player.hp).toBe(62 * MILLI); // 50 + 12
 expect(state.player.stamina).toBe(84 * MILLI);
 });

it('夏季体力门槛更高（消耗 20），秋季更低（消耗 15）', () => {
 const summer = setupSeason('summer');
 summer.state.player.stamina = 19 * MILLI;
 expect(visitTeaShed(summer.state, summer.ctx)).toMatchObject({ ok: false, reason: '体力不足' });

const autumn = setupSeason('autumn');
 autumn.state.player.stamina = 15 * MILLI; // 秋季消耗 15，刚好够
 expect(visitTeaShed(autumn.state, autumn.ctx).ok).toBe(true);
 });

it('冬季歇脚后存档往返一致', () => {
 const { state, ctx } = setupSeason('winter');
 visitTeaShed(state, ctx);
 expect(roundTripEqual(state)).toBe(true);
 });
});

describe('旧茶棚歇脚事件分支 ', () => {
it('每季第 5 的倍数日为奇闻日（5/10/15/20/25）', () => {
 const { state } = setupTaleDay(5);
 expect(isTeaShedTaleDay(state)).toBe(true);
 state.seasonDay = 6;
 expect(isTeaShedTaleDay(state)).toBe(false);
 state.seasonDay = 25;
 expect(isTeaShedTaleDay(state)).toBe(true);
 });

it('奇闻日歇脚偶遇茶客点拨，额外增益意志', () => {
 const { state, ctx } = setupTaleDay(5); // floor(5/5)=1 %3 =1 → tale.old-farmer
 const result = visitTeaShed(state, ctx);

expect(result.ok).toBe(true);
 expect(result.tale).not.toBeNull;
 expect(result.tale?.id).toBe('tale.old-farmer');
 expect(result.willpowerGain).toBe(220); // 180 春季基准 + 40 奇闻
 expect(state.player.willpower).toBe(220);
 expect(state.events.at(-1)).toMatchObject({ type: 'tea-shed-visit', payload: { taleId: 'tale.old-farmer', taleWillpowerGain: 40 } });
 });

it('非奇闻日歇脚不触发茶客奇闻（tale 为 null，意志保持基准）', () => {
 const { state, ctx } = setupTaleDay(6);
 const result = visitTeaShed(state, ctx);

expect(isTeaShedTaleDay(state)).toBe(false);
 expect(result.tale).toBeNull;
 expect(result.willpowerGain).toBe(180); // 春季基准，无奇闻
 });

it('奇闻日确定性轮换到不同茶客奇闻', () => {
 const { state, ctx } = setupTaleDay(10); // floor(10/5)=2 %5 =2 → tale.mortal-lantern (50)
 const result = visitTeaShed(state, ctx);

expect(result.tale?.id).toBe('tale.mortal-lantern');
 expect(result.willpowerGain).toBe(230); // 180 + 50
 });

it('奇闻池扩容为 5 类后，第 15、20 日落到新增茶客奇闻', () => {
 const day15 = setupTaleDay(15); // floor(15/5)=3 %5 =3 → tale.hermit-advice (50)
 const r15 = visitTeaShed(day15.state, day15.ctx);
 expect(r15.tale?.id).toBe('tale.hermit-advice');
 expect(r15.willpowerGain).toBe(230); // 180 + 50

const day20 = setupTaleDay(20); // floor(20/5)=4 %5 =4 → tale.merchant-rumor (40)
 const r20 = visitTeaShed(day20.state, day20.ctx);
 expect(r20.tale?.id).toBe('tale.merchant-rumor');
 expect(r20.willpowerGain).toBe(220); // 180 + 40
 });

it('奇闻池扩容为 8 类后，第 25 日落到新增茶客奇闻', () => {
 const day25 = setupTaleDay(25); // floor(25/5)=5 %8 =5 → tale.pill-reject (40)
 const r25 = visitTeaShed(day25.state, day25.ctx);
 expect(r25.tale?.id).toBe('tale.pill-reject');
 expect(r25.willpowerGain).toBe(220); // 180 + 40
 });

it('常客在奇闻日与茶客共鸣，奇闻意志收益翻倍', () => {
 const { state, ctx } = setupTaleDay(5); // seasonDay 5 → 奇闻日，tale.old-farmer (40)
 // 连续前 3 日已歇脚 → streak 4（今日计入），形成常客
 state.flags.add(teaShedVisitFlag(2));
 state.flags.add(teaShedVisitFlag(3));
 state.flags.add(teaShedVisitFlag(4));

const result = visitTeaShed(state, ctx);

expect(result.streak).toBe(4);
 expect(result.tale?.id).toBe('tale.old-farmer');
 expect(result.willpowerGain).toBe(380); // 180 基准 + 120 常客 + 80 共鸣(40×2)
 expect(state.events.at(-1)).toMatchObject({
 type: 'tea-shed-visit',
 payload: { taleId: 'tale.old-farmer', taleWillpowerGain: 80, regularTaleResonance: true },
 });
 });

it('奇闻日歇脚后存档往返一致', () => {
 const { state, ctx } = setupTaleDay(15);
 visitTeaShed(state, ctx);
 expect(roundTripEqual(state)).toBe(true);
 });
});

describe('茶客奇闻池扩展到 10 ', () => {
 it('新增茶客奇闻 greenhouse-keeper 在第 40 日出现（floor(40/5)=8 %10）', () => {
 const { state, ctx } = setup();
 state.postAscension.mode = 'stayed-in-world';
 state.day = 40;
 state.seasonDay = 40; // %5==0 → 奇闻日
 state.player.stamina = 100 * MILLI;
 const result = visitTeaShed(state, ctx);
 expect(result.tale?.id).toBe('tale.greenhouse-keeper');
 expect(result.willpowerGain).toBe(230); // 180 + 50
 });
});
