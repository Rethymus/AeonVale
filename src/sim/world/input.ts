/**
  * 玩家输入与动作。
  * 动作离散化为高级 PlayerAction，便于记录与回放（C3 记录输入而非状态）。
  * M1 聚焦种田动作；炼丹/天劫动作在 M2 扩充。
 */
import type { Vec2 } from './types';
import type { CropQuality } from '@sim/farm/quality';
import type { FacilityKind } from '@sim/world/state';

export type PlayerAction =
 | { kind: 'move'; to: Vec2 }
 | { kind: 'till'; at: Vec2 }
 | { kind: 'sow'; at: Vec2; seedId: string }
 | { kind: 'water'; at: Vec2 }
 | { kind: 'fertilize'; at: Vec2; itemId: string }
 | { kind: 'channel-qi'; at: Vec2 }
 | { kind: 'harvest'; at: Vec2 }
 | { kind: 'ship-item'; itemId: string; count: number }
 | { kind: 'ship-quality-item'; itemId: string; quality: CropQuality; count: number }
 | { kind: 'deposit-item'; itemId: string; count: number }
 | { kind: 'withdraw-item'; itemId: string; count: number }
 | { kind: 'deposit-quality-item'; itemId: string; quality: CropQuality; count: number }
 | { kind: 'withdraw-quality-item'; itemId: string; quality: CropQuality; count: number }
 | { kind: 'place-facility'; at: Vec2; facilityKind: FacilityKind; free?: boolean }
 | { kind: 'start-drying-job'; facilityId: number; itemId: string; quality?: CropQuality }
 | { kind: 'start-facility-recipe-job'; facilityId: number; recipeId: string }
 | { kind: 'start-sealing-job'; facilityId: number }
 | { kind: 'start-furnace-job'; facilityId: number }
 | { kind: 'collect-facility'; facilityId: number }
 | { kind: 'dry-herb'; itemId: string; quality?: CropQuality }
 | { kind: 'seal-herb' }
 | { kind: 'buy-shop-item'; itemId: string; count: number }
 | { kind: 'buy-festival-stall-item'; itemId: string }
 | { kind: 'explore'; site: 'valley' | 'ruin' | 'spirit-vein' }
 | { kind: 'delve-ruin' }
 | { kind: 'upgrade'; upgradeId: string }
 | { kind: 'give-gift'; npcId: string; itemId: string }
 | { kind: 'complete-commission'; commissionId: string }
 | { kind: 'resolve-staying-world-incident' }
 | { kind: 'accept-special-order'; orderId: string }
 | { kind: 'submit-special-order'; orderId: string; count: number }
 | { kind: 'claim-special-order'; orderId: string }
 | { kind: 'claim-mainline-quest'; questId: string }
 | { kind: 'claim-ruin-chapter'; chapterId: string }
 | { kind: 'claim-npc-quest'; questId: string }
 | { kind: 'donate-archive'; donationId: string }
 | { kind: 'claim-archive-milestone'; milestoneId: string }
 | { kind: 'participate-festival' }
 | { kind: 'train'; method: 'push-up' | 'sit-up' | 'squat' | 'long-run' }
 | { kind: 'invoke-tribulation' }
 | { kind: 'hunt-beast' } // 主动猎杀一只妖兽：耗体力并承受反击，成功后才有内丹
 | { kind: 'tame-guard-beast' } // 消耗内丹/灵石驯作灵田巡守兽，近似凡人农庄的看门犬
 | { kind: 'feed-guard-beast'; herbItemId: string } // 投喂灵草照料巡守兽，恢复精力并提升羁绊
 | { kind: 'assign-guard-beast-patrol'; beastId: number; tileId: number } // 用守田兽哨指派巡逻地块，影响护田与留世协防优先级
 | { kind: 'eat-raw'; herbDefId: string } // 生食灵草（积丹毒）
 | { kind: 'rest' }; // 静室休息（清毒/回体）

/** 一个游戏日的玩家输入（动作按序执行）。 */
export interface DayInput {
 actions: PlayerAction[];
}

export const EMPTY_DAY: DayInput = { actions: [] };
