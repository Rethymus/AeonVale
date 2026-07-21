/**
 * 灵韵叙录 · firstPersonView 纯函数状态机测试（docs/22 §7 / docs/23 §0·§7）。
 *
 * 红线对齐：
 *  - 只 import `@app/firstPersonView` + `@app/narrationTypes`（纯数据契约），**零 `src/sim/` 依赖**。
 *  - 覆盖 docs/23 §7 要求的 fast-check 属性（applyEffects 后状态合法/有界）+ judgeEnding 阈值矩阵
 *    路由 + nextState 推进（goto/ends/once/requires）+ bucket/deriveLayerKeys 边界。
 *  - 无桩、无 skip、无空断言。
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  applyEffects,
  bucket,
  checkRequires,
  deriveHeartPulse,
  deriveLayerKeys,
  enterScene,
  initialState,
  isChoiceAvailable,
  judgeEnding,
  judgeFailState,
  markEnding,
  nextState,
  onceFlag
} from '@app/firstPersonView';
import { NARRATION_SCENES_BY_ID } from '@app/narrationScenes';
import {
  BOND_THRESHOLD,
  CULT_PROGRESSION_MAX,
  DEFIANCE_THRESHOLD,
  LIFESPAN_MAX,
  TRIBULATION_STAGE_THRESHOLD,
  type Effect,
  type EndingId,
  type NarrationScene,
  type NarrationState
} from '@app/narrationTypes';

// —— 辅助构造 ——

function withState(overrides: Partial<NarrationState>): NarrationState {
  return { ...initialState(), ...overrides };
}

function scene(partial: Partial<NarrationScene> & Pick<NarrationScene, 'id'>): NarrationScene {
  return {
    act: 'prologue',
    lines: [{ text: '旁白' }],
    status: 'approved',
    ...partial
  } as NarrationScene;
}

const NUMERIC_KEYS = [
  'cultProgress',
  'pillPoison',
  'madness',
  'lifespan',
  'tribGrip',
  'defiance',
  'bond',
  'shennongLore'
] as const;

/** 断言全部数值状态落在 docs/22 §5 合法区间（与 firstPersonView.STAT_BOUNDS 一致）。 */
function assertAllBounded(s: NarrationState): void {
  expect(s.cultProgress).toBeGreaterThanOrEqual(0);
  expect(s.cultProgress).toBeLessThanOrEqual(CULT_PROGRESSION_MAX);
  expect(s.pillPoison).toBeGreaterThanOrEqual(0);
  expect(s.pillPoison).toBeLessThanOrEqual(100);
  expect(s.madness).toBeGreaterThanOrEqual(0);
  expect(s.madness).toBeLessThanOrEqual(100);
  expect(s.lifespan).toBeGreaterThanOrEqual(0);
  expect(s.lifespan).toBeLessThanOrEqual(LIFESPAN_MAX);
  expect(s.tribGrip).toBeGreaterThanOrEqual(-100);
  expect(s.tribGrip).toBeLessThanOrEqual(100);
  expect(s.defiance).toBeGreaterThanOrEqual(0);
  expect(s.defiance).toBeLessThanOrEqual(100);
  expect(s.bond).toBeGreaterThanOrEqual(0);
  expect(s.bond).toBeLessThanOrEqual(100);
  expect(s.shennongLore).toBeGreaterThanOrEqual(0);
  expect(s.shennongLore).toBeLessThanOrEqual(100);
}

// ── initialState · 基线 ──────────────────────────────────────────────────────

describe('firstPersonView · initialState', () => {
  it('初值全在合法区间且 currentSceneId 为空', () => {
    const s = initialState();
    assertAllBounded(s);
    expect(s.cultProgress).toBe(0);
    expect(s.pillPoison).toBe(0);
    expect(s.madness).toBe(0);
    expect(s.lifespan).toBe(LIFESPAN_MAX);
    expect(s.tribGrip).toBe(0);
    expect(s.defiance).toBe(0);
    expect(s.bond).toBe(0);
    expect(s.shennongLore).toBe(0);
    expect(s.currentSceneId).toBeNull();
    expect(s.flags.size).toBe(0);
    expect(s.seenScenes.size).toBe(0);
    expect(s.introRead).toBe(false);
  });
});

// ── applyEffects · 有界属性（fast-check，docs/23 §7） ─────────────────────────

