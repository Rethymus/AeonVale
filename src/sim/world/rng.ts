/**
  * 确定性伪随机数生成器 (Deterministic PRNG)
 *
  * 宪法 C3 落地：所有游戏随机**必须**经此 Rng，禁止 Math.random() 进入 sim 层。
  * 同 masterSeed + 同调用顺序 ⇒ 完全可复现（无头测试 / Golden Replay / 平衡调参的前提）。
 *
  * 算法：Mulberry32（速度快、统计足够、实现极简、跨平台一致）。
 */

/** Mulberry32 的可序列化状态：单个 u32。 */
export type RngState = number;

/** FNV-1a 哈希：把字符串（如种子名、流名）折叠为 u32，用于派生子种子。 */
export function hashStr(s: string): number {
 let h = 2166136261 >>> 0;
 for (let i = 0; i < s.length; i++) {
 h ^= s.charCodeAt(i);
 h = Math.imul(h, 16777619);
 }
 return h >>> 0;
}

/**
  * 种子化随机数发生器。可变（每次 next 推进内部状态）。
  * 可 snapshot/restore 用于存档；可 fork(name) 派生独立子流。
 */
export class Rng {
 private a: number;

constructor(seed: number | string) {
 this.a = (typeof seed === 'number' ? seed : hashStr(seed)) >>> 0;
 }

/** 下一个 [0,1) 浮点。核心推进。 */
 next(): number {
 // Mulberry32
 this.a |= 0;
 this.a = (this.a + 0x6d2b79f5) | 0;
 let t = Math.imul(this.a ^ (this.a >>> 15), 1 | this.a);
 t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
 return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
 }

/** [0, maxExclusive) 的整数。 */
 nextInt(maxExclusive: number): number {
 return Math.floor(this.next() * maxExclusive);
 }

/** [minIncl, maxExcl) 的整数。 */
 intRange(minIncl: number, maxExcl: number): number {
 return minIncl + this.nextInt(maxExcl - minIncl);
 }

/** [min, max) 的浮点。 */
 floatRange(min: number, max: number): number {
 return min + this.next() * (max - min);
 }

/** 以概率 p∈[0,1] 返回 true。 */
 chance(p: number): boolean {
 return this.next() < p;
 }

/** 等概率随机取一个元素（非空数组）。 */
 pick<T>(arr: readonly T[]): T {
 if (arr.length === 0) throw new Error('Rng.pick: empty array');
 return arr[Math.floor(this.next() * arr.length)] as T;
 }

/**
  * 加权抽样（轮盘）。权重可为任意非负数；无需归一化。
  * 返回命中项。确定性：同 rng 状态 + 同 items ⇒ 同结果。
 */
 weighted<T>(items: readonly { item: T; weight: number }[]): T {
 if (items.length === 0) throw new Error('Rng.weighted: empty items');
 let total = 0;
 for (const it of items) {
 if (it.weight < 0) throw new Error('Rng.weighted: negative weight');
 total += it.weight;
 }
 if (total <= 0) {
 // 全零权重：等概率回退
 return this.pick(items.map((i) => i.item));
 }
 let r = this.next() * total;
 for (const it of items) {
 r -= it.weight;
 if (r < 0) return it.item;
 }
 return items[items.length - 1]!.item;
 }

/** 派生一个独立子流（不消耗本流状态）。用于按系统分段种子。 */
 fork(name: string): Rng {
 return new Rng(hashStr(`${this.a >>> 0}:${name}`));
 }

/** 当前内部状态（可序列化，用于存档/回放断点）。 */
 snapshot(): RngState {
 return this.a >>> 0;
 }

/** 从快照恢复状态。 */
 restore(state: RngState): void {
 this.a = state >>> 0;
 }
}

/**
  * 多流 PRNG 容器（10-technical-architecture §6.3）。
  * 每个独立随机子系统用自己的子种子，调参一处不影响其他 → 单变量分析 & 稳定回放。
 */
export interface RngStreams {
 readonly master: number; // 主种子（只读，便于回放记录）
 readonly world: Rng; // 地图/世界生成
 readonly growth: Rng; // 灵草生长波动
 readonly lightning: Rng; // 雷落点
 readonly alchemy: Rng; // 炸炉/炼丹判定
 readonly celestial: Rng; // 天象事件
 readonly beast: Rng; // 妖兽行为
 readonly drop: Rng; // 掉落
}

/** 由主种子派生全部子流。完全可复现。 */
export function deriveStreams(masterSeed: number | string): RngStreams {
 const seedNum = typeof masterSeed === 'number' ? masterSeed >>> 0 : hashStr(masterSeed);
 const base = new Rng(seedNum);
 return {
 master: seedNum,
 world: base.fork('world'),
 growth: base.fork('growth'),
 lightning: base.fork('lightning'),
 alchemy: base.fork('alchemy'),
 celestial: base.fork('celestial'),
 beast: base.fork('beast'),
 drop: base.fork('drop'),
 };
}

/** 把所有流的当前状态打包（用于存档/回放）。 */
export function snapshotStreams(s: RngStreams): Record<keyof Omit<RngStreams, 'master'>, RngState> {
 return {
 world: s.world.snapshot(),
 growth: s.growth.snapshot(),
 lightning: s.lightning.snapshot(),
 alchemy: s.alchemy.snapshot(),
 celestial: s.celestial.snapshot(),
 beast: s.beast.snapshot(),
 drop: s.drop.snapshot(),
 };
}
