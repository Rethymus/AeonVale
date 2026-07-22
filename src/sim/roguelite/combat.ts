/**
 * R4-a 雷劫炼体 roguelite —— 渡劫战斗切片：创建 + 逐雷交互结算 reducer。
 *
 * applyCombatAction 是纯 reducer（状态可变、但无 IO、无随机）：落点/紫雷已在 createCombatRun 时
 * 由 generateStrikeSchedule 用 rng.lightning 确定性地预生成并展示（预告即真）。半实时手感由 app 层在
 * resolve-bolt 之间用 rAF 驱动走位/擦弹时机；本层只在 resolve-bolt 时读取当时 bodyPos + perfectBlock
 * 做确定性结算。结算数学镜像 tribulationSystem.ts 的 resolveTribulationBolt / runTribulation（见 formulas.ts）。
 */
import type { BalanceParams } from '@sim/params';
import type { Rng, RngStreams } from '@sim/world/rng';
import type { SoilType } from '@sim/world/types';
import {
  COMBAT_FIELD_HEIGHT,
  COMBAT_FIELD_WIDTH,
  IRONBONE_MITIGATION,
  ROD_INITIAL_POWER,
  ROD_POWER_LOSS_PER_HIT,
  TEMPER_BOOST_MULT,
  type CombatAction,
  type CombatActionOutcome,
  type CombatField,
  type CombatPill,
  type CombatState,
  type CombatTile
} from './combatTypes';
import { boltBaseDamage, nearDeathBonus } from './formulas';
import { generateStrikeSchedule, tileAt } from './schedule';

/** 战斗田土壤摇骰表（金属矿露头强引雷、湿泥土强导电、干沙弱导电、普通壤基准）。 */
const SOIL_ROLLS: readonly SoilType[] = ['loam', 'loam', 'loam', 'wet-loam', 'dry-sand', 'metal-ore'];

function generateField(rng: Rng, width: number, height: number): CombatField {
  const tiles: CombatTile[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles.push({ x, y, soilType: rng.pick(SOIL_ROLLS), rodPower: 0, insulated: false });
    }
  }
  return { width, height, tiles };
}

export interface CreateCombatRunOpts {
  readonly stage: number;
  readonly params: BalanceParams;
  readonly streams: RngStreams;
  readonly pills?: { readonly ward?: number; readonly ironbone?: number; readonly temper?: number };
}

/** 开启一场渡劫原型。确定性：同 stage + 同 streams ⇒ 同 field + 同时刻表 + 同初始 HP。 */
export function createCombatRun(opts: CreateCombatRunOpts): CombatState {
  const { stage, params, streams } = opts;
  const field = generateField(streams.world, COMBAT_FIELD_WIDTH, COMBAT_FIELD_HEIGHT);
  const hpStageIdx = Math.min(stage, params.player.stageMaxHp.length - 1);
  const maxHpMilli = (params.player.stageMaxHp[hpStageIdx] ?? 100) * 1000;
  const bodyPos = { x: Math.floor(COMBAT_FIELD_WIDTH / 2), y: Math.floor(COMBAT_FIELD_HEIGHT / 2) };
  const schedule = generateStrikeSchedule(field, stage, bodyPos, params, streams.lightning);
  return {
    seed: streams.master,
    stage,
    field,
    schedule,
    status: 'prep',
    bodyPos,
    hpMilli: maxHpMilli,
    maxHpMilli,
    wardMitigation: 0,
    ironBoneMitigation: 0,
    temperBoostMult: 1,
    pillsWard: opts.pills?.ward ?? 1,
    pillsIronBone: opts.pills?.ironbone ?? 1,
    pillsTemper: opts.pills?.temper ?? 1,
    boltIndex: 0,
    rawTemperingMilli: 0,
    hits: { direct: 0, rod: 0, miss: 0, blocked: 0, violet: 0 },
    result: null
  };
}

function consumePill(state: CombatState, pill: CombatPill, params: BalanceParams): CombatActionOutcome {
  switch (pill) {
    case 'ward':
      if (state.pillsWard <= 0) return { ok: false, reason: 'no-ward-pill' };
      state.wardMitigation = Math.max(state.wardMitigation, params.lightning.damage.pillMitigationWard);
      state.pillsWard -= 1;
      return { ok: true };
    case 'ironbone':
      if (state.pillsIronBone <= 0) return { ok: false, reason: 'no-ironbone-pill' };
      state.ironBoneMitigation = Math.max(state.ironBoneMitigation, IRONBONE_MITIGATION);
      state.pillsIronBone -= 1;
      return { ok: true };
    case 'temper':
      if (state.pillsTemper <= 0) return { ok: false, reason: 'no-temper-pill' };
      state.temperBoostMult = Math.max(state.temperBoostMult, TEMPER_BOOST_MULT);
      state.pillsTemper -= 1;
      return { ok: true };
    default:
      return { ok: false, reason: 'unknown-pill' };
  }
}

