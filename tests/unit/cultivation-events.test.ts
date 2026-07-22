import { describe, expect, test } from 'vitest';
import { createCultivationRunState } from '@sim/cultivation-run/agenda';
import {
  CULTIVATION_EVENTS,
  CULTIVATION_EVENT_TEXT_BUDGET,
  cultivationEventCandidates,
  resolveCultivationEventChoice,
  sampleCultivationEvent
} from '@sim/cultivation-run/events';

describe('D27-c · 修仙事件目录', () => {
  test('固定为 5 个人间小事、2 个天象、2 个主题对照，且每个事件恰有两个有代价选择', () => {
    expect(CULTIVATION_EVENTS).toHaveLength(9);
    expect(CULTIVATION_EVENTS.filter(event => event.category === 'mortal-life')).toHaveLength(5);
    expect(CULTIVATION_EVENTS.filter(event => event.category === 'celestial-omen')).toHaveLength(2);
    expect(CULTIVATION_EVENTS.filter(event => event.category === 'thematic-contrast')).toHaveLength(2);
    expect(new Set(CULTIVATION_EVENTS.map(event => event.id)).size).toBe(CULTIVATION_EVENTS.length);

    for (const event of CULTIVATION_EVENTS) {
      expect(event.choices).toHaveLength(2);
      expect(new Set(event.choices.map(choice => choice.id)).size).toBe(2);
      for (const choice of event.choices) {
        expect(choice.costs.length).toBeGreaterThan(0);
        expect(choice.costs.every(cost => Number.isInteger(cost.amount) && cost.amount > 0)).toBe(true);
        expect(choice.historyTags.length).toBeGreaterThan(0);
      }
    }
  });

  test('真实细节文本守预算，现代记忆只在一个事件中轻触', () => {
    const forbiddenInternetSlang = ['打工人', '内卷', '躺平', 'YYDS', '绝绝子', '666'];
    for (const event of CULTIVATION_EVENTS) {
      expect(event.title.length).toBeLessThanOrEqual(CULTIVATION_EVENT_TEXT_BUDGET.titleMaxChars);
      expect(event.detail.length).toBeGreaterThanOrEqual(CULTIVATION_EVENT_TEXT_BUDGET.detailMinChars);
      expect(event.detail.length).toBeLessThanOrEqual(CULTIVATION_EVENT_TEXT_BUDGET.detailMaxChars);
      expect(event.detailTokens.length).toBeGreaterThanOrEqual(2);
      for (const token of event.detailTokens) expect(event.detail).toContain(token);
      for (const choice of event.choices) {
        expect(choice.label.length).toBeLessThanOrEqual(CULTIVATION_EVENT_TEXT_BUDGET.choiceLabelMaxChars);
        expect(choice.detail.length).toBeLessThanOrEqual(CULTIVATION_EVENT_TEXT_BUDGET.choiceDetailMaxChars);
      }
      for (const slang of forbiddenInternetSlang) expect(`${event.title}${event.detail}`).not.toContain(slang);
    }
    expect(CULTIVATION_EVENTS.filter(event => event.modernEcho)).toHaveLength(CULTIVATION_EVENT_TEXT_BUDGET.modernEchoMaxEvents);
  });

  test('候选池按阶段开放，显式序号抽样可复现且不会退化为单一事件', () => {
    const mortal = createCultivationRunState({ seed: 20260722, overrides: { stage: 0, agendaIndex: 3 } });
    const tempered = createCultivationRunState({ seed: 20260722, overrides: { stage: 1, agendaIndex: 3 } });

    expect(cultivationEventCandidates(mortal)).toHaveLength(7);
    expect(cultivationEventCandidates(tempered)).toHaveLength(9);
    expect(cultivationEventCandidates(mortal).every(event => event.category !== 'thematic-contrast')).toBe(true);

    const first = Array.from({ length: 64 }, (_, ordinal) => sampleCultivationEvent(tempered, ordinal)?.id);
    const replay = Array.from({ length: 64 }, (_, ordinal) => sampleCultivationEvent(tempered, ordinal)?.id);
    expect(first).toEqual(replay);
    expect(new Set(first).size).toBeGreaterThan(1);
  });

  test('成功选择返回新状态，并把碑记/天劫影响留在 resolution tags', () => {
    const state = createCultivationRunState({
      seed: 31,
      overrides: { lifespanRemainingDays: 40, food: 4, herbs: 3, pressure: 20, insight: 0, daoAttention: 0 }
    });
    const before = structuredClone(state);
    const result = resolveCultivationEventChoice(state, 'purple-cloud-over-fields', 'watch-thunder-plot');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(state).toEqual(before);
    expect(result.state).not.toBe(state);
    expect(result.state.lifespanRemainingDays).toBe(39);
    expect(result.state.herbs).toBe(1);
    expect(result.state.insight).toBe(6);
    expect(result.state.daoAttention).toBe(500);
    expect(result.resolution.historyTags).toContain('kept-thunder-plot');
    expect(result.resolution.tribulationTags).toEqual(['starting-herb:thunder', 'preview-level:+1']);
    expect('history' in result.state).toBe(false);
    expect('tribulationModifiers' in result.state).toBe(false);
  });

  test('资源不足时整项失败，不会先扣除已经足够的前置成本', () => {
    const state = createCultivationRunState({
      seed: 47,
      overrides: { lifespanRemainingDays: 1, food: 5, spiritStones: 2 }
    });
    const before = structuredClone(state);

    const multiCost = resolveCultivationEventChoice(state, 'delayed-wages', 'wait-for-pay');
    expect(multiCost.ok).toBe(false);
    if (!multiCost.ok) {
      expect(multiCost.error).toMatchObject({ code: 'insufficient-resource', resource: 'lifespanRemainingDays' });
      expect(multiCost.state).toEqual(before);
    }
    expect(state).toEqual(before);

    const stones = resolveCultivationEventChoice(state, 'cracked-furnace-wall', 'hire-mender');
    expect(stones.ok).toBe(false);
    if (!stones.ok) expect(stones.error).toMatchObject({ code: 'insufficient-resource', resource: 'spiritStones' });
    expect(stones.state).toEqual(before);
    expect(state).toEqual(before);
  });

  test('主题事件在凡骨阶段不可结算，未知选择也保持失败原子性', () => {
    const mortal = createCultivationRunState({ seed: 59, overrides: { stage: 0, lifespanRemainingDays: 20 } });
    const unavailable = resolveCultivationEventChoice(mortal, 'sect-tribute-board', 'write-mortal-name');
    expect(unavailable.ok).toBe(false);
    if (!unavailable.ok) expect(unavailable.error.code).toBe('event-unavailable');
    expect(unavailable.state).toEqual(mortal);

    const tempered = createCultivationRunState({ seed: 61, overrides: { stage: 1, lifespanRemainingDays: 20 } });
    const unknown = resolveCultivationEventChoice(tempered, 'sect-tribute-board', 'not-a-choice');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('choice-not-found');
    expect(unknown.state).toEqual(tempered);
  });
});
