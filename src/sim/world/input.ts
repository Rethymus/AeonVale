/**
 * 玩家输入与动作（docs/10 §8.1 InputFrame / docs/11）。
 * 动作离散化为高级 PlayerAction，便于记录与回放（C3 记录输入而非状态）。
 * M1 聚焦种田动作；炼丹/天劫动作在 M2 扩充。
 */
import type { Vec2 } from './types';

export type PlayerAction =
  | { kind: 'move'; to: Vec2 }
  | { kind: 'till'; at: Vec2 }
  | { kind: 'sow'; at: Vec2; seedId: string }
  | { kind: 'water'; at: Vec2 }
  | { kind: 'channel-qi'; at: Vec2 }
  | { kind: 'harvest'; at: Vec2 }
  | { kind: 'hunt-beast' } // 主动猎杀一只妖兽：耗体力并承受反击，成功后才有内丹（docs/07 §3.4.3）
  | { kind: 'eat-raw'; herbDefId: string } // 生食灵草（积丹毒，docs/06 §1）
  | { kind: 'rest' }; // 静室休息（清毒/回体）

/** 一个游戏日的玩家输入（动作按序执行）。 */
export interface DayInput {
  actions: PlayerAction[];
}

export const EMPTY_DAY: DayInput = { actions: [] };
