/** D27-f 六境进程：有界、单调、确定与终局稳定。 */
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { CULTIVATION_FINAL_STAGE, CULTIVATION_REALMS, nextCultivationStage, resolveCultivationProgression } from '@sim/cultivation-run';

const progressionStageArb = fc.integer({ min: 0, max: CULTIVATION_FINAL_STAGE });

describe('D27-f · 六境进程性质', () => {
  test('PBT-D27-17 下一阶段严格单调且有界，有限步内必达归一', () => {
    fc.assert(
      fc.property(progressionStageArb, startStage => {
        const visited: number[] = [];
        let stage = startStage;
        let next = nextCultivationStage(stage);
        while (next !== null) {
          expect(next).toBe(stage + 1);
          expect(next).toBeLessThanOrEqual(CULTIVATION_FINAL_STAGE);
          visited.push(next);
          stage = next;
          next = nextCultivationStage(stage);
        }

        expect(stage).toBe(CULTIVATION_FINAL_STAGE);
        expect(visited).toHaveLength(CULTIVATION_FINAL_STAGE - startStage);
        expect(CULTIVATION_REALMS).toHaveLength(CULTIVATION_FINAL_STAGE);
      })
    );
  });

  test('PBT-D27-18 相同阶段与事件结果确定；终局碑记最高阶段和结论不漂移', () => {
    fc.assert(
      fc.property(progressionStageArb, fc.constantFrom<'lifespan-exhausted' | 'tribulation-succeeded'>('lifespan-exhausted', 'tribulation-succeeded'), (stage, event) => {
        const a = resolveCultivationProgression(stage, event);
        const b = resolveCultivationProgression(stage, event);
        expect(a).toEqual(b);
        expect(a.ok).toBe(true);
        if (!a.ok) return;

        expect(a.stageAfter).toBeGreaterThanOrEqual(stage);
        expect(a.stageAfter).toBeLessThanOrEqual(CULTIVATION_FINAL_STAGE);
        if (a.terminal) {
          expect(a.stageAfter).toBe(stage);
          expect(a.epitaphData.highestStage).toBe(stage);
          expect(a.epitaphData.conclusion).toEqual(event === 'lifespan-exhausted' ? { kind: 'death', cause: 'lifespan-ended' } : { kind: 'ending', ending: 'ascended' });
        } else {
          expect(a.kind).toBe('stage-advanced');
          expect(a.stageAfter).toBe(stage + 1);
          expect(a.epitaphData).toBeNull();
        }
      })
    );
  });
});
