import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { buildPublicDemoAlchemyView, buildPublicDemoTribulationView, buildPublicDemoAftermathView } from '@app/publicDemoPanels';
import { farmActionSuccessToastPresentation } from '@app/actionFeedback';
import { textFitsWidth, UI_COPY_BUDGETS } from '@app/uiCopyBudget';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_HARVEST_FLAG } from '@sim';

describe('UI copy width budgets (overflow soft gate)', () => {
  it('farm success toasts fit toast rail width', () => {
    for (const kind of ['till', 'water', 'harvest', 'channel-qi'] as const) {
      const msg = farmActionSuccessToastPresentation(kind).message;
      expect(textFitsWidth(msg, UI_COPY_BUDGETS.farmToast.fontSize, UI_COPY_BUDGETS.farmToast.maxWidth)).toBe(true);
    }
  });

  it('tutorial alchemy pairing line fits panel budget', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 9, width: 6, height: 6, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(9, content, DEFAULT_BALANCE);
    state.player.flags.add(FIRST_HARVEST_FLAG);
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    const alchemy = buildPublicDemoAlchemyView(state, ctx, 47);
    expect(alchemy.pairingLabel.length).toBeGreaterThan(0);
    expect(
      textFitsWidth(alchemy.pairingLabel, UI_COPY_BUDGETS.alchemyPairing.fontSize, UI_COPY_BUDGETS.alchemyPairing.maxWidth)
    ).toBe(true);
  });

  it('tutorial tribulation labels fit panel budgets in idle/active/aftermath', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 9, width: 6, height: 6, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(9, content, DEFAULT_BALANCE);
    state.player.flags.add(FIRST_HARVEST_FLAG);
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);

    const idle = buildPublicDemoTribulationView(state);
    expect(textFitsWidth(idle.warningLabel, UI_COPY_BUDGETS.tribulationWarning.fontSize, UI_COPY_BUDGETS.tribulationWarning.maxWidth)).toBe(true);
    expect(textFitsWidth(idle.primaryLabel, UI_COPY_BUDGETS.tribulationPrimary.fontSize, UI_COPY_BUDGETS.tribulationPrimary.maxWidth)).toBe(true);

    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    const active = buildPublicDemoTribulationView(state);
    expect(textFitsWidth(active.warningLabel, UI_COPY_BUDGETS.tribulationWarning.fontSize, UI_COPY_BUDGETS.tribulationWarning.maxWidth)).toBe(true);
    expect(textFitsWidth(active.primaryLabel, UI_COPY_BUDGETS.tribulationPrimary.fontSize, UI_COPY_BUDGETS.tribulationPrimary.maxWidth)).toBe(true);

    while (state.tutorialTribulation.phase === 'active') {
      applyAction(state, { kind: 'resolve-tutorial-bolt', perfectBlock: true }, ctx);
    }
    const aftermath = buildPublicDemoAftermathView(state);
    expect(textFitsWidth(aftermath.hitLabel, UI_COPY_BUDGETS.tribulationWarning.fontSize, UI_COPY_BUDGETS.tribulationWarning.maxWidth)).toBe(true);
    expect(textFitsWidth(aftermath.nextLabel, UI_COPY_BUDGETS.tribulationWarning.fontSize, UI_COPY_BUDGETS.tribulationWarning.maxWidth)).toBe(true);
  });
});