describe('firstPersonView · applyEffects 有界（fast-check 属性）', () => {
  const numericKeyArb = fc.constantFrom(...NUMERIC_KEYS);

  const setAddArb = fc.oneof(
    fc.record({ kind: fc.constant('set' as const), target: numericKeyArb, value: fc.integer({ min: -2000, max: 2000 }) }),
    fc.record({ kind: fc.constant('add' as const), target: numericKeyArb, value: fc.integer({ min: -2000, max: 2000 }) })
  );
  const flagArb = fc.record({
    kind: fc.constant('flag' as const),
    target: fc.string({ minLength: 1, maxLength: 12 }).map(s => `flag-${s}`)
  });
  const unflagArb = fc.record({
    kind: fc.constant('unflag' as const),
    target: fc.string({ minLength: 1, maxLength: 12 }).map(s => `flag-${s}`)
  });
  const loreArb = fc.record({
    kind: fc.constant('lore' as const),
    target: fc.constant('lore'),
    value: fc.integer({ min: -100, max: 100 })
  });
  const effectArb = fc.oneof(setAddArb, flagArb, unflagArb, loreArb);
  const effectsArb = fc.array(effectArb, { minLength: 0, maxLength: 40 });

  it('任意 effects 序列应用后，全部数值状态仍落在合法区间', () => {
    fc.assert(
      fc.property(effectsArb, effects => {
        const result = applyEffects(initialState(), effects as readonly Effect[]);
        assertAllBounded(result);
      })
    );
  });

  it('set/add 对任意数值与极端输入都钳制到该状态的 [min,max]', () => {
    fc.assert(
      fc.property(numericKeyArb, fc.integer({ min: -10000, max: 10000 }), (key, value) => {
        const afterSet = applyEffects(initialState(), [{ kind: 'set', target: key, value }]);
        const afterAdd = applyEffects(initialState(), [{ kind: 'add', target: key, value }]);
        assertAllBounded(afterSet);
        assertAllBounded(afterAdd);
      })
    );
  });

  it('applyEffects 不修改入参（不可变），空 effects 原样返回', () => {
    const base = initialState();
    expect(applyEffects(base, [])).toBe(base);
    expect(applyEffects(base, undefined)).toBe(base);
    const before = { ...base, flags: new Set(base.flags) };
    applyEffects(base, [{ kind: 'add', target: 'defiance', value: 30 }]);
    expect(base.defiance).toBe(before.defiance);
    expect(base.flags).toEqual(before.flags);
  });

  it('lore 等价于对 shennongLore 做 add（默认 +1），并钳到 [0,100]', () => {
    expect(applyEffects(initialState(), [{ kind: 'lore', target: 'lore', value: 1 }]).shennongLore).toBe(1);
    expect(applyEffects(initialState(), [{ kind: 'lore', target: 'lore' }]).shennongLore).toBe(1);
    const saturated = applyEffects(withState({ shennongLore: 99 }), [{ kind: 'lore', target: 'lore', value: 50 }]);
    expect(saturated.shennongLore).toBe(100);
  });

  it('未知 target / 未知 kind 安全忽略，不抛错（内容 typo 不致运行时崩）', () => {
    const s = initialState();
    expect(() => applyEffects(s, [{ kind: 'set', target: 'nonexistent', value: 5 }])).not.toThrow();
    // 未知 kind 走 applyOne 的 default 分支，状态不变。
    expect(applyEffects(s, [{ kind: 'unknown' as Effect['kind'], target: 'defiance', value: 5 }])).toEqual(s);
  });

  it('flag/unflag 增删 flags 集合且幂等', () => {
    const a = applyEffects(initialState(), [{ kind: 'flag', target: 'met-xiao' }]);
    expect(a.flags.has('met-xiao')).toBe(true);
    const b = applyEffects(a, [{ kind: 'flag', target: 'met-xiao' }]);
    expect(b.flags.size).toBe(1);
    const c = applyEffects(b, [{ kind: 'unflag', target: 'met-xiao' }]);
    expect(c.flags.has('met-xiao')).toBe(false);
    // unflag 不存在的 flag 不报错、不改变。
    expect(applyEffects(c, [{ kind: 'unflag', target: 'met-xiao' }]).flags.has('met-xiao')).toBe(false);
  });
});

// ── judgeEnding · 失败态优先级 + 阈值矩阵（等价类，docs/22 §7） ────────────────

