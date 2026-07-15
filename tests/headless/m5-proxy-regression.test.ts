import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@sim';
import { M5_NORMAL_PROXY_BOT, runSimulation } from '../../tools/headless-run';

describe('M5 assisted proxy inventory regression', () => {
 it('can grant and consume ward/ascension pills without seed-slot starvation', () => {
 const outcomes = Array.from({ length: 64 }, (_, index) =>
 runSimulation(index + 1, M5_NORMAL_PROXY_BOT, DEFAULT_BALANCE, { maxDays: 2_000 }),
 );
 expect(outcomes.some((outcome) => outcome.assistance.preparationEvents > 0)).toBe(true);
 for (const outcome of outcomes.filter((item) => item.stageReached >= 7)) {
 expect(outcome.assistance.ascensionPillsGranted).toBe(1);
 expect(outcome.assistance.itemsGranted['pill.ascend']).toBe(1);
 expect(outcome.ascended).toBe(true);
 }
 });
});
