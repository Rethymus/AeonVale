/**
 * canonicalSerialize · 值域边界契约测试（TT-02 + P3）。
 *
 * 修途 golden replay 快照哈希的基元契约（tests/replay/cultivation-harness.ts
 * cultivationSnapshotHash）。P3 起为 fail-fast：undefined 与非有限数抛
 * TypeError（无唯一 JSON 表示，静默序列化会哈希碰撞、污染确定性门）。
 * 该变更对既有 replay 语料哈希中性（可达输入不含这两类值），由 replay
 * 套件不刷 fixtures 全绿实证。行为变更已经用户授权（P3）。
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { canonicalSerialize } from '../../src/sim/serialize';

describe('canonicalSerialize · 基础契约', () => {
  it('对象 key 字典序、数组保序', () => {
    expect(canonicalSerialize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalSerialize([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalSerialize({ z: [2, 1], a: { y: 1, x: 2 } })).toBe('{"a":{"x":2,"y":1},"z":[2,1]}');
  });

  it('标量：字符串转义 / null / 布尔走 JSON.stringify', () => {
    expect(canonicalSerialize(null)).toBe('null');
    expect(canonicalSerialize(true)).toBe('true');
    expect(canonicalSerialize('a"b\n')).toBe('"a\\"b\\n"');
  });

  it('Map：键按字符串字典序（"10" < "2"），非字符串键经 String()', () => {
    expect(canonicalSerialize(new Map<string, number>([['b', 1], ['a', 2]]))).toBe('{|"a":2,"b":1|}');
    expect(canonicalSerialize(new Map<number, string>([[10, 'ten'], [2, 'two']]))).toBe('{|"10":"ten","2":"two"|}');
  });

  it('Set：按字符串字典序排序后按数组序列化', () => {
    expect(canonicalSerialize(new Set([2, 10, 1]))).toBe('[1,10,2]');
    expect(canonicalSerialize(new Set<string>(['b', 'a']))).toBe('["a","b"]');
  });
});

describe('canonicalSerialize · 数值量化（1e-6）', () => {
  it('浮点噪声被量化抹平（0.1+0.2 → "0.3"）', () => {
    expect(canonicalSerialize(0.1 + 0.2)).toBe('0.3');
    expect(canonicalSerialize(123456789.123456789)).toBe('123456789.123457');
  });

  it('亚阈值归零：1e-7 → "0"', () => {
    expect(canonicalSerialize(1e-7)).toBe('0');
  });

  it('-0 与 0 归并为 "0"（量化消歧，哈希不因符号零漂移）', () => {
    expect(canonicalSerialize(-0)).toBe('0');
    expect(canonicalSerialize(-0)).toBe(canonicalSerialize(0));
  });

  it('超大有限数保持 String() 指数形态（确定性优先于 JSON 可解析性）', () => {
    expect(canonicalSerialize(1e21)).toBe('1e+21');
  });
});

describe('canonicalSerialize · fail-fast（P3 契约）', () => {
  it('undefined：顶层 / 数组元素 / 对象值 / Map·Set 值 → 抛 TypeError（不再坍缩碰撞）', () => {
    expect(() => canonicalSerialize(undefined)).toThrow(TypeError);
    expect(() => canonicalSerialize([undefined])).toThrow(TypeError);
    expect(() => canonicalSerialize([1, undefined, 2])).toThrow(TypeError);
    expect(() => canonicalSerialize({ a: undefined })).toThrow(TypeError);
    expect(() => canonicalSerialize(new Map([['a', undefined]]))).toThrow(TypeError);
    expect(() => canonicalSerialize(new Set([undefined]))).toThrow(TypeError);
  });

  it('非有限数：NaN / ±Infinity 顶层或嵌套 → 抛 TypeError（不再输出非法 JSON token）', () => {
    expect(() => canonicalSerialize(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalSerialize(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => canonicalSerialize(Number.NEGATIVE_INFINITY)).toThrow(TypeError);
    expect(() => canonicalSerialize([1, Number.NaN])).toThrow(TypeError);
    expect(() => canonicalSerialize({ a: { b: Number.POSITIVE_INFINITY } })).toThrow(TypeError);
  });

  it('null 不同于 undefined：null 合法参与序列化', () => {
    expect(canonicalSerialize([null])).toBe('[null]');
    expect(canonicalSerialize({ a: null })).toBe('{"a":null}');
  });
});

describe('canonicalSerialize · 结构边界', () => {
  it('Symbol 键被 Object.keys 忽略（丢弃，不进哈希）', () => {
    const obj: Record<string | symbol, unknown> = { a: 1 };
    obj[Symbol('hidden')] = 2;
    expect(canonicalSerialize(obj)).toBe('{"a":1}');
  });

  it('空容器：{} / [] / 空 Map / 空 Set', () => {
    expect(canonicalSerialize({})).toBe('{}');
    expect(canonicalSerialize([])).toBe('[]');
    expect(canonicalSerialize(new Map())).toBe('{||}');
    expect(canonicalSerialize(new Set())).toBe('[]');
  });

  it('循环引用 → 抛错（现状：无环是调用方约束；递归爆栈仍为抛错类）', () => {
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => canonicalSerialize(circular)).toThrow();

    const inArray: unknown[] = [1];
    inArray.push(inArray);
    expect(() => canonicalSerialize(inArray)).toThrow();
  });
});

describe('canonicalSerialize · 不变量属性（fast-check）', () => {
  const scalarArb = fc.oneof(fc.integer(), fc.string({ maxLength: 12 }), fc.boolean(), fc.constant(null));
  const objArb = fc.dictionary(fc.string({ maxLength: 8 }), scalarArb, { maxKeys: 6 });
  const nestedArb = fc.dictionary(fc.string({ maxLength: 8 }), fc.oneof(scalarArb, fc.array(scalarArb, { maxLength: 4 }), objArb), { maxKeys: 5 });

  it('属性：确定性——同输入两次序列化逐字节一致', () => {
    fc.assert(
      fc.property(nestedArb, value => {
        expect(canonicalSerialize(value)).toBe(canonicalSerialize(value));
      })
    );
  });

  it('属性：键顺序不影响输出（字典序排序不变量）', () => {
    fc.assert(
      fc.property(objArb, obj => {
        const reordered = Object.fromEntries(Object.entries(obj).reverse());
        expect(canonicalSerialize(reordered)).toBe(canonicalSerialize(obj));
      })
    );
  });
});
