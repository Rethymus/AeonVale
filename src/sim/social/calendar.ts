import type { SimContext } from '@sim/world/context';
import type { GameState } from '@sim/world/state';
import type { Season } from '@sim/world/types';
import { NPC_CATALOG } from './relationships';

export type CalendarEntryKind = 'festival' | 'birthday' | 'celestial-active';

export interface CalendarEntry {
 kind: CalendarEntryKind;
 season: Season;
 day: number;
 title: string;
 id: string;
 description?: string;
 daysFromNow?: number;
}

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];

function kindRank(kind: CalendarEntryKind): number {
 if (kind === 'festival') return 0;
 if (kind === 'birthday') return 1;
 return 2;
}

function sortCalendarEntries(entries: CalendarEntry[]): CalendarEntry[] {
 return entries.sort((a, b) => {
 const dayDiff = a.day - b.day;
 if (dayDiff !== 0) return dayDiff;
 const kindDiff = kindRank(a.kind) - kindRank(b.kind);
 if (kindDiff !== 0) return kindDiff;
 return a.title.localeCompare(b.title, 'zh-CN');
 });
}

function nextSeason(season: Season): Season {
 const idx = SEASONS.indexOf(season);
 return SEASONS[(idx + 1) % SEASONS.length]!;
}

function addDays(season: Season, day: number, offset: number, daysPerSeason: number): { season: Season; day: number } {
 let currentSeason = season;
 let currentDay = day + offset;
 while (currentDay > daysPerSeason) {
 currentDay -= daysPerSeason;
 currentSeason = nextSeason(currentSeason);
 }
 return { season: currentSeason, day: currentDay };
}

export function calendarEntriesForSeason(ctx: SimContext, season: Season): CalendarEntry[] {
 const festivals: CalendarEntry[] = [...ctx.content.events.values()]
 .filter((event) => event.seasonal?.season === season)
 .map((event) => ({
 kind: 'festival',
 season,
 day: event.seasonal!.day,
 title: event.displayName,
 id: event.id,
 description: event.desc,
 }));

const birthdays: CalendarEntry[] = NPC_CATALOG
 .filter((npc) => npc.birthday.season === season)
 .map((npc) => ({
 kind: 'birthday',
 season,
 day: npc.birthday.day,
 title: `${npc.displayName}生辰`,
 id: npc.id,
 description: npc.role,
 }));

return sortCalendarEntries([...festivals, ...birthdays]);
}

export function calendarEntriesForDay(state: GameState, ctx: SimContext): CalendarEntry[] {
 const entries = calendarEntriesForSeason(ctx, state.season).filter((entry) => entry.day === state.seasonDay);
 const active = state.activeEvent;
 if (active && !entries.some((entry) => entry.id === active.defId)) {
 entries.push({
 kind: 'celestial-active',
 season: state.season,
 day: state.seasonDay,
 title: active.displayName,
 id: active.defId,
 description: `剩余${active.daysLeft}日`,
 });
 }
 return sortCalendarEntries(entries);
}

export function upcomingCalendarEntries(state: GameState, ctx: SimContext, daysAhead = 7): CalendarEntry[] {
 const limit = Math.max(0, Math.floor(daysAhead));
 const entries: CalendarEntry[] = [];
 for (let offset = 0; offset <= limit; offset++) {
 const date = addDays(state.season, state.seasonDay, offset, ctx.params.time.daysPerSeason);
 for (const entry of calendarEntriesForSeason(ctx, date.season)) {
 if (entry.day === date.day) entries.push({ ...entry, daysFromNow: offset });
 }
 }
 return entries.sort((a, b) => {
 const offsetDiff = (a.daysFromNow ?? 0) - (b.daysFromNow ?? 0);
 if (offsetDiff !== 0) return offsetDiff;
 const kindDiff = kindRank(a.kind) - kindRank(b.kind);
 if (kindDiff !== 0) return kindDiff;
 return a.title.localeCompare(b.title, 'zh-CN');
 });
}
