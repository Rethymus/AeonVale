/**
 * 模拟上下文：sim 纯函数的只读依赖集合。
 * 所有 sim 系统签名形如 fn(state, input, ctx) → events，ctx 注入 RNG/参数/内容。
 * 测试/无头模拟通过构造不同 ctx 实现确定性复现与参数扫描。
 */
import type { BalanceParams } from '../params';
import type { ContentRegistry } from '@content/defs';
import type { RngStreams } from './rng';

export interface SimContext {
  rng: RngStreams;
  params: BalanceParams;
  content: ContentRegistry;
}