describe('firstPersonView · judgeEnding 阈值矩阵与优先级', () => {
  it('pillPoison≥100 → poison-death（即便其它失败态同时命中也优先）', () => {
    const s = withState({ pillPoison: 100, madness: 100, lifespan: 0, tribGrip: -50, cultProgress: CULT_PROGRESSION_MAX });
    expect(judgeEnding(s)).toBe('poison-death');
  });

  it('madness≥100（pillPoison 未满）→ madness', () => {
    const s = withState({ pillPoison: 99, madness: 100, lifespan: 0, tribGrip: -50, cultProgress: CULT_PROGRESSION_MAX });
    expect(judgeEnding(s)).toBe('madness');
  });

  it('lifespan≤0（前两项未满）→ lifespan-death', () => {
    const s = withState({ madness: 99, lifespan: 0, tribGrip: -50, cultProgress: CULT_PROGRESSION_MAX, defiance: 80 });
    expect(judgeEnding(s)).toBe('lifespan-death');
  });

  it('tribGrip<0 ∧ cultProgress≥TRIBULATION_STAGE_THRESHOLD → tribulation-death（优先于 defiance 矩阵）', () => {
    const s = withState({ lifespan: 50, tribGrip: -1, cultProgress: TRIBULATION_STAGE_THRESHOLD, defiance: 80, bond: 60 });
    expect(judgeEnding(s)).toBe('tribulation-death');
  });

  it('tribGrip<0 但 cultProgress 不足门槛 → 不触发 tribulation-death，落入 defiance 矩阵', () => {
    const s = withState({ tribGrip: -1, cultProgress: TRIBULATION_STAGE_THRESHOLD - 1, defiance: 80, bond: 60 });
    expect(judgeEnding(s)).toBe('e6-sacrifice');
  });

  it('defiance≥DEFIANCE_THRESHOLD ∧ bond≥BOND_THRESHOLD → e6-sacrifice', () => {
    const s = withState({ defiance: DEFIANCE_THRESHOLD, bond: BOND_THRESHOLD });
    expect(judgeEnding(s)).toBe('e6-sacrifice');
  });

  it('defiance≥DEFIANCE_THRESHOLD ∧ bond<BOND_THRESHOLD → e7-usurp', () => {
    const s = withState({ defiance: DEFIANCE_THRESHOLD, bond: BOND_THRESHOLD - 1 });
    expect(judgeEnding(s)).toBe('e7-usurp');
  });

  it('defiance 不足但 cultProgress 满 → ascension', () => {
    const s = withState({ defiance: DEFIANCE_THRESHOLD - 1, cultProgress: CULT_PROGRESSION_MAX });
    expect(judgeEnding(s)).toBe('ascension');
  });

  it('defiance 不足且 cultProgress 未满 → null（仍在推进）', () => {
    const s = withState({ defiance: DEFIANCE_THRESHOLD - 1, cultProgress: CULT_PROGRESSION_MAX - 1 });
    expect(judgeEnding(s)).toBeNull();
  });

  it('边界点：defiance 恰为门槛、cultProgress 恰为上限都算命中（闭区间）', () => {
    expect(judgeEnding(withState({ defiance: DEFIANCE_THRESHOLD, bond: BOND_THRESHOLD }))).toBe('e6-sacrifice');
    expect(judgeEnding(withState({ defiance: DEFIANCE_THRESHOLD - 1, cultProgress: CULT_PROGRESSION_MAX }))).toBe('ascension');
  });

  it('全 0 基线 → null', () => {
    expect(judgeEnding(initialState())).toBeNull();
  });
});

// ── judgeFailState · 失败态子集（HIGH1 配套，docs/22 §7 失败态优先） ─────────────

describe('firstPersonView · judgeFailState 失败态子集', () => {
  it('失败态命中（4 项）→ 返回对应 EndingId', () => {
    expect(judgeFailState(withState({ pillPoison: 100 }))).toBe('poison-death');
    expect(judgeFailState(withState({ madness: 100 }))).toBe('madness');
    expect(judgeFailState(withState({ lifespan: 0 }))).toBe('lifespan-death');
    expect(judgeFailState(withState({ tribGrip: -1, cultProgress: TRIBULATION_STAGE_THRESHOLD }))).toBe('tribulation-death');
  });

  it('不含终局矩阵：defiance≥门槛 / cultProgress 满 不触发（保留给 scene.ends）', () => {
    // 这是 judgeFailState 与 judgeEnding 的关键差异——避免 act3.tribulation.onEnter set cult MAX
    // 后立刻判 ascension 抢走玩家天道诘问选择。
    expect(judgeFailState(withState({ defiance: DEFIANCE_THRESHOLD, bond: BOND_THRESHOLD }))).toBeNull();
    expect(judgeFailState(withState({ defiance: DEFIANCE_THRESHOLD, bond: BOND_THRESHOLD - 1 }))).toBeNull();
    expect(judgeFailState(withState({ cultProgress: CULT_PROGRESSION_MAX }))).toBeNull();
  });

  it('失败态优先于终局矩阵（同时命中时 judgeEnding 返回失败态，与子集一致）', () => {
    const both = withState({ madness: 100, defiance: 80, cultProgress: CULT_PROGRESSION_MAX });
    expect(judgeFailState(both)).toBe('madness');
    expect(judgeEnding(both)).toBe('madness');
  });
});

