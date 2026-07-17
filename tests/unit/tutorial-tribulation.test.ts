import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_HARVEST_FLAG, getPublicDemoObjectiveId, placeArray, TUTORIAL_AFTERMATH_VIEWED_FLAG, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG, TUTORIAL_TRIBULATION_BOLT_COUNT, TUTORIAL_TRIBULATION_COMPLETED_FLAG, TUTORIAL_TRIBULATION_REWARD_MILLI, TUTORIAL_TRIBULATION_REWARDED_FLAG } from '@sim';
import { mutateItem } from '@sim/world/player';
import { chebyshev } from '@sim/tribulation/targeting';

function setup(width = 1, height = 1) {
  const content = buildRegistry();
  const state = createWorld({ seed: 17, width, height, content, params: DEFAULT_BALANCE });
  const ctx = createSimContext(17, content, DEFAULT_BALANCE);
  state.player.flags.add(FIRST_HARVEST_FLAG);
  state.player.flags.add(TUTORIAL_ALCHEMY_BREWED_FLAG);
  return { state, ctx };
}

describe('确定性教学天劫', () => {
  it('开场没有可劈格时拒绝启动并恢复 idle', () => {
    const { state, ctx } = setup();
    state.tiles[0]!.blockType = 'building';

    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);

    expect(state.tutorialTribulation).toMatchObject({ phase: 'idle', boltIndex: 0, warnedTileId: null });
    expect(state.events).toEqual([
      {
        type: 'tutorial-tribulation-rejected',
        tick: state.tick,
        day: state.day,
        payload: { reason: 'no-strikeable-tile' }
      }
    ]);
  });

  it('固定三雷、独立 RNG、ward 整场有效，成功奖励只发一次', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'pill.ward-basic', 1);
    applyAction(state, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, ctx);
    expect(state.player.wardMitigation).toBe(0.4);
    const formalLightningBefore = ctx.rng.lightning.snapshot();
    const formalStateBefore = structuredClone(state.tribulation);

    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    for (let index = 0; index < TUTORIAL_TRIBULATION_BOLT_COUNT; index++) {
      applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
      if (index < TUTORIAL_TRIBULATION_BOLT_COUNT - 1) expect(state.player.wardMitigation).toBe(0.4);
    }

    const tutorialEventTypes = state.events.filter(event => event.type.startsWith('tutorial-tribulation')).map(event => event.type);
    expect(tutorialEventTypes).toEqual(['tutorial-tribulation-started', 'tutorial-tribulation-bolt-warned', 'tutorial-tribulation-bolt-resolved', 'tutorial-tribulation-bolt-warned', 'tutorial-tribulation-bolt-resolved', 'tutorial-tribulation-bolt-warned', 'tutorial-tribulation-bolt-resolved', 'tutorial-tribulation-ended']);
    expect(state.tutorialTribulation).toMatchObject({
      phase: 'aftermath',
      boltIndex: 3,
      warnedTileId: null,
      outcome: 'survived',
      rewardMilli: TUTORIAL_TRIBULATION_REWARD_MILLI,
      hits: { direct: 3, rod: 0, miss: 0, blocked: 0, violet: 0 }
    });
    expect(state.player.hp).toBe(60_400);
    expect(state.player.cultivation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);
    expect(state.player.bodyFoundation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);
    expect(state.player.stage).toBe(0);
    expect(state.player.heavenDebt).toBe(0);
    expect(state.player.daoAttention).toBe(0);
    expect(state.player.wardMitigation).toBe(0);
    expect(state.tribulation).toEqual(formalStateBefore);
    expect(ctx.rng.lightning.snapshot()).toBe(formalLightningBefore);
    expect(state.player.flags.has(TUTORIAL_TRIBULATION_COMPLETED_FLAG)).toBe(true);
    expect(state.player.flags.has(TUTORIAL_TRIBULATION_REWARDED_FLAG)).toBe(true);

    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    expect(state.player.cultivation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);

    applyAction(state, { kind: 'acknowledge-tutorial-aftermath' }, ctx);
    expect(state.tutorialTribulation.phase).toBe('idle');
    expect(state.player.flags.has(TUTORIAL_AFTERMATH_VIEWED_FLAG)).toBe(true);
    expect(getPublicDemoObjectiveId(state)).toBe('journey-complete');

    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    expect(state.tutorialTribulation.phase).toBe('idle');
    expect(state.player.cultivation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);
  });

  it('首雷致命也锁存失败并严格完成三次预警与解析后再救回', () => {
    const { state, ctx } = setup();
    state.player.hp = 1;
    const formalLightningBefore = ctx.rng.lightning.snapshot();

    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    for (let index = 0; index < TUTORIAL_TRIBULATION_BOLT_COUNT; index++) {
      applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
      expect(state.gameOver).toBe(false);
      expect(state.ending).toBeNull();
      if (index < TUTORIAL_TRIBULATION_BOLT_COUNT - 1) {
        expect(state.tutorialTribulation).toMatchObject({
          phase: 'active',
          boltIndex: index + 1,
          failureLatched: true
        });
        expect(state.tutorialTribulation.warnedTileId).not.toBeNull();
      }
    }

    expect(state.tutorialTribulation).toMatchObject({
      phase: 'aftermath',
      boltIndex: TUTORIAL_TRIBULATION_BOLT_COUNT,
      failureLatched: true,
      outcome: 'rescued',
      finalHpBeforeRescueMilli: 0,
      rewardMilli: 0,
      hits: { direct: 3, rod: 0, miss: 0, blocked: 0, violet: 0 }
    });
    const tutorialEvents = state.events.filter(event => event.type.startsWith('tutorial-tribulation'));
    expect(tutorialEvents.filter(event => event.type === 'tutorial-tribulation-bolt-warned')).toHaveLength(3);
    expect(tutorialEvents.filter(event => event.type === 'tutorial-tribulation-bolt-resolved')).toHaveLength(3);
    expect(state.player.hp).toBe(50_000);
    expect(state.gameOver).toBe(false);
    expect(state.ending).toBeNull();
    expect(state.player.stage).toBe(0);
    expect(state.player.cultivation).toBe(0);
    expect(state.player.flags.has(TUTORIAL_TRIBULATION_COMPLETED_FLAG)).toBe(false);
    expect(state.player.flags.has(TUTORIAL_TRIBULATION_REWARDED_FLAG)).toBe(false);
    expect(ctx.rng.lightning.snapshot()).toBe(formalLightningBefore);

    applyAction(state, { kind: 'acknowledge-tutorial-aftermath' }, ctx);

    expect(state.tutorialTribulation.phase).toBe('idle');
    expect(state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)).toBe(false);
    expect(state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(true);
    expect(getPublicDemoObjectiveId(state)).toBe('journey-alchemy');
  });

  it('教学劫进行中仍会让猎兽造成的非雷击死亡进入永久结局', () => {
    const { state, ctx } = setup();
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    state.player.hp = 1;
    state.beastSurge = { beastsRemaining: 1, daysLeft: 1 };

    applyAction(state, { kind: 'hunt-beast' }, ctx);

    expect(state.player.hp).toBe(0);
    expect(state.gameOver).toBe(true);
    expect(state.ending).toBe('tribulation-death');
    expect(state.events.at(-1)).toMatchObject({ type: 'ending', payload: { ending: 'tribulation-death' } });
  });

  it('教学雷致命后即使补血也保持失败锁存，第三雷后只救回不领奖', () => {
    const { state, ctx } = setup();
    state.player.hp = 1;
    mutateItem(state.player, 'pill.bone-basic', 2);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);

    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);

    expect(state.player.hp).toBe(1);
    expect(state.tutorialTribulation).toMatchObject({ phase: 'active', boltIndex: 1, failureLatched: true });
    expect([...state.events].reverse().find(event => event.type === 'tutorial-tribulation-bolt-resolved')).toMatchObject({
      payload: { boltIndex: 1, hpAfterMilli: 0 }
    });

    applyAction(state, { kind: 'eat-pill', pillId: 'pill.bone-basic' }, ctx);
    applyAction(state, { kind: 'eat-pill', pillId: 'pill.bone-basic' }, ctx);
    expect(state.player.hp).toBe(60_001);
    while (state.tutorialTribulation.phase === 'active') {
      applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    }

    expect(state.tutorialTribulation).toMatchObject({
      phase: 'aftermath',
      boltIndex: TUTORIAL_TRIBULATION_BOLT_COUNT,
      failureLatched: true,
      outcome: 'rescued',
      rewardMilli: 0
    });
    expect(state.tutorialTribulation.finalHpBeforeRescueMilli).toBeGreaterThan(0);
    expect(state.player.hp).toBe(50_000);
    expect(state.player.cultivation).toBe(0);
    expect(state.player.flags.has(TUTORIAL_TRIBULATION_COMPLETED_FLAG)).toBe(false);
    expect(state.player.flags.has(TUTORIAL_TRIBULATION_REWARDED_FLAG)).toBe(false);
    expect(state.gameOver).toBe(false);
  });

  it('开场后唯一落雷格变为建筑仍复用锁定格完成三次预警与解析', () => {
    const { state, ctx } = setup();
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    const targetTileId = state.tutorialTribulation.warnedTileId;
    state.tiles[0]!.blockType = 'building';

    for (let index = 0; index < TUTORIAL_TRIBULATION_BOLT_COUNT; index++) {
      applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    }

    const tutorialEvents = state.events.filter(event => event.type.startsWith('tutorial-tribulation'));
    const warningEvents = tutorialEvents.filter(event => event.type === 'tutorial-tribulation-bolt-warned');
    expect(warningEvents).toHaveLength(3);
    expect(tutorialEvents.filter(event => event.type === 'tutorial-tribulation-bolt-resolved')).toHaveLength(3);
    for (const event of warningEvents) expect(event).toMatchObject({ payload: { targetTileId } });
    expect(state.tutorialTribulation).toMatchObject({
      phase: 'aftermath',
      boltIndex: TUTORIAL_TRIBULATION_BOLT_COUNT,
      outcome: 'survived'
    });
  });

  it('区内显式擦弹：perfectBlock 将本雷 hitType 定为 blocked 且确定性', () => {
    const { state, ctx } = setup(1, 1);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    expect(state.tutorialTribulation.warnedTileId).not.toBeNull();
    // 1×1 图上玩家必在落点 blast 内
    applyAction(state, { kind: 'resolve-tutorial-bolt', perfectBlock: true }, ctx);
    const resolved = [...state.events].reverse().find(event => event.type === 'tutorial-tribulation-bolt-resolved');
    expect(resolved).toMatchObject({
      payload: {
        hitType: 'blocked',
        perfectBlockAttempted: true,
        perfectBlockApplied: true
      }
    });
    expect(state.tutorialTribulation.hits.blocked).toBe(1);
    // 续解两雷同样擦弹，战后统计可读
    while (state.tutorialTribulation.phase === 'active') {
      applyAction(state, { kind: 'resolve-tutorial-bolt', perfectBlock: true }, ctx);
    }
    expect(state.tutorialTribulation).toMatchObject({
      phase: 'aftermath',
      hits: { blocked: 3, direct: 0, miss: 0, rod: 0 }
    });
  });

  it('区外请求擦弹无效：perfectBlock 不生效，走位 miss 仍成立', () => {
    const { state, ctx } = setup(6, 6);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    const targetTileId = state.tutorialTribulation.warnedTileId;
    const target = state.tiles.find(tile => tile.id === targetTileId)!;
    const safeTile = state.tiles.find(tile => tile.blockType === 'none' && chebyshev(tile, target) > 1)!;
    applyAction(state, { kind: 'move', to: { x: safeTile.x, y: safeTile.y } }, ctx);
    applyAction(state, { kind: 'resolve-tutorial-bolt', perfectBlock: true }, ctx);
    const resolved = [...state.events].reverse().find(event => event.type === 'tutorial-tribulation-bolt-resolved');
    expect(resolved).toMatchObject({
      payload: {
        hitType: 'miss',
        perfectBlockAttempted: true,
        perfectBlockApplied: false
      }
    });
    expect(state.tutorialTribulation.hits.blocked).toBe(0);
  });

  it('锁定预警后，正式走位与引雷阵规则决定本雷结果', () => {
    const { state, ctx } = setup(6, 6);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    const targetTileId = state.tutorialTribulation.warnedTileId;
    const target = state.tiles.find(tile => tile.id === targetTileId)!;
    const safeTile = state.tiles.find(tile => tile.blockType === 'none' && chebyshev(tile, target) > 1)!;
    applyAction(state, { kind: 'move', to: { x: safeTile.x, y: safeTile.y } }, ctx);
    target.tilled = true;
    target.cropId = target.id;
    state.crops.set(target.id, {
      id: target.id,
      defId: 'herb.metalpine',
      tileId: target.id,
      growth: 0,
      health: 100_000,
      stage: 'seed',
      plantedDay: state.day,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });
    expect(placeArray(state, 'array.lightning-rod', target.x, target.y, ctx, { free: true }).placed).toBe(true);
    const rod = [...state.arrays.values()].at(-1)!;

    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);

    expect(state.tutorialTribulation.hits).toMatchObject({ rod: 1, direct: 0, blocked: 0 });
    expect(rod.power).toBe(90);
    expect([...state.events].reverse().find(event => event.type === 'tutorial-tribulation-bolt-resolved')).toMatchObject({
      payload: { targetTileId, hitType: 'rod', damageMilli: 0 }
    });
  });

  it('锁定预警后走出落雷区会通过正式命中判定记为 miss', () => {
    const { state, ctx } = setup(6, 6);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    const targetTileId = state.tutorialTribulation.warnedTileId;
    const target = state.tiles.find(tile => tile.id === targetTileId)!;
    const safeTile = state.tiles.find(tile => tile.blockType === 'none' && chebyshev(tile, target) > 1)!;

    applyAction(state, { kind: 'move', to: { x: safeTile.x, y: safeTile.y } }, ctx);
    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);

    expect(state.tutorialTribulation.hits).toMatchObject({ miss: 1, direct: 0, rod: 0, blocked: 0 });
    expect([...state.events].reverse().find(event => event.type === 'tutorial-tribulation-bolt-resolved')).toMatchObject({
      payload: { targetTileId, hitType: 'miss', damageMilli: 0 }
    });
  });
});
