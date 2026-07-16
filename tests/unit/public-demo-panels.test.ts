import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { buildPublicDemoAftermathView, buildPublicDemoAlchemyView, buildPublicDemoTribulationView } from '@app/publicDemoPanels';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_HARVEST_FLAG } from '@sim';

function setup(width = 6, height = 6) {
  const content = buildRegistry();
  const state = createWorld({ seed: 43, width, height, content, params: DEFAULT_BALANCE });
  const ctx = createSimContext(43, content, DEFAULT_BALANCE);
  state.player.flags.add(FIRST_HARVEST_FLAG);
  return { state, ctx };
}

describe('public demo panel view models', () => {
  it('shows the formal tutorial recipe, live heat preview, retry, and completed CTA', () => {
    const { state, ctx } = setup();
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);

    const cold = buildPublicDemoAlchemyView(state, ctx, 0);
    expect(cold.recipeName).toBe('避雷丹方');
    expect(cold.materials).toEqual([
      { name: '雷击木', quantity: 1 },
      { name: '寒潭莲', quantity: 1 }
    ]);
    expect(cold.idealHeatLabel).toBe('40–55%');
    expect(cold.previewLabel).toContain('药渣');
    expect(cold.primaryLabel).toBe('炼制备劫丹');
    expect(cold.primaryDisabled).toBe(false);

    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 0 }, ctx);
    expect(buildPublicDemoAlchemyView(state, ctx, 0)).toMatchObject({ primaryLabel: '重新炼制', brewed: false });

    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);
    expect(buildPublicDemoAlchemyView(state, ctx, 47)).toMatchObject({ primaryLabel: '携丹返回农庄', primaryDisabled: false, brewed: true });
  });

  it('exposes pill, warning, position, movement, and per-bolt result state', () => {
    const { state, ctx } = setup();
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);

    expect(buildPublicDemoTribulationView(state)).toMatchObject({
      phase: 'idle',
      pillLabel: '避雷丹 ×1',
      takePillDisabled: false,
      movementDisabled: true,
      primaryLabel: '开始三雷教学'
    });

    applyAction(state, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, ctx);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    const active = buildPublicDemoTribulationView(state);
    expect(active.phase).toBe('active');
    expect(active.wardLabel).toContain('40%');
    expect(active.warningLabel).toContain('第 1/3 雷');
    expect(active.movementDisabled).toBe(false);

    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    expect(buildPublicDemoTribulationView(state).lastBoltLabel).toContain('第 1 雷');
  });

  it('turns the persisted aftermath summary into readable losses, hits, reward, and next action', () => {
    const { state, ctx } = setup(1, 1);
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);
    applyAction(state, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, ctx);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    while (state.tutorialTribulation.phase === 'active') applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);

    const view = buildPublicDemoAftermathView(state);
    expect(view.heading).toBe('三雷已过');
    expect(view.outcomeLabel).toContain('正式境界保持不变');
    expect(view.hitLabel).toContain('正面 3');
    expect(view.rewardLabel).toContain('+5');
    expect(view.continueDisabled).toBe(false);
  });
});