// ── markEnding · seenEndings/unlockedEndings 登记（MEDIUM10 路径一致） ─────────

describe('firstPersonView · markEnding 内存登记', () => {
  it('登记一个 ending → seenEndings/unlockedEndings 都含该 id', () => {
    const s = markEnding(initialState(), 'madness');
    expect(s.seenEndings.has('madness')).toBe(true);
    expect(s.unlockedEndings.has('madness')).toBe(true);
  });

  it('幂等：重复 markEnding 同一 ending 不重复加', () => {
    const once = markEnding(initialState(), 'ascension');
    const twice = markEnding(once, 'ascension');
    expect(twice.seenEndings.size).toBe(1);
    expect(twice.unlockedEndings.size).toBe(1);
  });

  it('不可变：入参 state 不被修改', () => {
    const base = initialState();
    const before = base.seenEndings.size;
    markEnding(base, 'poison-death');
    expect(base.seenEndings.size).toBe(before);
  });
});

// ── nextState · goto/ends/once/requires 路由 ──────────────────────────────────

describe('firstPersonView · nextState 路由', () => {
  it('goto 选项：返回 nextSceneId，不触发结局，应用 effects', () => {
    const sc = scene({
      id: 'hub',
      choices: [{ id: 'go', label: '前进', goto: 'next', effects: [{ kind: 'add', target: 'defiance', value: 5 }] }]
    });
    const result = nextState(initialState(), sc, 'go');
    expect(result.nextSceneId).toBe('next');
    expect(result.ending).toBeUndefined();
    expect(result.state.defiance).toBe(5);
  });

  it('ends 选项：返回 ending，nextSceneId=null，并登记 seen/unlocked 结局', () => {
    const sc = scene({
      id: 'leaf-choice',
      choices: [{ id: 'die', label: '吞丹', ends: 'poison-death' }]
    });
    const result = nextState(initialState(), sc, 'die');
    expect(result.ending).toBe('poison-death');
    expect(result.nextSceneId).toBeNull();
    expect(result.state.seenEndings.has('poison-death')).toBe(true);
    expect(result.state.unlockedEndings.has('poison-death')).toBe(true);
  });

  it('once 选项：选中后 isChoiceAvailable 变 false（once flag 写入）', () => {
    const sc = scene({
      id: 'once-scene',
      choices: [{ id: 'once-go', label: '一次性', once: true, goto: 'next' }]
    });
    expect(isChoiceAvailable(initialState(), sc.id, sc.choices![0]!)).toBe(true);
    const result = nextState(initialState(), sc, 'once-go');
    expect(result.nextSceneId).toBe('next');
    expect(result.state.flags.has(onceFlag(sc.id, 'once-go'))).toBe(true);
    // 同一 state 下该 once 选项不再可选。
    expect(isChoiceAvailable(result.state, sc.id, sc.choices![0]!)).toBe(false);
  });

  it('requires 守卫：不满足时原样返回（nextSceneId=null、effects 不应用），且 isChoiceAvailable=false', () => {
    const sc = scene({
      id: 'gated',
      choices: [
        {
          id: 'hard',
          label: '硬撼',
          requires: 'defiance>=60',
          goto: 'next',
          effects: [{ kind: 'flag', target: 'did-hard' }]
        }
      ]
    });
    const weak = initialState(); // defiance=0
    expect(isChoiceAvailable(weak, sc.id, sc.choices![0]!)).toBe(false);
    const result = nextState(weak, sc, 'hard');
    expect(result.nextSceneId).toBeNull();
    expect(result.ending).toBeUndefined();
    expect(result.state.flags.has('did-hard')).toBe(false);

    const strong = withState({ defiance: 60 });
    expect(isChoiceAvailable(strong, sc.id, sc.choices![0]!)).toBe(true);
    const ok = nextState(strong, sc, 'hard');
    expect(ok.nextSceneId).toBe('next');
    expect(ok.state.flags.has('did-hard')).toBe(true);
  });

  it('未知 choiceId：原样返回，nextSceneId=null', () => {
    const sc = scene({ id: 'solo', choices: [{ id: 'only', label: '唯一', goto: 'next' }] });
    const result = nextState(initialState(), sc, 'does-not-exist');
    expect(result.nextSceneId).toBeNull();
    expect(result.ending).toBeUndefined();
    expect(result.state).toEqual(initialState());
  });

  it('叶节点（choice 既无 goto 又无 ends）：用 judgeEnding 兜底；无果则 nextSceneId=null', () => {
    const sc = scene({
      id: 'terminal-leaf',
      choices: [{ id: 'stop', label: '停下' }]
    });
    // 触发失败态兜底：吞丹致死的 state。
    const dying = withState({ pillPoison: 100 });
    const result = nextState(dying, sc, 'stop');
    expect(result.ending).toBe('poison-death');
    expect(result.nextSceneId).toBeNull();
    // 既无失败态又不满 cult → null ending。
    const fresh = nextState(initialState(), sc, 'stop');
    expect(fresh.ending).toBeUndefined();
    expect(fresh.nextSceneId).toBeNull();
  });

  it('HIGH1：choice 有 goto 但 effects 致失败态（madness≥100）→ ending 覆盖 goto 路由', () => {
    // 复现 docs/22 §7 失败态优先规则：choice 自带 goto 不应让玩家「穿过去」到下一场景
    // 而忽略走火入魔/丹毒/大限。 nextState 必须在应用 effects 后立即 judgeEnding。
    const sc = scene({
      id: 'hub',
      choices: [
        {
          id: 'push',
          label: '强行push',
          goto: 'next',
          effects: [{ kind: 'add', target: 'madness', value: 50 }]
        }
      ]
    });
    // 玩家已 madness=55，再加 50 → 100+，触发走火入魔。choice.goto='next' 必须被覆盖。
    const dying = withState({ madness: 55 });
    const result = nextState(dying, sc, 'push');
    expect(result.ending).toBe('madness');
    expect(result.nextSceneId).toBeNull();
    expect(result.state.madness).toBe(100);
    expect(result.state.seenEndings.has('madness')).toBe(true);
    expect(result.state.unlockedEndings.has('madness')).toBe(true);
  });

  it('HIGH1：choice 有 ends 但 effects 致更优先失败态 → 失败态覆盖 choice.ends', () => {
    // docs/22 §7：失败态优先于一切结局判定。choice.ends='lifespan-death' 但 effects 致
    // madness≥100 → 最终 ending 必须是 madness（优先级最高），而非玩家点的 lifespan-death。
    const sc = scene({
      id: 'leaf',
      choices: [
        {
          id: 'rest',
          label: '歇了',
          ends: 'lifespan-death',
          effects: [{ kind: 'add', target: 'madness', value: 100 }]
        }
      ]
    });
    const result = nextState(initialState(), sc, 'rest');
    expect(result.ending).toBe('madness');
    expect(result.nextSceneId).toBeNull();
  });

  it('HIGH1：未触发失败态时 goto 路由不受影响（回归）', () => {
    const sc = scene({
      id: 'hub',
      choices: [
        {
          id: 'walk',
          label: '走走',
          goto: 'next',
          effects: [{ kind: 'add', target: 'madness', value: 5 }]
        }
      ]
    });
    const result = nextState(withState({ madness: 10 }), sc, 'walk');
    expect(result.nextSceneId).toBe('next');
    expect(result.ending).toBeUndefined();
    expect(result.state.madness).toBe(15);
  });
});

