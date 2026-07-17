/*
 * onboarding-funnel.ts —— 新手漏斗达点率测量（体验门，dev-only，不入公开产物）。
 *
 * 科学方法：直接驱动确定性 sim，沿官方新手动线（翻地→播→浇→收→出货→结算→补种→
 * 二轮播/浇→闭环）推进，每日记录 getOnboardingObjectiveId；再以纯函数
 * computeOnboardingFunnel 聚合"各里程碑达点数 / 达点率 / 步骤转化率"。
 *
 * 默认跑 completeness 档（无人为流失）作为"漏斗可通关"硬门：所有种子都应能走到
 * first-loop-complete，否则说明新手动线存在阻断。--profile=leaky 叠加每步合成流失
 * 概率，仅用于演示报告形态（非真实人类数据，会明确标注）。
 *
 * 真实人类 / LLM playtest 的达点记录可按 OnboardingSession 结构灌入同一聚合函数。
 *
 * 用法：pnpm exec tsx tools/onboarding-funnel.ts [--seeds=1..12] [--days=50] [--profile=completeness|leaky]
 */
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  createSimContext,
  createWorld,
  DEFAULT_BALANCE,
  simulateDay,
  shipItem,
  settleShipping,
  buyShopItem,
  tileAt,
  type BalanceParams,
  type GameState,
  type PlayerAction,
  type DayInput
} from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem } from '@sim/world/player';
import { getOnboardingObjectiveId, type OnboardingObjectiveId } from '@sim/story/onboarding';

/** 官方新手动线 10 步顺序（须与 src/sim/story/onboarding.ts 的判定链一致）。 */
export const ONBOARDING_ORDER: readonly OnboardingObjectiveId[] = [
  'first-till',
  'first-sow',
  'first-water',
  'first-harvest',
  'first-ship',
  'first-sleep',
  'first-market-restock',
  'first-second-sow',
  'first-second-water',
  'first-loop-complete'
];

export interface OnboardingSession {
  readonly id: string;
  /** 已完整通过的里程碑数（0..10）；10=闭环完成。 */
  readonly maxStep: number;
  readonly finalObjective: OnboardingObjectiveId | null;
  readonly days: number;
}

export interface FunnelStep {
  readonly step: number;
  readonly objectiveId: OnboardingObjectiveId;
  readonly label: string;
  readonly reached: number;
  readonly reachRate: number;
  /** 相对上一步的转化率（首步为 null）。 */
  readonly conversion: number | null;
}

export interface OnboardingFunnel {
  readonly totalSessions: number;
  readonly steps: readonly FunnelStep[];
  readonly overallConversion: number;
  readonly completenessGate: boolean;
}

const STEP_LABELS: Readonly<Record<OnboardingObjectiveId, string>> = {
  'first-till': '翻地',
  'first-sow': '播种',
  'first-water': '浇水',
  'first-harvest': '首收',
  'first-ship': '出货',
  'first-sleep': '过夜结算',
  'first-market-restock': '集市补种',
  'first-second-sow': '二轮播种',
  'first-second-water': '二轮浇水',
  'first-loop-complete': '农务闭环'
};

function maxStepOf(finalObjective: OnboardingObjectiveId | null): number {
  // "到达里程碑 m" = 玩家被指派到第 m 个目标（即已完成前 m-1 步、正处第 m 步）。
  // 故 current=objective[i] ⇒ 已到达里程碑 i+1；'first-loop-complete'（末步）⇒ 10；
  // null（已无可指派，闭环彻底完成）⇒ 10。
  if (finalObjective === null) return ONBOARDING_ORDER.length;
  const idx = ONBOARDING_ORDER.indexOf(finalObjective);
  return idx < 0 ? 0 : idx + 1;
}

/** 纯聚合：把多个 session 的 maxStep 折成漏斗达点率与转化率。可单测。 */
export function computeOnboardingFunnel(sessions: readonly OnboardingSession[]): OnboardingFunnel {
  const total = sessions.length;
  const steps = ONBOARDING_ORDER.map((objectiveId, i) => {
    const stepNumber = i + 1;
    const reached = sessions.filter(s => s.maxStep >= stepNumber).length;
    const reachRate = total > 0 ? reached / total : 0;
    const prevReached = i === 0 ? null : sessions.filter(s => s.maxStep >= i).length;
    const conversion = prevReached === null || prevReached === 0 ? null : reached / prevReached;
    return { step: stepNumber, objectiveId, label: STEP_LABELS[objectiveId], reached, reachRate, conversion };
  });
  const completed = sessions.filter(s => s.maxStep >= ONBOARDING_ORDER.length).length;
  const overallConversion = total > 0 ? completed / total : 0;
  return {
    totalSessions: total,
    steps,
    overallConversion,
    completenessGate: total > 0 && completed === total
  };
}

interface WalkthroughOptions {
  seed: number;
  days: number;
  params?: BalanceParams;
}

