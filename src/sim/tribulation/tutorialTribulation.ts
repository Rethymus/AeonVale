import type { SimContext } from '@sim/world/context';
import { createDefaultTutorialTribulationState, emit, type GameState, type TutorialTribulationHits } from '@sim/world/state';
import { Rng } from '@sim/world/rng';
import { itemCount } from '@sim/world/player';
import { TUTORIAL_AFTERMATH_VIEWED_FLAG, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG, TUTORIAL_TRIBULATION_COMPLETED_FLAG, TUTORIAL_TRIBULATION_REWARDED_FLAG } from '@sim/story/onboarding';
import { pickTarget, strikeableTiles } from './targeting';
import { resolveTribulationBolt } from './tribulationSystem';

export const TUTORIAL_TRIBULATION_BOLT_COUNT = 3;
export const TUTORIAL_TRIBULATION_REWARD_MILLI = 5_000;
export const TUTORIAL_TRIBULATION_STAGE = 1;
const TUTORIAL_RESCUE_HP_RATIO = 0.5;
const TUTORIAL_RNG_SEED = 'aeonvale-public-demo-tribulation-v1';

function ensureTutorialState(state: GameState): GameState['tutorialTribulation'] {
  state.tutorialTribulation ??= createDefaultTutorialTribulationState();
  return state.tutorialTribulation;
}

function selectWarnedTileId(state: GameState, ctx: SimContext, boltIndex: number, fallbackTileId: number | null = null): number | null {
  if (strikeableTiles(state).length === 0) {
    return fallbackTileId != null && state.tiles.some(tile => tile.id === fallbackTileId) ? fallbackTileId : null;
  }
  const rng = new Rng(`${TUTORIAL_RNG_SEED}:target:${boltIndex}`);
  return pickTarget(state, ctx, rng).id;
}

function emitWarningForTarget(state: GameState, targetTileId: number): void {
  const tutorial = ensureTutorialState(state);
  const tile = state.tiles.find(entry => entry.id === targetTileId)!;
  tutorial.warnedTileId = targetTileId;
  emit(state, 'tutorial-tribulation-bolt-warned', {
    boltIndex: tutorial.boltIndex + 1,
    boltCount: TUTORIAL_TRIBULATION_BOLT_COUNT,
    remainingBolts: TUTORIAL_TRIBULATION_BOLT_COUNT - tutorial.boltIndex,
    targetTileId,
    target: { x: tile.x, y: tile.y }
  });
}

function emitWarning(state: GameState, ctx: SimContext, fallbackTileId: number | null = null): boolean {
  const tutorial = ensureTutorialState(state);
  const targetTileId = selectWarnedTileId(state, ctx, tutorial.boltIndex, fallbackTileId);
  if (targetTileId == null) return false;
  emitWarningForTarget(state, targetTileId);
  return true;
}

export function startTutorialTribulation(state: GameState, ctx: SimContext): boolean {
  const tutorial = ensureTutorialState(state);
  const flags = state.player.flags;
  if (state.gameOver || state.player.hp <= 0 || tutorial.phase !== 'idle') return false;
  if (!flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG) || flags.has(TUTORIAL_TRIBULATION_COMPLETED_FLAG)) return false;

  const firstTargetTileId = selectWarnedTileId(state, ctx, 0);
  if (firstTargetTileId == null) {
    emit(state, 'tutorial-tribulation-rejected', { reason: 'no-strikeable-tile' });
    return false;
  }

  state.tutorialTribulation = {
    ...createDefaultTutorialTribulationState(),
    phase: 'active',
    startingHpMilli: state.player.hp
  };
  emit(state, 'tutorial-tribulation-started', {
    boltCount: TUTORIAL_TRIBULATION_BOLT_COUNT,
    hpMilli: state.player.hp,
    maxHpMilli: state.player.maxHp
  });
  emitWarningForTarget(state, firstTargetTileId);
  return true;
}

function addHit(hits: TutorialTribulationHits, hitType: 'direct' | 'rod' | 'miss' | 'blocked', isViolet: boolean): void {
  hits[hitType] += 1;
  if (isViolet) hits.violet += 1;
}

