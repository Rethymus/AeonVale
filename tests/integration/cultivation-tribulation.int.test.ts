import { describe, expect, test } from 'vitest';
import { DEFAULT_BALANCE } from '@sim/params';
import { createCultivationRunState, resolveCultivationAgenda } from '@sim/cultivation-run/agenda';
import { deriveTribulationPreparation } from '@sim/cultivation-run/preparation';
import { evaluateTribulation } from '@sim/sokoban/power';
import type { SokobanState } from '@sim/sokoban/types';

function solvedStraightBeam(): SokobanState {
  return {
    stage: 0,
    board: {
      width: 4,
      height: 1,
      terrain: ['source', 'empty', 'empty', 'body'],
      blocks: ['none', 'none', 'none', 'none'],
      sourcePos: { x: 0, y: 0 },
      sourceDir: 'right'
    },
    player: { x: 2, y: 0 },
    beam: {
      cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      reachedBody: true,
      herbsHit: []
    },
    scorched: [false, false, false, false],
    herbsTotal: 0,
    moveBudget: 10,
    movesUsed: 3,
    status: 'won'
  };
}

describe('D27-d · 日程到天劫集成', () => {
  // 教学门机制断言与源力解耦：钉回 §18 实施前的源力，防止随平衡调参漂移。
  const legacySourceParams = { ...DEFAULT_BALANCE, cultivationRun: { ...DEFAULT_BALANCE.cultivationRun, tribulation: { ...DEFAULT_BALANCE.cultivationRun.tribulation, baseSourcePower: 100 } } };
  test('同一雷路下，苦练日程把过载死亡改为可承受结果', () => {
    const initial = createCultivationRunState();
    const trained = resolveCultivationAgenda(initial, {
      slots: ['farming', 'training', 'training', 'training', 'rest', 'livelihood']
    });
    const untrained = resolveCultivationAgenda(initial, {
      slots: ['farming', 'farming', 'livelihood', 'rest', 'livelihood', 'farming']
    });
    expect(trained.ok).toBe(true);
    expect(untrained.ok).toBe(true);
    if (!trained.ok || !untrained.ok) return;

    const puzzle = solvedStraightBeam();
    const trainedPrep = deriveTribulationPreparation(trained.state, {}, legacySourceParams);
    const trainedOutcome = evaluateTribulation(puzzle, trainedPrep, legacySourceParams);
    const untrainedOutcome = evaluateTribulation(puzzle, deriveTribulationPreparation(untrained.state, {}, legacySourceParams), legacySourceParams);

    expect(trainedOutcome.beamPower).toBe(untrainedOutcome.beamPower);
    expect(deriveTribulationPreparation(trained.state).maxSurvivablePower)
      .toBeGreaterThan(deriveTribulationPreparation(untrained.state, {}, legacySourceParams).maxSurvivablePower);
    expect(untrainedOutcome.result).toBe('overload');
    expect(['perfect', 'survived']).toContain(trainedOutcome.result);
  });

  test('灵田→炼丹顺序产出的药与余草进入天劫准备', () => {
    const result = resolveCultivationAgenda(createCultivationRunState({ overrides: { stage: 1 } }), {
      slots: ['farming', 'alchemy', 'farming', 'alchemy', 'rest', 'training']
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const prep = deriveTribulationPreparation(result.state);
    expect(prep.wardCharges).toBe(2);
    expect(prep.undoCharges).toBe(0);
    expect(prep.protectedHerbCount).toBeGreaterThan(0);
  });
});