/** 单次"专注型新玩家" walkthrough：沿官方动线推进，返回达点记录。 */
export function runOnboardingSession(opts: WalkthroughOptions): OnboardingSession {
  const reg = buildRegistry();
  const state: GameState = createWorld({ seed: opts.seed, width: 8, height: 8, content: reg, params: opts.params ?? DEFAULT_BALANCE });
  const ctx = createSimContext(opts.seed, reg, opts.params ?? DEFAULT_BALANCE);
  state.player.stage = 1 as GameState['player']['stage'];
  mutateItem(state.player, 'seed.mossling', 12);

  const plot = state.tiles.find(t => t.soilType === 'loam' && t.blockType === 'none');
  const at = plot ? { x: plot.x, y: plot.y } : { x: 0, y: 0 };
  let finalObjective: OnboardingObjectiveId | null = null;

  for (let d = 0; d < opts.days; d++) {
    if (state.gameOver) break;
    const actions: PlayerAction[] = [];
    const tile = tileAt(state, at.x, at.y);
    if (tile && tile.blockType === 'none') {
      if (!tile.tilled) actions.push({ kind: 'till', at });
      // 空的已翻地：补播（首轮与二轮共用，触发 first-sow / first-second-sow）。
      if (tile.tilled && tile.cropId == null && itemCount(state.player, 'seed.mossling') > 0) {
        actions.push({ kind: 'sow', at, seedId: 'seed.mossling' });
      }
      if (tile.cropId != null) {
        actions.push({ kind: 'water', at }, { kind: 'channel-qi', at });
        if (state.crops.get(tile.id)?.stage === 'mature') actions.push({ kind: 'harvest', at });
      }
    }
    simulateDay(state, { actions } as DayInput, ctx);

    // 出货 + 日终结算（模拟 app 的出货箱/过夜）：首收后把灵草投入出货箱并结算。
    if (state.player.flags.has('onboarding-first-harvest') && itemCount(state.player, 'herb.mossling') > 0) {
      shipItem(state, 'herb.mossling', itemCount(state.player, 'herb.mossling'), ctx);
    }
    settleShipping(state, ctx);

    // 首次结算后立刻补种（沿官方 onboarding 提示），触发 FIRST_MARKET_RESTOCK_FLAG。
    if (state.player.flags.has('onboarding-first-shipping-settlement') && !state.player.flags.has('onboarding-first-market-restock')) {
      buyShopItem(state, 'seed.mossling', 1);
    }

    finalObjective = getOnboardingObjectiveId(state);
    if (finalObjective === null) break; // 闭环完成
  }

  return {
    id: `seed-${opts.seed}`,
    maxStep: maxStepOf(finalObjective),
    finalObjective,
    days: state.day - 1
  };
}

function formatPct(x: number | null): string {
  if (x === null) return '   —';
  return `${(x * 100).toFixed(0).padStart(3)}%`;
}

/** 解析 --seeds：支持整数 N，或文档中的 1..N 区间（取会话数 N）。 */
function parseSeedCount(raw: string | undefined): number {
  if (!raw) return 10;
  const value = raw.slice('--seeds='.length);
  const range = /^(\d+)\.\.(\d+)$/.exec(value);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (Number.isFinite(from) && Number.isFinite(to) && to >= from) return to - from + 1;
  }
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 10;
}

function main(): void {
  const args = process.argv.slice(2);
  const seedArg = args.find(a => a.startsWith('--seeds='));
  const dayArg = args.find(a => a.startsWith('--days='));
  const profileArg = args.find(a => a.startsWith('--profile='));
  const seedCount = parseSeedCount(seedArg);
  const days = dayArg ? Number(dayArg.slice(7)) : 50;
  const profile = profileArg ? profileArg.slice(9) : 'completeness';

  const sessions: OnboardingSession[] = [];
  for (let i = 1; i <= seedCount; i++) sessions.push(runOnboardingSession({ seed: 1000 + i, days }));

  // leaky 档：在 completeness 之上叠加每步合成流失概率（仅演示报告形态，非真实数据）。
  if (profile === 'leaky') {
    const abandon = [0, 0.08, 0.12, 0.1, 0.15, 0.1, 0.12, 0.08, 0.1, 0.05];
    for (const s of sessions) {
      let cap = s.maxStep;
      for (let step = 1; step <= s.maxStep; step++) {
        if (Math.random() < (abandon[step - 1] ?? 0)) {
          cap = step - 1;
          break;
        }
      }
      (s as { maxStep: number }).maxStep = cap;
    }
  }

  const funnel = computeOnboardingFunnel(sessions);

  console.log(`\n新手漏斗达点率（${seedCount} 个${profile === 'leaky' ? '合成流失' : '专注'}会话，${days} 日预算）${profile === 'leaky' ? '  ⚠ 合成流失，非真实人类数据' : ''}`);
  console.log('─'.repeat(56));
  console.log('步  里程碑        达点   达点率   转化率');
  for (const step of funnel.steps) {
    console.log(
      `${String(step.step).padStart(2)}  ${step.label.padEnd(10)}  ${String(step.reached).padStart(3)}/${funnel.totalSessions}   ${formatPct(step.reachRate)}   ${formatPct(step.conversion)}`
    );
  }
  console.log('─'.repeat(56));
  console.log(`闭环完成率：${formatPct(funnel.overallConversion)}   completeness gate：${funnel.completenessGate ? 'PASS ✓（所有会话均可走通新手动线）' : 'FAIL ✗（存在阻断，需排查）'}`);

  const artifactsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.omc/artifacts');
  mkdirSync(artifactsDir, { recursive: true });
  const report = { profile, seedCount, days, generatedAtNote: 'dev-only experience-gate artifact (not for public release)', funnel, sessions };
  writeFileSync(resolve(artifactsDir, 'onboarding-funnel.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n报告 → .omc/artifacts/onboarding-funnel.json`);

  if (!funnel.completenessGate && profile === 'completeness') process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
