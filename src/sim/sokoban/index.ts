/**
 * R4′ 布阵导流 sim 切片 barrel。
 * 消费方（dev surface / 测试）经 `@sim/sokoban` 别名导入，不经 src/sim/index.ts 主 barrel（隔离）。
 */
export * from './types';
export * from './beam';
export * from './logic';
export * from './generator';
export * from './power';
export * from './tribulation-session';
export * from './prepared-board';
