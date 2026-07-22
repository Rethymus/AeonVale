import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { createCultivationRunState, deriveTribulationPreparation } from '@sim/cultivation-run';
import { createPuzzle } from '@sim/sokoban/logic';
import { applyPreparationToPuzzle } from '@sim/sokoban/prepared-board';
import { isSolvable } from '@sim/sokoban/generator';
import type { BlockKind } from '@sim/sokoban/types';

const blockKinds: Exclude<BlockKind, 'none'>[] = ['mirror', 'conductor', 'insulator'];

describe('D27-d · 准备棋盘性质', () => {
  test('PBT-D27-15 同输入确定、输入不变，且所有落位后的棋盘仍可解且初始未解', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 5 }),
      fc.integer({ min: 0, max: 50 }),
      fc.integer({ min: 0, max: 3 }),
      fc.subarray(blockKinds),
      fc.boolean(),
      (stage, seed, herbs, unlockedBlockKinds, eventHerb) => {
        const base = createPuzzle(stage, seed);
        const preparation = deriveTribulationPreparation(
          createCultivationRunState({ overrides: { stage, herbs } }),
          { unlockedBlockKinds }
        );
        const tags = eventHerb ? ['starting-herb:thunder'] as const : [];
        const baseBefore = structuredClone(base);
        const preparationBefore = structuredClone(preparation);

        const a = applyPreparationToPuzzle(base, preparation, tags);
        const b = applyPreparationToPuzzle(base, preparation, tags);

        expect(a).toEqual(b);
        expect(base).toEqual(baseBefore);
        expect(preparation).toEqual(preparationBefore);
        expect(isSolvable(a.state.board, a.state.player)).toBe(true);
        expect(a.state.beam.reachedBody).toBe(false);
        expect(new Set(a.preparedHerbIndices).size).toBe(a.preparedHerbIndices.length);
        expect(new Set([...a.inventoryHerbIndices, ...a.eventHerbIndices])).toEqual(
          new Set(a.preparedHerbIndices)
        );
        expect(a.inventoryHerbIndices.length).toBeLessThanOrEqual(preparation.protectedHerbCount);
        expect(a.eventHerbIndices.length).toBeLessThanOrEqual(eventHerb ? 1 : 0);
        expect(a.state.herbsTotal).toBe(base.herbsTotal + a.preparedHerbIndices.length);
        expect(a.preparedHerbIndices.length).toBeLessThanOrEqual(
          preparation.protectedHerbCount + (eventHerb ? 1 : 0)
        );
        for (const index of a.preparedHerbIndices) {
          expect(a.state.board.terrain[index]).toBe('herb');
          expect(a.state.scorched[index]).toBe(false);
        }
        if (eventHerb) {
          const handledCount = Number(a.appliedBoardModifierTags.includes('starting-herb:thunder'))
            + Number(a.ignoredBoardModifierTags.includes('starting-herb:thunder'));
          expect(handledCount).toBe(1);
        }
      }
    ), { numRuns: 40 });
  });
});
