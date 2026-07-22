/** D27-b：两轮六格日程通过公共 @sim 入口的最小集成闭环。 */
import { describe, expect, test } from 'vitest';
import { createCultivationRunState, resolveCultivationAgenda } from '@sim';

describe('cultivation agenda · 两轮闭环', () => {
  test('生产资源→消费资源→苦练→歇息可连续推进两轮', () => {
    const initial = createCultivationRunState({ seed: 27, overrides: { stage: 2 } });
    const first = resolveCultivationAgenda(initial, {
      slots: ['farming', 'alchemy', 'livelihood', 'insight', 'training', 'rest']
    });

    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.state.agendaIndex).toBe(1);
    expect(first.state.herbs).toBeGreaterThanOrEqual(0);
    expect(first.state.spiritStones).toBeGreaterThanOrEqual(0);
    expect(first.state.pills).toBe(1);
    expect(first.state.bodyFoundation).toBeGreaterThan(0);
    expect(first.slots).toHaveLength(6);

    const second = resolveCultivationAgenda(first.state, {
      slots: ['farming', 'farming', 'alchemy', 'training', 'rest', 'insight']
    });

    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.agendaIndex).toBe(2);
    expect(second.state.lifespanRemainingDays).toBeLessThan(first.state.lifespanRemainingDays);
    expect(second.state.bodyFoundation).toBeGreaterThan(first.state.bodyFoundation);
    expect(second.state.insight).toBeGreaterThan(first.state.insight);
    expect(second.state.status).toBe('active');
  });
});
