import type { CalendarEntry } from '@sim';
import { locationPreviewAssetId } from './locationPreview';

export function calendarEntryPreviewAssetId(entry: CalendarEntry | null | undefined): string | undefined {
  if (!entry) return undefined;
  if (entry.kind === 'festival') return locationPreviewAssetId('festival-ground');
  if (entry.kind !== 'birthday') return undefined;

  switch (entry.id) {
    case 'npc.wandering-cultivator':
      return locationPreviewAssetId(entry.season === 'summer' ? 'spirit-vein' : entry.season === 'winter' ? 'tea-shed' : 'valley-market');
    case 'npc.herb-gatherer':
      return locationPreviewAssetId(entry.season === 'summer' ? 'creek-field' : entry.season === 'autumn' ? 'drying-yard' : entry.season === 'winter' ? 'greenhouse' : 'herb-plot');
    case 'npc.array-smith':
      return locationPreviewAssetId(entry.season === 'summer' ? 'ore-slope' : entry.season === 'winter' ? 'ruin-gate' : 'array-shed');
    default:
      return undefined;
  }
}

export function calendarSummaryPreviewAssetId(todayEntries: readonly CalendarEntry[], upcomingEntries: readonly CalendarEntry[]): string {
  return calendarEntryPreviewAssetId(todayEntries[0] ?? upcomingEntries[0]) ?? calendarEntryPreviewAssetId(upcomingEntries[0] ?? todayEntries[0]) ?? locationPreviewAssetId('farmstead');
}
