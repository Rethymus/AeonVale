import type { Direction } from '@sim';
import type { GameState, SimContext } from '@sim';
import { buildJourneyGuide, journeyGuideContextFromState, journeyGuideDetailLines } from './journeyGuide';
import { buildPublicDemoAftermathView, buildPublicDemoTribulationView } from './publicDemoPanels';
import { getPublicDemoObjectiveId } from '@sim';

export type PublicDemoPanelAction =
  | { readonly kind: 'take-pill' }
  | { readonly kind: 'tribulation-primary'; readonly perfectBlock?: boolean }
  | { readonly kind: 'move'; readonly direction: Direction };

export interface PublicDemoPanelsController {
  render(state: GameState, ctx: SimContext): void;
  destroy(): void;
}

export interface PublicDemoPanelsOptions {
  readonly root?: ParentNode | null;
  readonly onAction: (action: PublicDemoPanelAction) => void;
}

function defaultRoot(): ParentNode | null {
  return typeof document === 'undefined' ? null : document;
}

function setText(root: ParentNode | null, selector: string, value: string): void {
  const element = root?.querySelector<HTMLElement>(selector) ?? null;
  if (element && element.textContent !== value) element.textContent = value;
}

function setDisabled(root: ParentNode | null, selector: string, disabled: boolean): void {
  const element = root?.querySelector<HTMLButtonElement>(selector) ?? null;
  if (!element) return;
  element.disabled = disabled;
  element.setAttribute('aria-disabled', String(disabled));
}

export function createPublicDemoPanelsController(options: PublicDemoPanelsOptions): PublicDemoPanelsController {
  const root = options.root === undefined ? defaultRoot() : options.root;
  const bindings: Array<{ target: EventTarget; type: string; listener: EventListener }> = [];
  let currentState: GameState | null = null;
  let destroyed = false;

  function renderTribulation(state: GameState): void {
    const view = buildPublicDemoTribulationView(state);
    setText(root, '#flow-tribulation-hp', view.hpLabel);
    setText(root, '#flow-tribulation-pill', view.pillLabel);
    setText(root, '#flow-tribulation-ward', view.wardLabel);
    setText(root, '#flow-tribulation-warning', view.warningLabel);
    setText(root, '#flow-tribulation-position', view.positionLabel);
    setText(root, '#flow-tribulation-last-bolt', view.lastBoltLabel);
    setText(root, '#flow-tribulation-primary', view.primaryLabel);
    setDisabled(root, '#flow-tribulation-primary', view.primaryDisabled);
    setDisabled(root, '#flow-tribulation-pill-action', view.takePillDisabled);
    const primary = root?.querySelector<HTMLButtonElement>('#flow-tribulation-primary') ?? null;
    if (primary) primary.dataset.perfectBlock = view.perfectBlockAvailable ? 'true' : 'false';
    for (const button of Array.from(root?.querySelectorAll<HTMLButtonElement>('[data-demo-action^="move-"]') ?? [])) {
      button.disabled = view.movementDisabled;
      button.setAttribute('aria-disabled', String(view.movementDisabled));
    }
  }

  function renderAftermath(state: GameState): void {
    const view = buildPublicDemoAftermathView(state);
    setText(root, '#flow-aftermath-result-heading', view.heading);
    setText(root, '#flow-aftermath-outcome', view.outcomeLabel);
    setText(root, '#flow-aftermath-hp', view.hpLabel);
    setText(root, '#flow-aftermath-hits', view.hitLabel);
    setText(root, '#flow-aftermath-tempering', view.temperingLabel);
    setText(root, '#flow-aftermath-reward', view.rewardLabel);
    setText(root, '#flow-aftermath-next', view.nextLabel);
    setDisabled(root, '#flow-aftermath-continue', view.continueDisabled);
  }

  function renderJourneyAction(state: GameState): void {
    const guide = buildJourneyGuide(getPublicDemoObjectiveId(state), journeyGuideContextFromState(state));
    setText(root, '#world-journey-action', guide.cta);
    setDisabled(root, '#world-journey-action', guide.completed);
  }

  function renderObjectiveRail(state: GameState): void {
    const guide = buildJourneyGuide(getPublicDemoObjectiveId(state), journeyGuideContextFromState(state));
    const [motivation = '', ctaLine = ''] = journeyGuideDetailLines(guide);
    setText(root, '#objective-rail-progress', guide.progressLabel);
    setText(root, '#objective-rail-primary', guide.currentAction);
    setText(root, '#objective-rail-motivation', motivation);
    setText(root, '#objective-rail-cta', ctaLine);
    const rail = root?.querySelector<HTMLElement>('#objective-rail') ?? null;
    if (rail) {
      rail.dataset.hudDensity = 'compact';
      rail.dataset.journeyStage = guide.stageId;
      rail.dataset.journeyCompleted = guide.completed ? 'true' : 'false';
    }
  }

  function renderCurrentPanels(): void {
    if (!currentState) return;
    renderTribulation(currentState);
    renderAftermath(currentState);
    renderJourneyAction(currentState);
    renderObjectiveRail(currentState);
  }

  function render(state: GameState, _ctx: SimContext): void {
    if (destroyed) return;
    currentState = state;
    renderCurrentPanels();
  }

  for (const button of Array.from(root?.querySelectorAll<HTMLButtonElement>('button[data-demo-action]') ?? [])) {
    const onClick: EventListener = event => {
      if (destroyed || button.disabled) return;
      const action = button.getAttribute('data-demo-action');
      let command: PublicDemoPanelAction | null = null;
      if (action === 'take-pill') command = { kind: 'take-pill' };
      else if (action === 'tribulation-primary') {
        command = { kind: 'tribulation-primary', perfectBlock: button.dataset.perfectBlock === 'true' };
      }
      else if (action === 'move-up' || action === 'move-down' || action === 'move-left' || action === 'move-right') {
        command = { kind: 'move', direction: action.slice('move-'.length) as Direction };
      }
      if (!command) return;
      event.preventDefault();
      options.onAction(command);
      renderCurrentPanels();
    };
    button.addEventListener('click', onClick);
    bindings.push({ target: button, type: 'click', listener: onClick });
  }

  return {
    render,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const binding of bindings) binding.target.removeEventListener(binding.type, binding.listener);
      bindings.length = 0;
      currentState = null;
    }
  };
}