function finalizeTutorialTribulation(state: GameState): void {
  const tutorial = ensureTutorialState(state);
  const flags = state.player.flags;
  const finalHpBeforeRescueMilli = state.player.hp;
  const survived = !tutorial.failureLatched && finalHpBeforeRescueMilli > 0;
  let rewardGranted = false;
  let rewardMilli = 0;

  if (survived) {
    flags.add(TUTORIAL_TRIBULATION_COMPLETED_FLAG);
    if (!flags.has(TUTORIAL_TRIBULATION_REWARDED_FLAG)) {
      flags.add(TUTORIAL_TRIBULATION_REWARDED_FLAG);
      state.player.cultivation += TUTORIAL_TRIBULATION_REWARD_MILLI;
      state.player.bodyFoundation += TUTORIAL_TRIBULATION_REWARD_MILLI;
      rewardGranted = true;
      rewardMilli = TUTORIAL_TRIBULATION_REWARD_MILLI;
    }
  } else {
    const rescueHp = Math.max(1, Math.min(state.player.maxHp, Math.round(state.player.maxHp * TUTORIAL_RESCUE_HP_RATIO)));
    state.player.hp = rescueHp;
  }

  state.player.wardMitigation = 0;
  state.player.temperBoostMult = 1;
  state.player.ironBoneMitigation = 0;
  tutorial.phase = 'aftermath';
  tutorial.warnedTileId = null;
  tutorial.outcome = survived ? 'survived' : 'rescued';
  tutorial.finalHpBeforeRescueMilli = finalHpBeforeRescueMilli;
  tutorial.rewardMilli = rewardMilli;
  emit(state, 'tutorial-tribulation-ended', {
    survived,
    rescued: !survived,
    boltsResolved: tutorial.boltIndex,
    boltCount: TUTORIAL_TRIBULATION_BOLT_COUNT,
    startingHpMilli: tutorial.startingHpMilli,
    finalHpBeforeRescueMilli,
    hpAfterMilli: state.player.hp,
    rawTemperingMilli: Math.round(tutorial.rawTemperingMilli),
    rewardMilli,
    rewardGranted,
    hits: { ...tutorial.hits }
  });
}

export function resolveTutorialTribulationBolt(state: GameState, ctx: SimContext): boolean {
  const tutorial = ensureTutorialState(state);
  if (tutorial.phase !== 'active' || tutorial.warnedTileId == null) return false;

  const targetTileId = tutorial.warnedTileId;
  const rng = new Rng(`${TUTORIAL_RNG_SEED}:resolve:${tutorial.boltIndex}`);
  const bolt = resolveTribulationBolt(
    state,
    {
      stage: TUTORIAL_TRIBULATION_STAGE,
      policy: { blockChance: 0 },
      targetTileId,
      damageModOverride: 1
    },
    ctx,
    rng
  );
  addHit(tutorial.hits, bolt.hitType, bolt.isViolet);
  tutorial.rawTemperingMilli += bolt.rawTemperingMilli;
  tutorial.boltIndex += 1;
  const lethal = bolt.hpAfterMilli <= 0;
  tutorial.failureLatched ||= lethal;
  tutorial.warnedTileId = null;
  emit(state, 'tutorial-tribulation-bolt-resolved', {
    boltIndex: tutorial.boltIndex,
    boltCount: TUTORIAL_TRIBULATION_BOLT_COUNT,
    remainingBolts: Math.max(0, TUTORIAL_TRIBULATION_BOLT_COUNT - tutorial.boltIndex),
    targetTileId,
    hitType: bolt.hitType,
    isViolet: bolt.isViolet,
    damageMilli: bolt.damageMilli,
    hpBeforeMilli: bolt.hpBeforeMilli,
    hpAfterMilli: bolt.hpAfterMilli
  });

  if (tutorial.boltIndex >= TUTORIAL_TRIBULATION_BOLT_COUNT) {
    finalizeTutorialTribulation(state);
    return true;
  }
  if (lethal) state.player.hp = 1;
  if (emitWarning(state, ctx, targetTileId)) return true;

  finalizeTutorialTribulation(state);
  return true;
}

export function acknowledgeTutorialAftermath(state: GameState): boolean {
  const tutorial = ensureTutorialState(state);
  if (tutorial.phase !== 'aftermath') return false;
  const survived = tutorial.outcome === 'survived';
  if (survived) {
    state.player.flags.add(TUTORIAL_AFTERMATH_VIEWED_FLAG);
  } else if (itemCount(state.player, 'pill.ward-basic') <= 0) {
    state.player.flags.delete(TUTORIAL_ALCHEMY_BREWED_FLAG);
    state.player.flags.add(TUTORIAL_ALCHEMY_KIT_FLAG);
  }
  emit(state, 'tutorial-aftermath-acknowledged', {
    survived,
    retryAllowed: !survived,
    next: survived ? 'journey-complete' : itemCount(state.player, 'pill.ward-basic') > 0 ? 'journey-tribulation' : 'journey-alchemy'
  });
  state.tutorialTribulation = createDefaultTutorialTribulationState();
  return true;
}
