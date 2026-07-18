/**
 * 天劫/寿元命数压力卡（P1-3）：把渡劫状态、大限、备劫压缩成常驻可见的三行 + 危险等级。
 *
 * 纯函数：只吃已派生的原语（status/days/lifespan/readyToInvoke/frozen/prepLine），
 * 不读/写 GameState，不影响存档/回放。危险等级取天劫与寿元中更严重者（spec §6.3）。
 */
export type TribulationDangerLevel = 'calm' | 'warning' | 'critical' | 'terminal';

export interface TribulationPressurePresentation {
  tribulationRow: string;
  lifespanRow: string;
  prepRow: string;
  danger: TribulationDangerLevel;
}

export interface TribulationPressureInput {
  status: string;                 // state.tribulation.status
  daysRemaining: number;          // state.tribulation.daysRemaining
  lifespanRemainingDays: number;  // state.player.lifespanRemainingDays
  readyToInvoke: boolean;         // readyToInvokeTribulation(state, params)
  frozen: boolean;                // 留世/终局冻结
  prepLine: string;               // tribulationPrepStatusLine(state) 复用
}

// 阈值（ presenter 常量，表驱动测试钉死；如需对齐 14 §催讨窗口，改这里即可）
export const TRIB_CRITICAL_DAYS = 3;
export const TRIB_WARNING_DAYS = 7;
export const LIFESPAN_CRITICAL_DAYS = 20;
export const LIFESPAN_WARNING_DAYS = 60;

export function tribulationPressurePresentation(input: TribulationPressureInput): TribulationPressurePresentation {
  const { status, daysRemaining, lifespanRemainingDays, readyToInvoke, frozen, prepLine } = input;

  if (frozen) {
    return {
      tribulationRow: '此界劫数已定',
      lifespanRow: lifespanRemainingDays > 0 ? `留世 ${lifespanRemainingDays} 日` : '大限已至',
      prepRow: '',
      danger: 'terminal'
    };
  }

  let tribulationRow: string;
  if (status === 'countdown') tribulationRow = `距天劫：${daysRemaining} 日`;
  else if (status === 'due') tribulationRow = '天劫已至';
  else if (readyToInvoke) tribulationRow = '可主动引劫';
  else tribulationRow = '劫势未成';

  const lifespanRow = lifespanRemainingDays > 0 ? `距大限：${lifespanRemainingDays} 日` : '大限已至';

  let danger: TribulationDangerLevel = 'calm';
  if (status === 'due' || lifespanRemainingDays <= 0) danger = 'critical';
  else if (status === 'countdown' && daysRemaining <= TRIB_CRITICAL_DAYS) danger = 'critical';
  else if (lifespanRemainingDays <= LIFESPAN_CRITICAL_DAYS) danger = 'critical';
  else if (status === 'countdown' && daysRemaining <= TRIB_WARNING_DAYS) danger = 'warning';
  else if (lifespanRemainingDays <= LIFESPAN_WARNING_DAYS) danger = 'warning';

  return { tribulationRow, lifespanRow, prepRow: prepLine, danger };
}
