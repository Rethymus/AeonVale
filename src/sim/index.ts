/**
 * @sim 根出口（旧世界退役后保留面，docs/21 §8.30）。
 * 主模式切片：sokoban（天劫棋盘）/ cultivation-run（修途生命周期）；
 * 共享基元：params / serialize（canonicalSerialize）/ core（Rng 与基础类型）。
 * 旧世界目录已按判定表整删。
 */
export * from './core/rng';
export * from './core/types';
export * from './params';
export * from './serialize';
export * from './sokoban';
export * from './cultivation-run';