// ── enterScene · onEnter + seenScenes + currentSceneId ─────────────────────────

describe('firstPersonView · enterScene', () => {
  it('应用 onEnter effects、记 seenScenes、设 currentSceneId', () => {
    const sc = scene({
      id: 'act1.scroll',
      onEnter: [{ kind: 'add', target: 'cultProgress', value: 1 }, { kind: 'flag', target: 'read-scroll' }]
    });
    const entered = enterScene(initialState(), sc);
    expect(entered.currentSceneId).toBe('act1.scroll');
    expect(entered.seenScenes.has('act1.scroll')).toBe(true);
    expect(entered.cultProgress).toBe(1);
    expect(entered.flags.has('read-scroll')).toBe(true);
  });

  it('重复进入同一 scene：seenScenes 幂等（不重复加）', () => {
    const sc = scene({ id: 'hub' });
    const once = enterScene(initialState(), sc);
    const twice = enterScene(once, sc);
    expect(twice.seenScenes.size).toBe(1);
  });

  it('重复进入同一 scene：onEnter 数值效果只结算一次', () => {
    const sc = scene({
      id: 'repeatable-storylet',
      onEnter: [
        { kind: 'add', target: 'bond', value: 7 },
        { kind: 'lore', target: 'lore', value: 2 }
      ]
    });
    const once = enterScene(initialState(), sc);
    const twice = enterScene(once, sc);
    expect(once.bond).toBe(7);
    expect(once.shennongLore).toBe(2);
    expect(twice.bond).toBe(7);
    expect(twice.shennongLore).toBe(2);
  });
});

