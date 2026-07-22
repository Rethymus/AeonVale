/**
 * R4-a 雷劫炼体 roguelite sim 切片 barrel。
 *
 * 消费方（dev surface / 测试）经 `@sim/roguelite` 别名导入，**不**经 src/sim/index.ts 主 barrel——
 * 刻意隔离，避免触碰 GameState / 金标准回放。整合进正式 resolveDueTribulation 是 R4-b 的事。
 */
export * from './combatTypes';
export * from './formulas';
export * from './schedule';
export * from './combat';
