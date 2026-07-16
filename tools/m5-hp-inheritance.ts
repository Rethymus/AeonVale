/**
 * M6 proxy 校准原型：比较 M5 满血重置与有限治疗/HP 继承的通过率曲线。
 * 该工具只改变 assisted proxy 行为，不改变正式游戏突破回满规则。
 */
import { DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { M5_NORMAL_HP_INHERIT_PROXY_BOT, M5_NORMAL_PROXY_BOT, M5_VETERAN_HP_INHERIT_PROXY_BOT, M5_VETERAN_PROXY_BOT, runSimulation, type BotPolicy } from './headless-run';

function argNumber(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
}

const seeds = Math.floor(argNumber('--seeds', 256));
const seedStart = Math.floor(argNumber('--seed-start', 40_001));
const maxDays = Math.floor(argNumber('--max-days', 2_000));
const multipliers = [1.145, 1.15, 1.155, 1.16, 1.165, 1.17];

function paramsAt(violetDamageMult: number): BalanceParams {
  const params = structuredClone(DEFAULT_BALANCE);
  params.lightning.bolt.violetDamageMult = violetDamageMult;
  return params;
}

function rate(bot: BotPolicy, params: BalanceParams): number {
  let ascended = 0;
  for (let index = 0; index < seeds; index++) {
    if (runSimulation(seedStart + index, bot, params, { maxDays }).ascended) ascended++;
  }
  return ascended / seeds;
}

function maximumStep(values: readonly number[]): number {
  let maximum = 0;
  for (let index = 1; index < values.length; index++) {
    maximum = Math.max(maximum, Math.abs(values[index]! - values[index - 1]!));
  }
  return maximum;
}

const profiles = [
  { name: 'normal-reset', bot: M5_NORMAL_PROXY_BOT },
  ...[0.4, 0.6, 0.8].map(limitedRecoveryRatio => ({
    name: `normal-inherit-${limitedRecoveryRatio}`,
    bot: { ...M5_NORMAL_HP_INHERIT_PROXY_BOT, limitedRecoveryRatio }
  })),
  { name: 'veteran-reset', bot: M5_VETERAN_PROXY_BOT },
  ...[0.4, 0.6, 0.8].map(limitedRecoveryRatio => ({
    name: `veteran-inherit-${limitedRecoveryRatio}`,
    bot: { ...M5_VETERAN_HP_INHERIT_PROXY_BOT, limitedRecoveryRatio }
  }))
];
const curves = profiles.map(({ name, bot }) => {
  const rates = multipliers.map(multiplier => rate(bot, paramsAt(multiplier)));
  return { name, rates, maximumAdjacentStep: maximumStep(rates) };
});

console.log(
  JSON.stringify(
    {
      title: 'M5 HP inheritance proxy prototype',
      limitation: 'Assisted proxy experiment; not a human survival-rate or campaign-duration certification.',
      recoveryRule: 'inherit-limited restores a configured fraction of maxHP before each tribulation and preserves post-tribulation HP ratio after breakthrough.',
      seeds,
      seedStart,
      maxDays,
      parameter: 'lightning.bolt.violetDamageMult',
      multipliers,
      curves,
      normalCandidates: curves.slice(1, 4).map(curve => ({
        name: curve.name,
        measurable: Math.max(...curve.rates) > Math.min(...curve.rates) && Math.max(...curve.rates) > 0,
        smootherThanReset: curve.maximumAdjacentStep < curves[0]!.maximumAdjacentStep
      }))
    },
    null,
    2
  )
);