// ── checkRequires · 最小表达式解析（fail-closed） ──────────────────────────────

describe('firstPersonView · checkRequires', () => {
  it('空 / 空白 → true（无守卫即放行）', () => {
    expect(checkRequires(initialState())).toBe(true);
    expect(checkRequires(initialState(), '   ')).toBe(true);
  });

  it('数值比较六种算子', () => {
    const s = withState({ defiance: 60, bond: 50, cultProgress: 3 });
    expect(checkRequires(s, 'defiance>=60')).toBe(true);
    expect(checkRequires(s, 'defiance>60')).toBe(false);
    expect(checkRequires(s, 'bond<=50')).toBe(true);
    expect(checkRequires(s, 'bond<50')).toBe(false);
    expect(checkRequires(s, 'cultProgress==3')).toBe(true);
    expect(checkRequires(s, 'cultProgress!=3')).toBe(false);
  });

  it('flag: / !flag: 存在性', () => {
    const s = applyEffects(initialState(), [{ kind: 'flag', target: 'met-xiao' }]);
    expect(checkRequires(s, 'flag:met-xiao')).toBe(true);
    expect(checkRequires(s, '!flag:met-xiao')).toBe(false);
    expect(checkRequires(s, 'flag:never-set')).toBe(false);
  });

  it('&& / || 与括号组合（终局天道诘问表达式）', () => {
    const e6 = withState({ defiance: 60, bond: 50 });
    expect(checkRequires(e6, 'defiance>=60 && bond>=50')).toBe(true);
    const e7 = withState({ defiance: 60, bond: 49 });
    expect(checkRequires(e7, 'defiance>=60 && bond<50')).toBe(true);
    expect(checkRequires(e7, '(defiance>=60 && bond<50) || flag:forced')).toBe(true);
  });

  it('解析失败 / 未知 stat → false（fail-closed：守卫不明确时隐藏选项）', () => {
    expect(checkRequires(initialState(), 'defiance>=')).toBe(false);
    expect(checkRequires(initialState(), 'unknownStat>=5')).toBe(false);
    expect(checkRequires(initialState(), 'flag:')).toBe(false);
  });
});

// ── bucket / deriveLayerKeys · 边界 ───────────────────────────────────────────

describe('firstPersonView · bucket / deriveLayerKeys', () => {
  it('bucket：low(<33) / med(<66) / high(≥66)，入参先钳到 [0,100]', () => {
    expect(bucket(-100)).toBe('low');
    expect(bucket(0)).toBe('low');
    expect(bucket(32)).toBe('low');
    expect(bucket(33)).toBe('med');
    expect(bucket(65)).toBe('med');
    expect(bucket(66)).toBe('high');
    expect(bucket(100)).toBe('high');
    expect(bucket(9999)).toBe('high');
  });

  it('deriveLayerKeys：scene 无 layerKeys → 空对象', () => {
    expect(deriveLayerKeys(initialState(), scene({ id: 'bare' }))).toEqual({});
  });

  it('deriveLayerKeys：bg/npc/tribulation 直传', () => {
    const sc = scene({ id: 'layered', layerKeys: { bg: 'cg.bg-1', npc: 'cg.npc-1', tribulation: 'cg.trib-1' } });
    expect(deriveLayerKeys(initialState(), sc)).toEqual({ bg: 'cg.bg-1', npc: 'cg.npc-1', tribulation: 'cg.trib-1' });
  });

  it("deriveLayerKeys：daoAmbience 'auto' → dao-<defyBucket>-<bondBucket>", () => {
    const sc = scene({ id: 'auto-dao', layerKeys: { daoAmbience: 'auto' } });
    expect(deriveLayerKeys(withState({ defiance: 10, bond: 10 }), sc)).toEqual({ daoAmbience: 'dao-low-low' });
    expect(deriveLayerKeys(withState({ defiance: 70, bond: 40 }), sc)).toEqual({ daoAmbience: 'dao-high-med' });
    expect(deriveLayerKeys(withState({ defiance: 50, bond: 90 }), sc)).toEqual({ daoAmbience: 'dao-med-high' });
  });

  it("deriveLayerKeys：daoAmbience 非 auto 直传（写手自填氛围键）", () => {
    const sc = scene({ id: 'fixed-dao', layerKeys: { daoAmbience: 'dao-grief' } });
    expect(deriveLayerKeys(initialState(), sc)).toEqual({ daoAmbience: 'dao-grief' });
  });
});

