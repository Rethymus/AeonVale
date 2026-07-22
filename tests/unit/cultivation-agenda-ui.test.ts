import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@sim/params';
import { createCultivationRunState } from '@sim/cultivation-run';
import {
  assignCultivationActivity,
  clearSelectedCultivationActivity,
  createCultivationAgendaDraft,
  cultivationAvailableActivityPresentations,
  cultivationActivityPresentations,
  cultivationAgendaErrorMessage,
  cultivationAgendaEstimatedDays,
  cultivationRunStats,
  filledCultivationAgendaSlots,
  selectCultivationAgendaSlot,
  toCultivationAgenda
} from '@app/cultivationRun/presenter';

describe('修仙修途 presenter', () => {
  it('提供十类递进修途的中文标签、快捷键、境界门槛、耗时与收益摘要', () => {
    const activities = cultivationActivityPresentations();

    expect(activities.map(activity => activity.id)).toEqual([
      'training',
      'farming',
      'livelihood',
      'rest',
      'alchemy',
      'insight',
      'meridian',
      'arrayStudy',
      'lightningBath',
      'heavenTheft'
    ]);
    expect(activities.map(activity => activity.label)).toEqual(['苦练', '灵田', '谋生', '歇息', '炼丹', '参悟', '通脉', '演阵', '纳雷', '截天']);
    expect(activities.map(activity => activity.shortcut)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    expect(activities.map(activity => activity.unlockStage)).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5, 6]);
    expect(Array.from({ length: 7 }, (_, stage) => cultivationAvailableActivityPresentations(stage).length)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    expect(activities.every(activity => activity.timeCostDays > 0 && activity.summary.length > 0)).toBe(true);
  });

  it('写入活动后自动前进到下一空格，也允许选中、替换和清除', () => {
    let draft = createCultivationAgendaDraft();
    draft = assignCultivationActivity(draft, 'farming');
    expect(draft.slots[0]).toBe('farming');
    expect(draft.selectedSlot).toBe(1);

    draft = selectCultivationAgendaSlot(draft, 0);
    draft = assignCultivationActivity(draft, 'training');
    expect(draft.slots[0]).toBe('training');
    expect(draft.selectedSlot).toBe(1);

    draft = clearSelectedCultivationActivity(draft);
    expect(draft.slots[1]).toBeNull();
    expect(filledCultivationAgendaSlots(draft)).toBe(1);
  });

  it.each([0, -1, -99, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    '非法格数 %s 回退为默认六格',
    slotCount => {
      const draft = createCultivationAgendaDraft(slotCount);
      expect(draft.slots).toEqual([null, null, null, null, null, null]);
      expect(draft.selectedSlot).toBe(0);
    }
  );

  it('空 slots 与非有限/小数索引始终归一为安全位置', () => {
    const empty = { slots: [] as const, selectedSlot: Number.NaN };
    expect(selectCultivationAgendaSlot(empty, Number.NaN)).toEqual({ slots: [], selectedSlot: 0 });
    expect(selectCultivationAgendaSlot(empty, Number.POSITIVE_INFINITY)).toEqual({ slots: [], selectedSlot: 0 });

    const draft = createCultivationAgendaDraft();
    expect(selectCultivationAgendaSlot(draft, Number.NaN).selectedSlot).toBe(0);
    expect(selectCultivationAgendaSlot(draft, Number.POSITIVE_INFINITY).selectedSlot).toBe(0);
    expect(selectCultivationAgendaSlot(draft, 2.9).selectedSlot).toBe(2);
    expect(selectCultivationAgendaSlot(draft, -3.2).selectedSlot).toBe(0);
  });

  it('异常 draft 的写入与清除不崩溃、不修改输入且返回新数组', () => {
    const sourceSlots = Object.freeze([null, 'farming', null] as const);
    const malformed = Object.freeze({ slots: sourceSlots, selectedSlot: Number.NaN });
    const assigned = assignCultivationActivity(malformed, 'training');
    const cleared = clearSelectedCultivationActivity(Object.freeze({ slots: sourceSlots, selectedSlot: Number.POSITIVE_INFINITY }));

    expect(assigned).toEqual({ slots: ['training', 'farming', null], selectedSlot: 2 });
    expect(cleared).toEqual({ slots: [null, 'farming', null], selectedSlot: 0 });
    expect(assigned.slots).not.toBe(sourceSlots);
    expect(cleared.slots).not.toBe(sourceSlots);
    expect(sourceSlots).toEqual([null, 'farming', null]);

    const empty = Object.freeze({ slots: Object.freeze([]) as readonly null[], selectedSlot: -1 });
    expect(assignCultivationActivity(empty, 'rest')).toEqual({ slots: [], selectedSlot: 0 });
    expect(clearSelectedCultivationActivity(empty)).toEqual({ slots: [], selectedSlot: 0 });
    expect(toCultivationAgenda(empty)).toBeNull();
  });

  it('只在六格排满后生成 sim agenda，并累计预计耗时', () => {
    let draft = createCultivationAgendaDraft();
    for (const activity of ['farming', 'alchemy', 'livelihood', 'insight', 'training', 'rest'] as const) {
      draft = assignCultivationActivity(draft, activity);
    }

    expect(filledCultivationAgendaSlots(draft)).toBe(6);
    expect(cultivationAgendaEstimatedDays(draft)).toBe(
      (['farming', 'alchemy', 'livelihood', 'insight', 'training', 'rest'] as const)
        .reduce((days, activity) => days + DEFAULT_BALANCE.cultivationRun.activities[activity].timeCostDays, 0)
    );
    expect(toCultivationAgenda(draft)?.slots).toEqual(['farming', 'alchemy', 'livelihood', 'insight', 'training', 'rest']);
    expect(toCultivationAgenda(createCultivationAgendaDraft())).toBeNull();
  });

  it('把 sim 失败翻译成带格位与修复方向的中文信息', () => {
    expect(
      cultivationAgendaErrorMessage({ code: 'insufficient-herbs', slotIndex: 2, activity: 'alchemy' })
    ).toBe('第 3 格「炼丹」缺少灵草。请把「灵田」排到它前面，或换成其他活动。');
    expect(
      cultivationAgendaErrorMessage({ code: 'insufficient-spirit-stones', slotIndex: 0, activity: 'insight' })
    ).toContain('把「谋生」排到它前面');
    expect(cultivationAgendaErrorMessage({ code: 'insufficient-lifespan', slotIndex: 5, activity: 'rest' })).toContain(
      '换成耗时更短的活动'
    );
  });

  it('把两轮进度与六项关键资源整理为稳定统计', () => {
    const state = createCultivationRunState({ overrides: { agendaIndex: 1, pressure: 68, herbs: 3, spiritStones: 5 } });

    expect(cultivationRunStats(state)).toEqual([
      { label: '轮次', value: '2/2' },
      { label: '余寿', value: '840 日' },
      { label: '心压', value: '68/100' },
      { label: '凡心', value: '50/100' },
      { label: '食物', value: '4' },
      { label: '灵草', value: '3' },
      { label: '灵石', value: '5' }
    ]);
  });

  it('跨阶后可用 agenda offset 重新从第一轮显示', () => {
    const state = createCultivationRunState({ overrides: { agendaIndex: 2, stage: 1 } });
    expect(cultivationRunStats(state, 2, 2)[0]).toEqual({ label: '轮次', value: '1/2' });
  });
});
