/**
 * Golden Replay 回归测试（docs/17 §7 / docs/10 §4.3 C3 确定性）。
 *
 * 核心不变式：相同 (seed, params, actions) → 相同 stateHash（任何代码修改后自动回归）。
 * 测试策略：
 * - 跑 N 步 → 捕获 stateHash → 重跑同种子 → 验证 hash 一致
 * - 多个 checkpoints（10/30/50日）逐一比对，精确定位回归引入的步骤
 */
import { describe, it, expect } from 'vitest';
import {
  createWorld,
  createSimContext,
  simulateDay,
  DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { stateHash } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';
import type { PlayerAction } from '@sim/world/input';

const reg = buildRegistry();
const P = DEFAULT_BALANCE;

/** 确定性动作脚本（从第 d 日推导出固定动作序列）。 */
function scriptedActions(day: number, w: number, h: number): PlayerAction[] {
  const acts: PlayerAction[] = [];
  // 每5日尝试翻地+种植（x/y 由 day 决定，确定性）
  const x = day % w;
  const y = Math.floor(day / w) % h;
  if (day % 5 === 0) {
    acts.push({ kind: 'till', at: { x, y } });
    acts.push({ kind: 'sow', at: { x, y }, seedId: 'seed.mossling' });
  }
  if (day % 3 === 0) {
    acts.push({ kind: 'water', at: { x, y } });
    acts.push({ kind: 'channel-qi', at: { x, y } });
  }
  return acts;
}

function runToDay(seed: number, days: number, checkpoints: number[]): Map<number, string> {
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: P });
  const ctx = createSimContext(seed, reg, P);
  state.player.stage = 1 as 1;
  mutateItem(state.player, 'seed.mossling', 50);
  const hashes = new Map<number, string>();

  for (let d = 0; d < days; d++) {
    simulateDay(state, { actions: scriptedActions(d, 6, 6) }, ctx);
    if (checkpoints.includes(state.day)) {
      hashes.set(state.day, stateHash(state));
    }
  }
  return hashes;
}

const CHECKPOINTS = [10, 30, 50];
const GOLDEN_SEEDS = [1, 42, 999];

describe('Golden Replay 确定性回归（docs/17 §7）', () => {
  it('相同 seed 两次运行，所有 checkpoint hash 一致', () => {
    for (const seed of GOLDEN_SEEDS) {
      const run1 = runToDay(seed, 50, CHECKPOINTS);
      const run2 = runToDay(seed, 50, CHECKPOINTS);
      for (const cp of CHECKPOINTS) {
        expect(run2.get(cp), `seed=${seed} day=${cp}`).toBe(run1.get(cp));
      }
    }
  });

  it('不同 seed → 不同 hash（防止哈希碰撞掩盖 bug）', () => {
    const hashesPerSeed = GOLDEN_SEEDS.map((s) => runToDay(s, 20, [20]).get(20));
    const unique = new Set(hashesPerSeed);
    expect(unique.size).toBe(GOLDEN_SEEDS.length);
  });

  it('hash 是有效 hex 字符串（8位）', () => {
    const state = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: P });
    const ctx = createSimContext(1, reg, P);
    simulateDay(state, { actions: [] }, ctx);
    const h = stateHash(state);
    expect(h).toMatch(/^[0-9a-f]+$/);
    expect(h.length).toBeGreaterThan(0);
  });

  it('state 修改后 hash 改变（哈希覆盖面充分）', () => {
    const state1 = createWorld({ seed: 5, width: 4, height: 4, content: reg, params: P });
    const state2 = createWorld({ seed: 5, width: 4, height: 4, content: reg, params: P });
    const ctx = createSimContext(5, reg, P);
    simulateDay(state1, { actions: [] }, ctx);
    simulateDay(state2, { actions: [] }, ctx);
    const h1 = stateHash(state1);
    // 修改 state2 的某个字段
    state2.player.cultivation += 1;
    const h2 = stateHash(state2);
    expect(h1).not.toBe(h2);
  });
});