// ── 与真实四幕场景数据的契约一致性（防回归） ────────────────────────────────────

describe('firstPersonView · 终局节点与真实数据契约', () => {
  it('act3.tribulation 三选项的 requires 表达式可被 checkRequires 正确解析', () => {
    // 确保终局分支表达式语法稳定（若写手改写表达式，此处报警）。
    const e6State = withState({ defiance: 60, bond: 50, cultProgress: CULT_PROGRESSION_MAX });
    expect(checkRequires(e6State, 'defiance>=60 && bond>=50')).toBe(true);
    expect(checkRequires(withState({ defiance: 60, bond: 49 }), 'defiance>=60 && bond<50')).toBe(true);
    expect(checkRequires(withState({ defiance: 59 }), 'defiance<60')).toBe(true);
  });

  it('终局 onEnter(set cult 7) 后 judgeEnding 在三象限都落到对应结局', () => {
    const tribulationEnter: readonly Effect[] = [
      { kind: 'set', target: 'cultProgress', value: CULT_PROGRESSION_MAX },
      { kind: 'add', target: 'madness', value: 30 },
      { kind: 'add', target: 'lifespan', value: -30 }
    ];
    // E6 象限。
    const e6 = applyEffects(withState({ defiance: 65, bond: 55 }), tribulationEnter);
    expect(judgeEnding(e6)).toBe('e6-sacrifice');
    // E7 象限。
    const e7 = applyEffects(withState({ defiance: 65, bond: 30 }), tribulationEnter);
    expect(judgeEnding(e7)).toBe('e7-usurp');
    // 飞升象限。
    const ascend = applyEffects(withState({ defiance: 20, bond: 30 }), tribulationEnter);
    expect(judgeEnding(ascend)).toBe('ascension');
  });

  it('真实修炼链必须走完六劫：cult=6 仍锁雷关，stage6 后 cult=7 才开放', () => {
    const reveal = NARRATION_SCENES_BY_ID.get('act1.reveal')!;
    let state = nextState(initialState(), reveal, 'practice').state;
    expect(state.cultProgress).toBe(1);

    const stages = [
      'act2.temper.stage1',
      'act2.temper.stage2',
      'act2.temper.stage3',
      'act2.temper.stage4',
      'act2.temper.stage5'
    ];
    for (const id of stages) {
      const stage = NARRATION_SCENES_BY_ID.get(id)!;
      state = nextState(enterScene(state, stage), stage, 'on').state;
    }
    expect(state.cultProgress).toBe(6);
    const train = NARRATION_SCENES_BY_ID.get('act2.train')!;
    const assault = train.choices!.find(choice => choice.id === 'assault')!;
    expect(isChoiceAvailable(state, train.id, assault)).toBe(false);

    const stage6 = NARRATION_SCENES_BY_ID.get('act2.temper.stage6')!;
    state = nextState(enterScene(state, stage6), stage6, 'on').state;
    expect(state.cultProgress).toBe(CULT_PROGRESSION_MAX);
    expect(isChoiceAvailable(state, train.id, assault)).toBe(true);
  });

  it('采药女分支读取真实选择：放弃后只开放冷遇路线，不会固定声称曾背她下山', () => {
    const cliff = NARRATION_SCENES_BY_ID.get('act2.side.herb')!;
    const afterAbandon = nextState(initialState(), cliff, 'abandon').state;
    const hub = NARRATION_SCENES_BY_ID.get('act2.encounter.hub')!;
    const warm = hub.choices!.find(choice => choice.id === 'herbgirl')!;
    const cold = hub.choices!.find(choice => choice.id === 'herbgirl-cold')!;
    expect(afterAbandon.flags.has('herb-abandoned')).toBe(true);
    expect(isChoiceAvailable(afterAbandon, hub.id, warm)).toBe(false);
    expect(isChoiceAvailable(afterAbandon, hub.id, cold)).toBe(true);
  });

  it('终局诘问在每个状态象限只开放一个分支', () => {
    const question = NARRATION_SCENES_BY_ID.get('act3.tribulation.question')!;
    const availableIds = (state: NarrationState): string[] =>
      question.choices!.filter(choice => isChoiceAvailable(state, question.id, choice)).map(choice => choice.id);

    expect(availableIds(withState({ defiance: 20, bond: 80 }))).toEqual(['answer']);
    expect(availableIds(withState({ defiance: 60, bond: 50 }))).toEqual(['e6']);
    expect(availableIds(withState({ defiance: 60, bond: 49 }))).toEqual(['e7']);
  });
});

