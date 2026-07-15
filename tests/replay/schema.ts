import { z } from 'zod';

const playerActionSchema = z.discriminatedUnion('kind', [
 z.object({ kind: z.literal('move'), to: z.object({ x: z.number().int(), y: z.number().int() }).strict() }).strict(),
 z.object({ kind: z.literal('till'), at: z.object({ x: z.number().int(), y: z.number().int() }).strict() }).strict(),
 z.object({ kind: z.literal('sow'), at: z.object({ x: z.number().int(), y: z.number().int() }).strict(), seedId: z.string() }).strict(),
 z.object({ kind: z.literal('water'), at: z.object({ x: z.number().int(), y: z.number().int() }).strict() }).strict(),
 z.object({ kind: z.literal('channel-qi'), at: z.object({ x: z.number().int(), y: z.number().int() }).strict() }).strict(),
 z.object({ kind: z.literal('harvest'), at: z.object({ x: z.number().int(), y: z.number().int() }).strict() }).strict(),
 z.object({ kind: z.literal('delve-ruin') }).strict(),
 z.object({ kind: z.literal('participate-festival') }).strict(),
 z.object({ kind: z.literal('hunt-beast') }).strict(),
 z.object({ kind: z.literal('feed-guard-beast'), herbItemId: z.string() }).strict(),
 z.object({ kind: z.literal('eat-raw'), herbDefId: z.string() }).strict(),
 z.object({ kind: z.literal('rest') }).strict(),
]);

const balanceParamsSchema = z.object({
 time: z.object({ ticksPerDay: z.number(), daysPerSeason: z.number(), seasonsPerYear: z.number() }).strict(),
 player: z.object({
 stageMaxHp: z.array(z.number()),
 staminaCap: z.number(),
 tillStaminaCost: z.number(),
 waterStaminaCost: z.number(),
 channelStaminaCost: z.number(),
 }).strict(),
 pillPoison: z.object({
 cap: z.number(),
 softCapThreshold: z.number(),
 decayBase: z.number(),
 detoxPillBonusMax: z.number(),
 restBonusMax: z.number(),
 rawEatMultBase: z.number(),
 rawEatMultStageSlope: z.number(),
 poisonResistCap: z.number(),
 }).strict(),
 qi: z.object({
 regenBase: z.number(),
 qiDecayPerDay: z.number(),
 veinMultiplier: z.object({ normal: z.number(), remnant: z.number(), vein: z.number() }).strict(),
 }).strict(),
 growth: z.object({
 qiFactorCap: z.number(),
 qiOptimum: z.number(),
 soilFactorMin: z.number(),
 fertilityOptimum: z.number(),
 fertilityDrain: z.number(),
 baseTillFertility: z.number(),
 continuousPenaltyRate: z.number(),
 rotationRecoverBonus: z.number(),
 overripeDecay: z.number(),
 seasonOptimalBonus: z.number(),
 seasonWeakPenalty: z.number(),
 }).strict(),
 freshness: z.object({ decayPerDay: z.number(), cabinetMultiplier: z.number() }).strict(),
 lightning: z.object({
 targeting: z.object({
 metalAttractCoef: z.number(),
 arrayRedirect: z.number(),
 arrayInsulate: z.number(),
 playerProximityCoef: z.number(),
 noise: z.number(),
 playerTargetBias: z.number(),
 epicenterWeight: z.number(),
 repeatHitWindow: z.number(),
 repeatDecay: z.number(),
 }).strict(),
 damage: z.object({
 base: z.number(),
 stageSlope: z.number(),
 arrayReductionRedirect: z.number(),
 pillMitigationWard: z.number(),
 terrainAmplifyWater: z.number(),
 oneShotProtectMaxStage: z.number(),
 }).strict(),
 tempering: z.object({
 effBase: z.number(),
 effStageSlope: z.number(),
 nearDeathPeak: z.number(),
 nearDeathPeakBand: z.number(),
 nearDeathSafe: z.number(),
 exposureDirect: z.number(),
 exposureInsulated: z.number(),
 exposureRod: z.number(),
 perfectBlockWindow: z.number(),
 perfectBlockQualityBonus: z.number(),
 }).strict(),
 bolt: z.object({
 violetUnlockStage: z.number(),
 violetChanceBase: z.number(),
 violetChanceSlope: z.number(),
 violetDamageMult: z.number(),
 violetTemperingMult: z.number(),
 violetBlastRadius: z.number(),
 }).strict(),
 }).strict(),
 breakthrough: z.object({
 xCap: z.array(z.number()),
 tTribBase: z.number(),
 successBase: z.number(),
 successPrepBonus: z.number(),
 successPoisonPenalty: z.number(),
 successXSurplus: z.number(),
 madnessCap: z.number(),
 harvestCultivationPerTier: z.number(),
 }).strict(),
 celestial: z.object({
 eventGateProbability: z.number(),
 beast: z.object({
 surgeChancePerDay: z.number(),
 countMin: z.number(),
 countMaxBase: z.number(),
 surgeDurationDays: z.number(),
 huntStaminaCost: z.number(),
 huntDamage: z.number(),
 lootChancePerBeast: z.number(),
 seedDropChance: z.number().optional(),
 tameCoreCost: z.number().optional(),
 tameSpiritStoneCost: z.number().optional(),
 guardBeastLimitBase: z.number().optional(),
 guardBeastLimitStageBonus: z.number().optional(),
 guardVigorMax: z.number().optional(),
 guardVigorCostPerBlock: z.number().optional(),
 guardVigorRecoveryPerDay: z.number().optional(),
 guardFeedVigorGain: z.number().optional(),
 guardFeedBondGain: z.number().optional(),
 guardBondMax: z.number().optional(),
 guardBondCostReductionThreshold: z.number().optional(),
 guardVigorCostReduced: z.number().optional(),
 }).strict(),
 }).strict(),
 alchemy: z.object({
 explosionThresholdBase: z.number(),
 explosionThresholdStageSlope: z.number(),
 balanceNorm: z.number(),
 conflictRatio: z.number(),
 }).strict(),
 death: z.object({
 liquidLossFraction: z.number(),
 qiLossFraction: z.number(),
 retainTemperingFraction: z.number(),
 }).strict(),
}).strict();

const gameEventSchema = z.object({
 type: z.string(),
 tick: z.number().int(),
 day: z.number().int(),
 payload: z.unknown().optional(),
}).strict();

export const replayFixtureSchema = z.object({
 schemaVersion: z.literal(1),
 id: z.string().min(1),
 description: z.string().min(1),
 seed: z.union([z.number(), z.string()]),
 world: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict(),
 params: balanceParamsSchema,
 setup: z.object({
 stage: z.number().int().min(0).max(7),
 inventory: z.record(z.number().int()),
 }).strict(),
 saveResumeAfterStep: z.number().int().nonnegative(),
 steps: z.array(z.object({
 actions: z.array(playerActionSchema),
 expected: z.object({
 events: z.array(gameEventSchema),
 stateHash: z.string().regex(/^[0-9a-f]+$/),
 }).strict(),
 }).strict()).min(1),
}).strict().superRefine((fixture, ctx) => {
 if (fixture.saveResumeAfterStep >= fixture.steps.length) {
 ctx.addIssue({
 code: z.ZodIssueCode.custom,
 path: ['saveResumeAfterStep'],
 message: 'must identify a step before the final replay step',
 });
 }
});

export type ReplayFixture = z.infer<typeof replayFixtureSchema>;
