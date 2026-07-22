/** D27-c 残卷参悟：确定性、守恒、拓扑与有界性质。 */
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { createCultivationRunState } from '@sim/cultivation-run';
import {
  CULTIVATION_INSIGHT_EFFECT_TAGS,
  CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA,
  CULTIVATION_INSIGHT_NODES,
  unlockCultivationInsightNode,
  type CultivationInsightNodeId,
  type UnlockCultivationInsightNodeRequest
} from '@sim/cultivation-run/insight';

const CANONICAL_ORDER: readonly CultivationInsightNodeId[] = [
  'foundation-rhythm',
  'field-breathing',
  'clear-furnace-sequence',
  'thunder-guiding-stone',
  'warding-pill-formula',
  'violet-omen-rubbing',
  'ash-annotated-vow'
];

const NON_ROOT_NODES = CULTIVATION_INSIGHT_NODES.filter(node => node.prerequisiteNodeIds.length > 0);
const KNOWN_EFFECT_TAGS = new Set<string>(CULTIVATION_INSIGHT_EFFECT_TAGS);

function legalRequestArb(maxTargetIndex = CANONICAL_ORDER.length - 1): fc.Arbitrary<UnlockCultivationInsightNodeRequest> {
  return fc.integer({ min: 0, max: maxTargetIndex }).chain(targetIndex => {
    const targetNodeId = CANONICAL_ORDER[targetIndex]!;
    const target = CULTIVATION_INSIGHT_NODES.find(node => node.id === targetNodeId)!;
    return fc
      .record({
        seed: fc.integer({ min: 1, max: 999_999 }),
        agendaIndex: fc.integer({ min: 0, max: 10_000 }),
        insightSurplus: fc.integer({ min: 0, max: 10_000 }),
        pressure: fc.integer({ min: 0, max: 100 }),
        mortalHeart: fc.integer({ min: 0, max: 100 })
      })
      .map(({ seed, agendaIndex, insightSurplus, pressure, mortalHeart }) => {
        const state = createCultivationRunState({
          seed,
          overrides: { agendaIndex, insight: target.insightCost + insightSurplus, pressure, mortalHeart }
        });
        return {
          state,
          unlockedNodeIds: CANONICAL_ORDER.slice(0, targetIndex),
          targetNodeId,
          budget: {
            agendaIndex,
            unlockedThisAgenda: 0,
            maxUnlocksPerAgenda: CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA
          }
        };
      });
  });
}

function resolveLegal(request: UnlockCultivationInsightNodeRequest) {
  const result = unlockCultivationInsightNode(request);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`合法参悟失败：${result.error.code}`);
  return result;
}

describe('D27-c · 残卷参悟性质', () => {
  test('PBT-D27-06 确定性：同状态、图谱、目标与轮次预算得到相同结果', () => {
    fc.assert(
      fc.property(legalRequestArb(), request => {
        const a = unlockCultivationInsightNode(structuredClone(request));
        const b = unlockCultivationInsightNode(structuredClone(request));
        expect(a).toEqual(b);
      })
    );
  });

  test('PBT-D27-07 纯度：成功解锁不修改状态、已解锁列表或预算', () => {
    fc.assert(
      fc.property(legalRequestArb(), request => {
        const before = structuredClone(request);
        resolveLegal(request);
        expect(request).toEqual(before);
      })
    );
  });

  test('PBT-D27-08 成本守恒：悟痕只按目标成本减少且只新增目标节点', () => {
    fc.assert(
      fc.property(legalRequestArb(), request => {
        const target = CULTIVATION_INSIGHT_NODES.find(node => node.id === request.targetNodeId)!;
        const result = resolveLegal(request);

        expect(request.state.insight - result.state.insight).toBe(target.insightCost);
        expect(result.unlockedNodeIds).toEqual([...request.unlockedNodeIds, request.targetNodeId]);
        expect(result.state.insight).toBeGreaterThanOrEqual(0);
      })
    );
  });

  test('PBT-D27-09 拓扑前置：任一非根节点在没有相邻前置时都原子失败', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NON_ROOT_NODES),
        fc.integer({ min: 0, max: 10_000 }),
        (target, agendaIndex) => {
          const state = createCultivationRunState({ overrides: { agendaIndex, insight: 100 } });
          const request: UnlockCultivationInsightNodeRequest = {
            state,
            unlockedNodeIds: [],
            targetNodeId: target.id,
            budget: {
              agendaIndex,
              unlockedThisAgenda: 0,
              maxUnlocksPerAgenda: CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA
            }
          };
          const before = structuredClone(request);
          const result = unlockCultivationInsightNode(request);

          expect(result).toMatchObject({
            ok: false,
            state,
            unlockedNodeIds: [],
            error: { code: 'missing-prerequisite', missingPrerequisiteNodeIds: target.prerequisiteNodeIds }
          });
          expect(request).toEqual(before);
        }
      )
    );
  });

  test('PBT-D27-10 有界：节点、效果和每轮解锁计数始终在固定集合内', () => {
    fc.assert(
      fc.property(legalRequestArb(), request => {
        const result = resolveLegal(request);
        const nodeSet = new Set(result.unlockedNodeIds);
        const effectSet = new Set(result.effectTags);

        expect(result.unlockedNodeIds.length).toBeLessThanOrEqual(CULTIVATION_INSIGHT_NODES.length);
        expect(nodeSet.size).toBe(result.unlockedNodeIds.length);
        expect(result.effectTags.every(tag => KNOWN_EFFECT_TAGS.has(tag))).toBe(true);
        expect(effectSet.size).toBe(result.effectTags.length);
        expect(result.budget.unlockedThisAgenda).toBe(1);
        expect(result.budget.unlockedThisAgenda).toBeLessThanOrEqual(result.budget.maxUnlocksPerAgenda);
      })
    );
  });

  test('PBT-D27-11 轮次上限：使用成功返回的预算时第二次解锁必被拒绝', () => {
    fc.assert(
      fc.property(legalRequestArb(CANONICAL_ORDER.length - 2), request => {
        const first = resolveLegal(request);
        const nextTarget = CANONICAL_ORDER[first.unlockedNodeIds.length]!;
        const second = unlockCultivationInsightNode({
          state: first.state,
          unlockedNodeIds: first.unlockedNodeIds,
          targetNodeId: nextTarget,
          budget: first.budget
        });

        expect(second).toMatchObject({
          ok: false,
          state: first.state,
          unlockedNodeIds: first.unlockedNodeIds,
          error: { code: 'agenda-unlock-limit-reached' }
        });
      })
    );
  });
});