// ── 道心脉象：隐变量档位跨越的离散化派生（dogfood ISSUE-006） ──────────────────

describe('firstPersonView · deriveHeartPulse 隐变量档位跨越', () => {
  it('三条隐变量均无档位跨越 → null（同档微涨不脉冲，免噪音；felt, not counted）', () => {
    const prev = withState({ defiance: 10, bond: 10, madness: 10 });
    const next = withState({ defiance: 12, bond: 9, madness: 11 });
    expect(deriveHeartPulse(prev, next)).toBeNull();
  });

  it('defiance 跨 low→high（+50）→ defiance/high 上升脉象', () => {
    const prev = withState({ defiance: 20 });
    const next = withState({ defiance: 70 });
    const pulse = deriveHeartPulse(prev, next);
    expect(pulse).not.toBeNull();
    expect(pulse!).toEqual({ quality: 'defiance', tier: 'high', rose: true });
  });

  it('bond 跨 med→low（回退）→ bond/low 下降脉象（rose=false）', () => {
    const prev = withState({ bond: 40 });
    const next = withState({ bond: 20 });
    const pulse = deriveHeartPulse(prev, next);
    expect(pulse).not.toBeNull();
    expect(pulse!).toEqual({ quality: 'bond', tier: 'low', rose: false });
  });

  it('defilement 映射到 madness：madness 跨 low→med → defilement/med', () => {
    const prev = withState({ madness: 10 });
    const next = withState({ madness: 50 });
    expect(deriveHeartPulse(prev, next)).toEqual({ quality: 'defilement', tier: 'med', rose: true });
  });

  it('defiance 与 bond 同跨度（均 low→med）时优先 defiance（E6/E7 触发主因）', () => {
    const prev = withState({ defiance: 10, bond: 10 });
    const next = withState({ defiance: 50, bond: 50 });
    const pulse = deriveHeartPulse(prev, next);
    expect(pulse).not.toBeNull();
    expect(pulse!.quality).toBe('defiance');
  });

  it('取跨度最大者：defiance low→high（跨 2 档）压过 bond med→high（跨 1 档）', () => {
    const prev = withState({ defiance: 10, bond: 50 });
    const next = withState({ defiance: 70, bond: 70 });
    const pulse = deriveHeartPulse(prev, next);
    expect(pulse).not.toBeNull();
    expect(pulse!.quality).toBe('defiance');
    expect(pulse!.tier).toBe('high');
  });

  it('不改入参（纯函数，只读镜像侧，docs/23 §0）', () => {
    const prev = withState({ defiance: 0, bond: 0, madness: 0 });
    const snapshot = { ...prev };
    deriveHeartPulse(prev, withState({ defiance: 80, bond: 80, madness: 80 }));
    expect(prev).toEqual(snapshot);
  });

  it('全 0 → 全 0 无脉象', () => {
    expect(deriveHeartPulse(initialState(), initialState())).toBeNull();
  });

  it('档位边界点（33/66）闭环：32 仍 low、33 入 med、65 仍 med、66 入 high', () => {
    // 32(low)→33(med)：bond 跨档。
    expect(deriveHeartPulse(withState({ bond: 32 }), withState({ bond: 33 }))!.tier).toBe('med');
    // 65(med)→66(high)：defiance 跨档。
    expect(deriveHeartPulse(withState({ defiance: 65 }), withState({ defiance: 66 }))!.tier).toBe('high');
    // 32→32 同档无脉象。
    expect(deriveHeartPulse(withState({ bond: 32 }), withState({ bond: 32 }))).toBeNull();
  });
});
