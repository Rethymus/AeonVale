/**
 * R4′ meta 硬传承 · localStorage 解码边界（TT-04）。
 *
 * 互补于 sokoban-meta.test.ts（那里只测纯 transition）：这里钉 loadMeta/saveMeta 的
 * 解码契约——坏档/错型/混型数据一律降级为安全默认，**静默清空只发生在整档畸形时**；
 * 局部字段损坏只丢该字段，不放大为全档清空。跨周目进度（残卷/图鉴）对玩家不可再生，
 * 故契约必须显式钉住。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  emptyMeta,
  loadMeta,
  recordEncounteredRecipe,
  saveMeta,
  type SokobanMeta
} from '../../src/app/rogueliteProto/meta';

interface FakeStorage {
  readonly map: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function fakeStorage(initial?: Record<string, string>): FakeStorage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    map,
    getItem(key: string): string | null {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      map.set(key, value);
    }
  };
}

const SLOT = 'aeonvale-sokoban-meta-v1';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sokoban meta · loadMeta 解码边界', () => {
  it('node 环境无 localStorage → emptyMeta（SSR/测试环境不抛）', () => {
    // 不 stub：node 测试环境天然无全局 localStorage。
    expect(loadMeta()).toEqual(emptyMeta());
  });

  it('空存储 / 畸形 JSON → emptyMeta（坏档静默回退，不抛）', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(loadMeta()).toEqual(emptyMeta());

    vi.stubGlobal('localStorage', fakeStorage({ [SLOT]: '{not json' }));
    expect(loadMeta()).toEqual(emptyMeta());

    vi.stubGlobal('localStorage', fakeStorage({ [SLOT]: '"just a string"' }));
    expect(loadMeta()).toEqual(emptyMeta());
  });

  it('完整合法档 → 原样恢复（roundtrip）', () => {
    const meta: SokobanMeta = {
      maxStageSolved: 3,
      unlockedScrolls: [0, 1, 3],
      deathCount: 7,
      breakthroughs: 5,
      encounteredRecipes: ['fire|base|lingcao']
    };
    vi.stubGlobal('localStorage', fakeStorage({ [SLOT]: JSON.stringify(meta) }));
    expect(loadMeta()).toEqual(meta);
  });

  it('saveMeta → loadMeta roundtrip；写失败（隐私模式）静默不抛', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    const meta: SokobanMeta = { maxStageSolved: 1, unlockedScrolls: [1], deathCount: 2, breakthroughs: 1, encounteredRecipes: [] };
    saveMeta(meta);
    expect(JSON.parse(store.map.get(SLOT)!)).toEqual(meta);
    expect(loadMeta()).toEqual(meta);

    const throwing = fakeStorage();
    throwing.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    vi.stubGlobal('localStorage', throwing);
    expect(() => saveMeta(meta)).not.toThrow();
  });

  it('缺字段 → 逐字段默认值（不清空其它字段）', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [SLOT]: JSON.stringify({ deathCount: 4 }) }));
    expect(loadMeta()).toEqual({ maxStageSolved: -1, unlockedScrolls: [], deathCount: 4, breakthroughs: 0, encounteredRecipes: [] });
  });

  it('错型字段 → 该字段取默认（"3"、null、非数组均拒收）', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        [SLOT]: JSON.stringify({ maxStageSolved: '3', deathCount: null, breakthroughs: true, unlockedScrolls: '0,1', encounteredRecipes: { a: 1 } })
      })
    );
    expect(loadMeta()).toEqual(emptyMeta());
  });

  it('混型数组 → 过滤保留合法元素（部分损坏不放大为全丢）', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({
        [SLOT]: JSON.stringify({ unlockedScrolls: [1, '2', null, 3], encounteredRecipes: ['a', 42, 'b'] })
      })
    );
    const meta = loadMeta();
    expect(meta.unlockedScrolls).toEqual([1, 3]);
    expect(meta.encounteredRecipes).toEqual(['a', 'b']);
  });

  it('未知字段与 __proto__ 注入被忽略（JSON.parse 自有属性不污染原型）', () => {
    vi.stubGlobal(
      'localStorage',
      fakeStorage({ [SLOT]: '{"maxStageSolved":2,"__proto__":{"polluted":1},"evil":"x"}' })
    );
    const meta = loadMeta();
    expect(meta).toEqual({ ...emptyMeta(), maxStageSolved: 2 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('sokoban meta · recordEncounteredRecipe 图鉴上限', () => {
  it('上限 64 条：超出后保留最近 64 条（丢最旧）', () => {
    let meta = emptyMeta();
    for (let i = 0; i < 70; i += 1) {
      meta = recordEncounteredRecipe(meta, `recipe-${i}`);
    }
    expect(meta.encounteredRecipes).toHaveLength(64);
    expect(meta.encounteredRecipes[0]).toBe('recipe-6');
    expect(meta.encounteredRecipes[63]).toBe('recipe-69');
  });

  it('重复 key 幂等：原样返回、不触发截断', () => {
    let meta = emptyMeta();
    for (let i = 0; i < 64; i += 1) {
      meta = recordEncounteredRecipe(meta, `recipe-${i}`);
    }
    const again = recordEncounteredRecipe(meta, 'recipe-63');
    expect(again).toBe(meta);
    expect(again.encounteredRecipes).toHaveLength(64);
  });
});
