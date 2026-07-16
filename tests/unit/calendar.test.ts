import { describe, expect, it } from 'vitest';
import { calendarEntriesForDay, calendarEntriesForSeason, createSimContext, createWorld, DEFAULT_BALANCE, upcomingCalendarEntries, type GameState, type SimContext } from '@sim';
import { buildRegistry } from '@content/registry';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx };
}

describe('日历节奏', () => {
 it('按季节列出内容表节日和 NPC 生辰，并按日期排序', () => {
 const { ctx } = setup();
 expect(calendarEntriesForSeason(ctx, 'spring').map((entry) => `${entry.day}:${entry.title}`)).toEqual([
 '14:灵芽节',
 '18:游方散修生辰',
 ]);
 expect(calendarEntriesForSeason(ctx, 'summer').map((entry) => `${entry.day}:${entry.title}`)).toContain('8:采药女生辰');
 });

it('查询当日节日和生辰', () => {
 const { state, ctx } = setup();
 state.season = 'spring';
 state.seasonDay = 14;
 expect(calendarEntriesForDay(state, ctx).map((entry) => entry.id)).toEqual(['event.spring-festival']);

state.season = 'autumn';
 state.seasonDay = 22;
 expect(calendarEntriesForDay(state, ctx).map((entry) => entry.title)).toEqual(['阵匠老陆生辰']);
 });

it('当日天象未在日历中重复出现时追加为活跃事项', () => {
 const { state, ctx } = setup();
 state.season = 'spring';
 state.seasonDay = 2;
 state.activeEvent = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 3, growthMod: 1.5, qiMod: 1.5 };
 expect(calendarEntriesForDay(state, ctx)).toMatchObject([
 { kind: 'celestial-active', id: 'event.qi-tide', title: '灵气潮汐', description: '剩余3日' },
 ]);
 });

it('未来事项可跨季节环绕并保留距今天数', () => {
 const { state, ctx } = setup();
 state.season = 'spring';
 state.seasonDay = 26;
 const entries = upcomingCalendarEntries(state, ctx, 12);
 expect(entries.map((entry) => `${entry.daysFromNow}:${entry.title}`)).toContain('10:采药女生辰');
 });

it('同日事项按节日优先生辰排序', () => {
 const { state, ctx } = setup();
 state.season = 'spring';
 state.seasonDay = 14;
 const entries = upcomingCalendarEntries(state, ctx, 4);
 expect(entries.map((entry) => entry.title)).toEqual(['灵芽节', '游方散修生辰']);
 });
});
