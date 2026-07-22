/**
 * R4-a 雷劫炼体 roguelite —— 劈雷时刻表性质测试（fast-check）。
 * 守确定性红线：任意合法 stage/seed 组合都满足结构不变量。
 */
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_BALANCE } from '@sim/params';
import { deriveStreams } from '@sim/world/rng';
import {
  COMBAT_FIELD_HEIGHT,
  COMBAT_FIELD_WIDTH,
  createCombatRun,
  stageBoltCount
} from '@sim/roguelite';

describe('roguelite schedule · properties', () => {
  test('任意 stage/seed：雷数正确、落点在界内、landAfterSec 为正', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 1, max: 999_999 }), (stage, seed) => {
        const run = createCombatRun({ stage, params: DEFAULT_BALANCE, streams: deriveStreams(seed) });
        expect(run.schedule.bolts.length).toBe(stageBoltCount(stage));
        for (const b of run.schedule.bolts) {
          expect(b.target.x).toBeGreaterThanOrEqual(0);
          expect(b.target.x).toBeLessThan(COMBAT_FIELD_WIDTH);
          expect(b.target.y).toBeGreaterThanOrEqual(0);
          expect(b.target.y).toBeLessThan(COMBAT_FIELD_HEIGHT);
          expect(b.landAfterSec).toBeGreaterThan(0);
        }
      })
    );
  });

  test('确定性：同 stage+seed ⇒ 同一 field 土壤表 + 同一时刻表', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 1, max: 999_999 }), (stage, seed) => {
        const a = createCombatRun({ stage, params: DEFAULT_BALANCE, streams: deriveStreams(seed) });
        const b = createCombatRun({ stage, params: DEFAULT_BALANCE, streams: deriveStreams(seed) });
        expect(JSON.stringify(a.schedule.bolts)).toBe(JSON.stringify(b.schedule.bolts));
        expect(JSON.stringify(a.field.tiles.map(t => t.soilType))).toBe(JSON.stringify(b.field.tiles.map(t => t.soilType)));
      })
    );
  });
});