/** 结算单道雷（镜像 resolveTribulationBolt，顺序：onPlayer 优先 > 引雷草接 > miss）。 */
function resolveOneBolt(state: CombatState, perfectBlock: boolean, params: BalanceParams): void {
  const spec = state.schedule.bolts[state.boltIndex];
  if (!spec) return;
  const tp = params.lightning.tempering;
  const bp = params.lightning.bolt;
  const tempMult = spec.isViolet ? bp.violetTemperingMult : 1;
  const blastRadius = spec.isViolet ? bp.violetBlastRadius : 1;
  const base = boltBaseDamage(state.stage, params) * (spec.isViolet ? bp.violetDamageMult : 1);
  const distToPlayer = Math.max(Math.abs(spec.target.x - state.bodyPos.x), Math.abs(spec.target.y - state.bodyPos.y));
  const onPlayer = distToPlayer <= blastRadius;
  const rodTile = tileAt(state.field, spec.target.x, spec.target.y);
  const isRod = rodTile != null && rodTile.rodPower > 0;

  let rawTempering = 0;
  if (onPlayer) {
    let damage = base * (1 - state.wardMitigation) * (1 - state.ironBoneMitigation);
    if (perfectBlock) {
      damage *= 0.3;
      state.hits.blocked += 1;
      rawTempering = damage * tp.exposureDirect * tp.perfectBlockQualityBonus * tempMult;
    } else {
      state.hits.direct += 1;
      rawTempering = damage * tp.exposureDirect * tempMult;
    }
    state.hpMilli = Math.max(0, state.hpMilli - Math.round(damage));
  } else if (isRod && rodTile) {
    state.hits.rod += 1;
    rawTempering = base * tp.exposureRod * tempMult;
    rodTile.rodPower = Math.max(0, rodTile.rodPower - ROD_POWER_LOSS_PER_HIT);
  } else {
    state.hits.miss += 1;
    rawTempering = 0;
  }

  state.rawTemperingMilli += rawTempering;
  if (spec.isViolet) state.hits.violet += 1;
  state.boltIndex += 1;

  if (state.hpMilli <= 0 || state.boltIndex >= state.schedule.bolts.length) {
    finalizeCombat(state, params);
  }
}

/** 收尾：聚合淬体（镜像 runTribulation 的 rawTempering × eff × nearDeathBonus × temperBoost）。 */
function finalizeCombat(state: CombatState, params: BalanceParams): void {
  const tp = params.lightning.tempering;
  const eff = tp.effBase + tp.effStageSlope * state.stage;
  const finalRatio = state.maxHpMilli > 0 ? state.hpMilli / state.maxHpMilli : 0;
  const tempering = Math.round(state.rawTemperingMilli * eff * nearDeathBonus(finalRatio, params) * state.temperBoostMult);
  const survived = state.hpMilli > 0;
  // 渡劫后消耗一次性丹药效果（镜像 runTribulation 末尾清零）。
  state.wardMitigation = 0;
  state.ironBoneMitigation = 0;
  state.temperBoostMult = 1;
  state.result = {
    survived,
    finalHpMilli: state.hpMilli,
    temperingGainMilli: tempering,
    boltsResolved: state.boltIndex
  };
  state.status = survived ? 'survived' : 'dead';
}

/** 纯 reducer：把一个玩家动作应用到战斗状态。无 IO、无随机。 */
export function applyCombatAction(state: CombatState, action: CombatAction, params: BalanceParams): CombatActionOutcome {
  switch (action.kind) {
    case 'place-rod': {
      if (state.status !== 'prep') return { ok: false, reason: 'not-in-prep' };
      const tile = tileAt(state.field, action.x, action.y);
      if (!tile) return { ok: false, reason: 'out-of-bounds' };
      tile.rodPower = ROD_INITIAL_POWER;
      return { ok: true };
    }
    case 'place-insulator': {
      if (state.status !== 'prep') return { ok: false, reason: 'not-in-prep' };
      const tile = tileAt(state.field, action.x, action.y);
      if (!tile) return { ok: false, reason: 'out-of-bounds' };
      tile.insulated = true;
      return { ok: true };
    }
    case 'clear-tile': {
      if (state.status !== 'prep') return { ok: false, reason: 'not-in-prep' };
      const tile = tileAt(state.field, action.x, action.y);
      if (!tile) return { ok: false, reason: 'out-of-bounds' };
      tile.rodPower = 0;
      tile.insulated = false;
      return { ok: true };
    }
    case 'consume-pill':
      if (state.status === 'survived' || state.status === 'dead') return { ok: false, reason: 'combat-over' };
      return consumePill(state, action.pill, params);
    case 'begin-tribulation':
      if (state.status !== 'prep') return { ok: false, reason: 'not-in-prep' };
      state.status = 'resolving';
      state.boltIndex = 0;
      return { ok: true };
    case 'move': {
      if (state.status !== 'prep' && state.status !== 'resolving') return { ok: false, reason: 'cannot-move' };
      const tile = tileAt(state.field, action.x, action.y);
      if (!tile) return { ok: false, reason: 'out-of-bounds' };
      state.bodyPos = { x: action.x, y: action.y };
      return { ok: true };
    }
    case 'resolve-bolt': {
      if (state.status !== 'resolving') return { ok: false, reason: 'not-resolving' };
      if (state.boltIndex >= state.schedule.bolts.length) return { ok: false, reason: 'no-bolts-left' };
      resolveOneBolt(state, action.perfectBlock, params);
      return { ok: true };
    }
    default:
      return { ok: false, reason: 'unknown-action' };
  }
}
