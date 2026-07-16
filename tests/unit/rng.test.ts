import { describe, it, expect } from 'vitest';
import { Rng, deriveStreams, hashStr } from '@sim/world/rng';

describe('Rng 确定性 (C3)', () => {
 it('同种子 ⇒ 同序列', () => {
 const a = new Rng(42);
 const b = new Rng(42);
 for (let i = 0; i < 200; i++) expect(a.next(), `第${i}次`).toBe(b.next());
 });

it('不同种子 ⇒ 不同序列', () => {
 const a = new Rng(1);
 const b = new Rng(2);
 let diff = 0;
 for (let i = 0; i < 100; i++) if (a.next() !== b.next()) diff++;
 expect(diff).toBeGreaterThan(90);
 });

it('next 始终落在 [0,1)', () => {
 const r = new Rng(12345);
 for (let i = 0; i < 5000; i++) {
 const v = r.next();
 expect(v).toBeGreaterThanOrEqual(0);
 expect(v).toBeLessThan(1);
 }
 });

it('字符串种子哈希一致', () => {
 expect(hashStr('abc')).toBe(hashStr('abc'));
 expect(hashStr('abc')).not.toBe(hashStr('abd'));
 });

it('weighted 加权抽样确定性', () => {
 const r1 = new Rng(7);
 const r2 = new Rng(7);
 const items = [
 { item: 'a', weight: 1 },
 { item: 'b', weight: 3 },
 { item: 'c', weight: 6 },
 ];
 for (let i = 0; i < 100; i++) expect(r1.weighted(items)).toBe(r2.weighted(items));
 });

it('weighted 长期频率近似权重比', () => {
 const r = new Rng(999);
 const items = [
 { item: 'a', weight: 1 },
 { item: 'b', weight: 3 },
 ];
 const count = { a: 0, b: 0 };
 for (let i = 0; i < 10000; i++) count[r.weighted(items) as 'a' | 'b']++;
 // 期望 b/a ≈ 3
 const ratio = count.b / count.a;
 expect(ratio).toBeGreaterThan(2.5);
 expect(ratio).toBeLessThan(3.5);
 });

it('多流互相独立（fork 不交叉污染）', () => {
 const s1 = deriveStreams(99);
 const s2 = deriveStreams(99);
 expect(s1.lightning.next()).toBe(s2.lightning.next());
 // 推进 lightning 不影响 growth 流
 const s3 = deriveStreams(100);
 const gBefore = s3.growth.snapshot();
 s3.lightning.next();
 s3.lightning.next();
 s3.lightning.next();
 expect(s3.growth.snapshot()).toBe(gBefore);
 });

it('snapshot/restore 可重建状态', () => {
 const r = new Rng(55);
 r.next();
 r.next();
 const snap = r.snapshot();
 const v1 = r.next();
 const v2 = r.next();
 r.restore(snap);
 expect(r.next()).toBe(v1);
 expect(r.next()).toBe(v2);
 });
});
