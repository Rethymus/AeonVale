// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { createCultivationRunState } from '@sim/cultivation-run/agenda';
import { CULTIVATION_EVENTS } from '@sim/cultivation-run/events';
import { createCultivationRunMachineState, transitionCultivationRunMachine, type CultivationRunMachineAction, type CultivationRunMachineState, type CultivationRunMachineTransition } from '@app/cultivationRun/machine';
import { createCultivationEventSurface } from '@app/cultivationRun/eventSurface';
import { createCultivationInsightSurface } from '@app/cultivationRun/insightSurface';

const NEIGHBOR_PORRIDGE = CULTIVATION_EVENTS.find(event => event.id === 'neighbor-porridge')!;

function rootElement(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

function eventMachine(food = 4): CultivationRunMachineState {
  const initial = createCultivationRunMachineState(
    createCultivationRunState({
      seed: 17,
      overrides: { food, lifespanRemainingDays: 40, insight: 8, spiritStones: 3 }
    })
  );
  return { ...initial, phase: 'event', currentEvent: NEIGHBOR_PORRIDGE, settledAgendaCount: 1 };
}

function insightMachine(
  input: {
    readonly insight?: number;
    readonly settledAgendaCount?: number;
    readonly tribulationAgendaTarget?: number;
  } = {}
): CultivationRunMachineState {
  const initial = createCultivationRunMachineState(createCultivationRunState({ seed: 29, overrides: { insight: input.insight ?? 12 } }));
  return {
    ...initial,
    phase: 'insight',
    settledAgendaCount: input.settledAgendaCount ?? 1,
    tribulationAgendaTarget: input.tribulationAgendaTarget ?? 2
  };
}

function reducerDispatch(initial: CultivationRunMachineState, actions: CultivationRunMachineAction[]): (action: CultivationRunMachineAction) => CultivationRunMachineTransition {
  let state = initial;
  return action => {
    actions.push(action);
    const result = transitionCultivationRunMachine(state, action);
    state = result.state;
    return result;
  };
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('D27-c 事件玩家面', () => {
  it('以原生双选按钮呈现资源、成本、结果与 live feedback，并能恢复首项焦点', () => {
    const state = eventMachine();
    const actions: CultivationRunMachineAction[] = [];
    const root = rootElement();
    const surface = createCultivationEventSurface({
      root,
      state,
      dispatch: reducerDispatch(state, actions)
    });

    expect(root.querySelector('h2')?.textContent).toBe('门槛上的热粥');
    expect(root.querySelectorAll<HTMLButtonElement>('.cr-event__button')).toHaveLength(2);
    expect(root.querySelector('.cr-event__resources')?.textContent).toContain('食物 4');
    expect(root.querySelector('.cr-event__instruction')?.textContent).toContain('代价与变化会立即写入此身记录');
    expect(root.querySelector('.cr-event__choice-cost')?.textContent).toContain('食物 −1');
    expect(root.querySelector('.cr-event__choice-effect')?.textContent).toContain('心压 -8');
    expect(root.querySelector('.cr-event__feedback')?.getAttribute('role')).toBe('status');
    expect(root.querySelector('.cr-event__feedback')?.getAttribute('aria-live')).toBe('polite');
    expect(root.querySelector('.cr-event__feedback')?.getAttribute('aria-atomic')).toBe('true');

    surface.focusInitial();
    expect(document.activeElement).toBe(root.querySelector('.cr-event__button'));

    root.querySelector<HTMLButtonElement>('[data-choice-id="return-grain"]')?.click();
    expect(actions).toEqual([{ type: 'choose-event', choiceId: 'return-grain' }]);
    expect(root.querySelector('.cr-event__feedback')?.textContent).toContain('已选择「回一捧留种粮」');
    expect(root.querySelector('.cr-event__feedback')?.getAttribute('data-tone')).toBe('success');
    expect(root.querySelectorAll<HTMLButtonElement>('.cr-event__button')[0]?.disabled).toBe(true);

    surface.destroy();
    expect(root.childElementCount).toBe(0);
  });

  it('资源不足时保留可聚焦选择，派发 reducer 并给出可行动错误', () => {
    const state = eventMachine(0);
    const actions: CultivationRunMachineAction[] = [];
    const root = rootElement();
    createCultivationEventSurface({ root, state, dispatch: reducerDispatch(state, actions) });

    const choice = root.querySelector<HTMLButtonElement>('[data-choice-id="return-grain"]')!;
    expect(choice.disabled).toBe(false);
    expect(choice.dataset.affordable).toBe('false');
    expect(choice.textContent).toContain('食物不足：需要 1，当前 0');
    expect(choice.getAttribute('aria-describedby')).toContain('warning');

    choice.click();
    expect(actions).toEqual([{ type: 'choose-event', choiceId: 'return-grain' }]);
    expect(root.querySelector('.cr-event__feedback')?.textContent).toBe('食物不足，请换一个选择。');
    expect(root.querySelector('.cr-event__feedback')?.getAttribute('data-tone')).toBe('error');
  });

  it('数字快捷键可触发第二项，且声明 aria-keyshortcuts', () => {
    const state = eventMachine();
    const actions: CultivationRunMachineAction[] = [];
    const root = rootElement();
    createCultivationEventSurface({ root, state, dispatch: reducerDispatch(state, actions) });

    expect(root.querySelectorAll<HTMLButtonElement>('.cr-event__button')[1]?.getAttribute('aria-keyshortcuts')).toBe('2');
    root.dispatchEvent(new KeyboardEvent('keydown', { key: '2', bubbles: true, cancelable: true }));
    expect(actions).toEqual([{ type: 'choose-event', choiceId: 'repair-roof' }]);
  });
});

describe('D27-c 参悟玩家面', () => {
  it('呈现全部 7 节点拓扑、前置关系、成本与可读状态', () => {
    const state = insightMachine();
    const root = rootElement();
    const surface = createCultivationInsightSurface({ root, state, dispatch: reducerDispatch(state, []) });
    const nodes = root.querySelectorAll<HTMLButtonElement>('.cr-insight__node-button');

    expect(nodes).toHaveLength(7);
    expect(root.querySelector('[data-node-id="foundation-rhythm"]')?.textContent).toContain('可参悟 · 消耗 2 悟痕');
    expect(root.querySelector('[data-node-id="field-breathing"]')?.textContent).toContain('需先参透：吐纳记骨');
    expect(root.querySelector('[data-node-id="violet-omen-rubbing"]')?.textContent).toContain('引雷阵石、护脉丹方');
    expect(root.querySelector('.cr-insight__graph')?.getAttribute('aria-label')).toContain('拓扑顺序');
    expect(root.querySelector('.cr-insight__lede')?.textContent).toContain('沿残卷脉络参透一页');
    expect(root.querySelector('[data-node-id="foundation-rhythm"]')?.parentElement?.dataset.availability).toBe('available');
    expect(root.querySelector('[data-node-id="foundation-rhythm"]')?.parentElement?.style.gridColumn).toBe('1');
    expect(root.querySelector('[data-node-id="ash-annotated-vow"]')?.parentElement?.style.gridColumn).toBe('5');
    expect(root.querySelector('.cr-insight__feedback')?.getAttribute('aria-live')).toBe('polite');

    surface.focusInitial();
    expect(document.activeElement).toBe(nodes[0]);
    nodes[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(nodes[1]);
  });

  it('解锁一个节点后立即锁定本轮预算，不允许第二次消耗', () => {
    const state = insightMachine();
    const actions: CultivationRunMachineAction[] = [];
    const root = rootElement();
    createCultivationInsightSurface({ root, state, dispatch: reducerDispatch(state, actions) });

    root.querySelector<HTMLButtonElement>('[data-node-id="foundation-rhythm"]')?.click();
    expect(actions).toEqual([{ type: 'unlock-insight', targetNodeId: 'foundation-rhythm' }]);
    expect(root.querySelector('[data-node-id="foundation-rhythm"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.cr-insight__summary')?.textContent).toContain('本轮 1/1');
    expect(root.querySelector('.cr-insight__feedback')?.textContent).toContain('已参透「吐纳记骨」');

    root.querySelector<HTMLButtonElement>('[data-node-id="field-breathing"]')?.click();
    expect(actions).toHaveLength(1);
    expect(root.querySelector('.cr-insight__feedback')?.textContent).toBe('本轮参悟次数已用尽');
  });

  it('悟痕不足时不派发解锁，但节点仍可聚焦并解释修复方向', () => {
    const state = insightMachine({ insight: 0 });
    const actions: CultivationRunMachineAction[] = [];
    const root = rootElement();
    createCultivationInsightSurface({ root, state, dispatch: reducerDispatch(state, actions) });

    const node = root.querySelector<HTMLButtonElement>('[data-node-id="foundation-rhythm"]')!;
    expect(node.disabled).toBe(false);
    node.focus();
    expect(document.activeElement).toBe(node);
    node.click();
    expect(actions).toEqual([]);
    expect(root.querySelector('.cr-insight__feedback')?.textContent).toBe('悟痕不足：需要 2，当前 0');
  });

  it('未解锁时统一进入引劫时机选择，由下一过场决定继续日课或引劫', () => {
    const planningState = insightMachine({ settledAgendaCount: 1, tribulationAgendaTarget: 2 });
    const planningActions: CultivationRunMachineAction[] = [];
    const planningRoot = rootElement();
    createCultivationInsightSurface({
      root: planningRoot,
      state: planningState,
      dispatch: reducerDispatch(planningState, planningActions)
    });
    const planningContinue = planningRoot.querySelector<HTMLButtonElement>('.cr-insight__continue')!;
    expect(planningContinue.textContent).toBe('跳过参悟，查看劫兆');
    planningContinue.click();
    expect(planningActions).toEqual([{ type: 'leave-insight' }]);

    const tribulationState = insightMachine({ settledAgendaCount: 2, tribulationAgendaTarget: 2 });
    const tribulationActions: CultivationRunMachineAction[] = [];
    const tribulationRoot = rootElement();
    createCultivationInsightSurface({
      root: tribulationRoot,
      state: tribulationState,
      dispatch: reducerDispatch(tribulationState, tribulationActions)
    });
    const tribulationContinue = tribulationRoot.querySelector<HTMLButtonElement>('.cr-insight__continue')!;
    expect(tribulationContinue.textContent).toBe('跳过参悟，查看劫兆');
    tribulationContinue.click();
    expect(tribulationActions).toEqual([{ type: 'leave-insight' }]);
  });
});
