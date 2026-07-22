import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { createCultivationRunState } from '@sim/cultivation-run/agenda';
import { deriveTribulationPreparation } from '@sim/cultivation-run/preparation';
import { DEFAULT_BALANCE } from '@sim/params';

const stateFields = fc.record({
  stage: fc.integer({ min: 0, max: 7 }),
  bodyFoundation: fc.integer({ min: 0, max: 100_000 }),
  endurance: fc.integer({ min: 0, max: 100_000 }),
  willpower: fc.integer({ min: 0, max: 100_000 }),
  pressure: fc.integer({ min: 0, max: 100 }),
  mortalHeart: fc.integer({ min: 0, max: 100 }),
  insight: fc.integer({ min: 0, max: 1000 }),
  injury: fc.integer({ min: 0, max: 100 }),
  herbs: fc.integer({ min: 0, max: 1000 }),
  pills: fc.integer({ min: 0, max: 1000 })
});

const modifierNumber = fc.oneof(
  fc.integer({ min: -1_000_000, max: 1_000_000 }),
  fc.constant(Number.NaN),
  fc.constant(Number.POSITIVE_INFINITY),
  fc.constant(Number.NEGATIVE_INFINITY)
);

const modifiers = fc.record({
  minTemperingPowerBonus: modifierNumber,
  maxSurvivablePowerBonus: modifierNumber,
  moveBudgetBonus: modifierNumber,
  previewLevelBonus: modifierNumber,
  undoChargesBonus: modifierNumber,
  wardChargesBonus: modifierNumber,
  protectedHerbCountBonus: modifierNumber,
  sourcePowerBonus: modifierNumber,
  eventPowerModifierMilli: modifierNumber
});

describe('D27-d · preparation properties', () => {
  test('PBT-D27-06：相同输入确定且不修改 run state', () => {
    fc.assert(fc.property(stateFields, fields => {
      const state = createCultivationRunState({ overrides: fields });
      const before = structuredClone(state);
      expect(deriveTribulationPreparation(state)).toEqual(deriveTribulationPreparation(state));
      expect(state).toEqual(before);
    }));
  });

  test('PBT-D27-07：安全区间与甜蜜区间始终合法嵌套', () => {
    fc.assert(fc.property(stateFields, fields => {
      const prep = deriveTribulationPreparation(createCultivationRunState({ overrides: fields }));
      expect(prep.minTemperingPower).toBeGreaterThanOrEqual(0);
      expect(prep.maxSurvivablePower).toBeGreaterThan(prep.minTemperingPower);
      expect(prep.sweetSpotMinPower).toBeGreaterThanOrEqual(prep.minTemperingPower);
      expect(prep.sweetSpotMaxPower).toBeLessThanOrEqual(prep.maxSurvivablePower);
      expect(prep.sweetSpotMaxPower).toBeGreaterThanOrEqual(prep.sweetSpotMinPower);
      expect(prep.previewLevel).toBeGreaterThanOrEqual(0);
      expect(prep.previewLevel).toBeLessThanOrEqual(3);
    }));
  });

  test('PBT-D27-08：其他条件相同时，体魄增加不会降低承雷上限', () => {
    fc.assert(fc.property(stateFields, fc.integer({ min: 0, max: 100_000 }), (fields, gain) => {
      const a = deriveTribulationPreparation(createCultivationRunState({ overrides: fields }));
      const b = deriveTribulationPreparation(createCultivationRunState({
        overrides: { ...fields, bodyFoundation: fields.bodyFoundation + gain }
      }));
      expect(b.maxSurvivablePower).toBeGreaterThanOrEqual(a.maxSurvivablePower);
    }));
  });

  test('PBT-D27-09：跨过阈值后的心压增加不会提高承雷上限', () => {
    fc.assert(fc.property(stateFields, fc.integer({ min: 80, max: 100 }), fc.integer({ min: 80, max: 100 }), (fields, p1, p2) => {
      const low = Math.min(p1, p2);
      const high = Math.max(p1, p2);
      const a = deriveTribulationPreparation(createCultivationRunState({ overrides: { ...fields, pressure: low } }));
      const b = deriveTribulationPreparation(createCultivationRunState({ overrides: { ...fields, pressure: high } }));
      expect(b.maxSurvivablePower).toBeLessThanOrEqual(a.maxSurvivablePower);
    }));
  });

  test('PBT-D27-10：基础丹药分配的总成本永不超过库存', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 10_000 }), pills => {
      const prep = deriveTribulationPreparation(createCultivationRunState({ overrides: { pills } }));
      const allocatedPills = prep.wardCharges
        + prep.undoCharges * DEFAULT_BALANCE.cultivationRun.tribulation.pillsPerUndoCharge;
      expect(allocatedPills).toBeLessThanOrEqual(pills);
    }));
  });

  test('PBT-D27-11：任意有限或非有限显式修正都只能产出有限 preparation', () => {
    fc.assert(fc.property(stateFields, modifiers, (fields, explicitModifiers) => {
      const prep = deriveTribulationPreparation(
        createCultivationRunState({ overrides: fields }),
        explicitModifiers
      );
      for (const value of [
        prep.minTemperingPower,
        prep.maxSurvivablePower,
        prep.sweetSpotMinPower,
        prep.sweetSpotMaxPower,
        prep.moveBudgetBonus,
        prep.previewLevel,
        prep.undoCharges,
        prep.wardCharges,
        prep.protectedHerbCount,
        prep.sourcePowerBonus,
        prep.eventPowerModifierMilli,
        prep.pressure,
        prep.mortalHeart
      ]) expect(Number.isFinite(value)).toBe(true);
    }));
  });
});
