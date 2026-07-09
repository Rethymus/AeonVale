import { describe, it, expect } from 'vitest';
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, tileAt } from '@sim';
import { roundTripEqual, canonicalSerialize, stateHash } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';

describe('序列化与确定性 (docs/11 §3 / docs/17 §7)', () => {
  it('canonicalSerialize 与 key 顺序无关', () => {
    expect(canonicalSerialize({ a: 1, b: 2 })).toBe(canonicalSerialize({ b: 2, a: 1 }));
    expect(canonicalSerialize({ x: { y: 1 } })).toBe(canonicalSerialize({ x: { y: 1 } }));
  });

  it('空世界存档往返等价', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    expect(roundTripEqual(s)).toBe(true);
  });

  it('种田若干日后存档往返等价', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 42, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(42, reg, DEFAULT_BALANCE);
    mutateItem(state.player, 'seed.mossling', 5);
    simulateDay(state, { actions: [{ kind: 'till', at: { x: 1, y: 1 } }] }, ctx);
    simulateDay(
      state,
      {
        actions: [
          { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' },
          { kind: 'water', at: { x: 1, y: 1 } },
          { kind: 'channel-qi', at: { x: 1, y: 1 } },
        ],
      },
      ctx,
    );
    for (let i = 0; i < 10; i++) {
      simulateDay(
        state,
        { actions: [{ kind: 'water', at: { x: 1, y: 1 } }, { kind: 'channel-qi', at: { x: 1, y: 1 } }] },
        ctx,
      );
    }
    expect(roundTripEqual(state)).toBe(true);
  });

  it('同种子+同输入 ⇒ 同 stateHash（Golden Replay 基础）', () => {
    const reg = buildRegistry();
    const run = (seed: number) => {
      const state = createWorld({ seed, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
      const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
      mutateItem(state.player, 'seed.dewroot', 3);
      for (let d = 0; d < 8; d++) {
        simulateDay(
          state,
          { actions: [{ kind: 'water', at: { x: 2, y: 2 } }] },
          ctx,
        );
      }
      return stateHash(state);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });
});
