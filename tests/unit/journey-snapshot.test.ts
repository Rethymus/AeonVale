/**
 * 修途旅程快照形状门 · 负向矩阵（P1）。
 *
 * isJourneySnapshot 是坏档进入 sim 状态前的最后一道门：不合格一律回落新档。
 * 本文件钉住门的**当前**契约（浅形状：version + 5 个标量 typeof + 4 个复合
 * 字段为对象）；加严属行为变更，见 journeySnapshot.ts 头注释。
 */
import { describe, expect, it } from 'vitest';

import { isJourneySnapshot } from '@app/rogueliteProto/journeySnapshot';

function snapshotWith(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    phase: 'planning',
    openingBeatIndex: 0,
    stage: 2,
    seedSalt: 42,
    generation: 1,
    state: { board: [] },
    machineState: { phase: 'planning' },
    preparation: { pills: [] },
    agendaDraft: { slots: [] },
    preparedPuzzle: null,
    tribulationSession: null,
    tribulationOutcome: null,
    agendaCycleStartIndex: 0,
    agendaTargetIndex: 1,
    pendingEpitaph: null,
    pendingLegacyCandidates: null,
    settlementApplied: false,
    lastSettlement: null,
    tribulationFeedback: null,
    agendaFeedback: '',
    agendaFeedbackTone: 'neutral',
    lastScroll: null,
    deadRun: false,
    ...overrides
  };
}

describe('journeySnapshot · 非对象与整体畸形', () => {
  it('null / undefined / 标量 → false（回落新档）', () => {
    expect(isJourneySnapshot(null)).toBe(false);
    expect(isJourneySnapshot(undefined)).toBe(false);
    expect(isJourneySnapshot(42)).toBe(false);
    expect(isJourneySnapshot('{"version":1}')).toBe(false);
    expect(isJourneySnapshot(true)).toBe(false);
  });

  it.each([2, 0, '1', null, undefined])('version=%p → false（版本漂移/缺失/字符串）', version => {
    expect(isJourneySnapshot(snapshotWith({ version }))).toBe(false);
  });
});

describe('journeySnapshot · 标量字段浅检查', () => {
  it('phase 缺失或非字符串 → false', () => {
    expect(isJourneySnapshot(snapshotWith({ phase: undefined }))).toBe(false);
    expect(isJourneySnapshot(snapshotWith({ phase: 3 }))).toBe(false);
  });

  it('phase 为未知字符串 → true（现状：只验类型不验枚举值）', () => {
    expect(isJourneySnapshot(snapshotWith({ phase: 'bogus-phase' }))).toBe(true);
  });

  it.each(['openingBeatIndex', 'stage', 'seedSalt', 'generation'])('%s 缺失或错型 → false', field => {
    expect(isJourneySnapshot(snapshotWith({ [field]: undefined }))).toBe(false);
    expect(isJourneySnapshot(snapshotWith({ [field]: '0' }))).toBe(false);
    expect(isJourneySnapshot(snapshotWith({ [field]: null }))).toBe(false);
  });

  it('seedSalt=NaN → true（现状：typeof 检查放行非有限数；NaN 入 sim 由 seed 派生侧暴露）', () => {
    expect(isJourneySnapshot(snapshotWith({ seedSalt: Number.NaN }))).toBe(true);
  });
});

describe('journeySnapshot · 四大复合字段', () => {
  it.each(['state', 'machineState', 'preparation', 'agendaDraft'])('%s 缺失/null/标量 → false', field => {
    expect(isJourneySnapshot(snapshotWith({ [field]: undefined }))).toBe(false);
    expect(isJourneySnapshot(snapshotWith({ [field]: null }))).toBe(false);
    expect(isJourneySnapshot(snapshotWith({ [field]: 'x' }))).toBe(false);
    expect(isJourneySnapshot(snapshotWith({ [field]: 0 }))).toBe(false);
  });

  it('复合字段为数组或空对象 → true（现状：typeof object 即放行，已登记边界）', () => {
    expect(isJourneySnapshot(snapshotWith({ state: [] }))).toBe(true);
    expect(isJourneySnapshot(snapshotWith({ machineState: {} }))).toBe(true);
  });
});

describe('journeySnapshot · 门的最小主义（现状契约）', () => {
  it('仅含被检查的 9 个字段 → true（其余字段缺失不拒；restore 落 undefined 由 phase 守卫兜底）', () => {
    expect(isJourneySnapshot({
      version: 1,
      phase: 'planning',
      openingBeatIndex: 0,
      stage: 0,
      seedSalt: 7,
      generation: 1,
      state: {},
      machineState: {},
      preparation: {},
      agendaDraft: {}
    })).toBe(true);
  });

  it('未知多余字段 → true（前向宽容：新版字段不会使旧档被判死档）', () => {
    expect(isJourneySnapshot(snapshotWith({ futureField: { deep: true } }))).toBe(true);
  });
});
