/**
 * 修途旅程存档信封 · 解码负向矩阵（TT-03）。
 *
 * runSave 是唯一活跃玩家存档路径的持久层：aeonvale-cultivation-journey-v1。
 * 契约——信封层的任何畸形（坏 JSON / 非 / version 漂移 / 缺 payload / 运行期
 * storage 被禁用）一律回落 null/false，**不抛错、不阻塞启动、不误判为有档**。
 *
 * 已知边界（有意钉住现状）：snapshot 形状门（isJourneySnapshot）与 restore 链
 * 位于 rogueliteProto/surface 控制器闭包内，需真实 canvas，node 单测不可达；
 * 该门由 browser 契约（tests/browser）覆盖，此处只钉信封层。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import {
  clearCultivationJourney,
  hasCultivationJourney,
  loadCultivationJourney,
  saveCultivationJourney
} from '../../src/app/rogueliteProto/runSave';

const SLOT = 'aeonvale-cultivation-journey-v1';

interface FakeStorage {
  readonly map: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function fakeStorage(initial?: Record<string, string>): FakeStorage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    map,
    getItem: key => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: key => {
      map.delete(key);
    }
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('修途存档信封 · 无存储与空档', () => {
  it('node 环境无 localStorage → load null / has false / save false / clear 不抛', () => {
    expect(loadCultivationJourney<unknown>()).toBeNull();
    expect(hasCultivationJourney()).toBe(false);
    expect(saveCultivationJourney({ a: 1 })).toBe(false);
    expect(() => clearCultivationJourney()).not.toThrow();
  });

  it('空存储 → 无档（load null / has false）', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(loadCultivationJourney<unknown>()).toBeNull();
    expect(hasCultivationJourney()).toBe(false);
  });
});

describe('修途存档信封 · 解码负向矩阵（全部回落无档，不抛）', () => {
  it.each([
    ['畸形 JSON', '{not json'],
    ['JSON null', 'null'],
    ['JSON 布尔', 'true'],
    ['JSON 数字', '42'],
    ['JSON 数组（无 version）', '[]'],
    ['JSON 字符串', '"x"'],
    ['缺 version', JSON.stringify({ payload: { hp: 1 } })],
    ['version 漂移（未来版本）', JSON.stringify({ version: 2, payload: { hp: 1 } })],
    ['version 旧版本', JSON.stringify({ version: 0, payload: { hp: 1 } })],
    ['version 为字符串', JSON.stringify({ version: '1', payload: { hp: 1 } })],
    ['缺 payload 键', JSON.stringify({ version: 1 })]
  ])('%s → load null 且 has false', (_name, raw) => {
    vi.stubGlobal('localStorage', fakeStorage({ [SLOT]: raw }));
    expect(loadCultivationJourney<unknown>()).toBeNull();
    expect(hasCultivationJourney()).toBe(false);
  });

  it('getItem 运行期抛异常（隐私模式/扩展禁用）→ 按无档处理不抛', () => {
    const hostile = fakeStorage({ [SLOT]: JSON.stringify({ version: 1, payload: {} }) });
    hostile.getItem = () => {
      throw new Error('SecurityError');
    };
    vi.stubGlobal('localStorage', hostile);
    expect(loadCultivationJourney<unknown>()).toBeNull();
    expect(hasCultivationJourney()).toBe(false);
  });
});

describe('修途存档信封 · 合法信封与 payload 语义', () => {
  it('save → load roundtrip；has 在写后为 true', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    const payload = { version: 1, phase: 'planning', state: { hp: 3 } };
    expect(saveCultivationJourney(payload)).toBe(true);
    const raw = JSON.parse(store.map.get(SLOT)!) as { version: number; payload: unknown };
    expect(raw.version).toBe(1);
    expect(loadCultivationJourney<typeof payload>()).toEqual(payload);
    expect(hasCultivationJourney()).toBe(true);
  });

  it('信封合法但 payload=null → has true、load null（语义分歧钉住：回落新档不崩溃）', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [SLOT]: JSON.stringify({ version: 1, payload: null }) }));
    expect(hasCultivationJourney()).toBe(true);
    expect(loadCultivationJourney<unknown>()).toBeNull();
  });

  it('falsy payload（false / 0 / ""）原样透传，仅 null 归 null（?? 语义）', () => {
    for (const falsy of [false, 0, '']) {
      vi.stubGlobal('localStorage', fakeStorage({ [SLOT]: JSON.stringify({ version: 1, payload: falsy }) }));
      expect(loadCultivationJourney<unknown>()).toEqual(falsy);
    }
  });

  it('setItem 运行期抛异常 → save false（不阻塞游玩）', () => {
    const hostile = fakeStorage();
    hostile.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    vi.stubGlobal('localStorage', hostile);
    expect(saveCultivationJourney({ hp: 1 })).toBe(false);
  });

  it('clear 后回到无档态；clear 对无存储也不抛', () => {
    const store = fakeStorage();
    vi.stubGlobal('localStorage', store);
    saveCultivationJourney({ hp: 1 });
    expect(hasCultivationJourney()).toBe(true);
    clearCultivationJourney();
    expect(store.map.has(SLOT)).toBe(false);
    expect(hasCultivationJourney()).toBe(false);
  });
});

describe('修途存档信封 · roundtrip 属性（fast-check）', () => {
  const scalarArb = fc.oneof(fc.integer(), fc.string({ maxLength: 16 }), fc.boolean(), fc.constant(null));
  const payloadArb: fc.Arbitrary<unknown> = fc.oneof(
    scalarArb,
    fc.array(scalarArb, { maxLength: 5 }),
    fc.array(fc.array(scalarArb, { maxLength: 4 }), { maxLength: 3 }),
    fc.dictionary(fc.string({ maxLength: 10 }), scalarArb, { maxKeys: 5 }),
    fc.dictionary(fc.string({ maxLength: 10 }), fc.array(scalarArb, { maxLength: 4 }), { maxKeys: 4 })
  );

  it('任意 JSON 形 payload 写读 roundtrip 结构相等（标量/嵌套数组/嵌套对象）', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    fc.assert(
      fc.property(payloadArb, payload => {
        expect(saveCultivationJourney(payload)).toBe(true);
        expect(loadCultivationJourney<unknown>()).toEqual(payload);
      })
    );
  });

  it('任意 payload 写入后 has 恒为 true（信封层自身合法即有档）', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    fc.assert(
      fc.property(payloadArb, payload => {
        saveCultivationJourney(payload);
        expect(hasCultivationJourney()).toBe(true);
      })
    );
  });
});
