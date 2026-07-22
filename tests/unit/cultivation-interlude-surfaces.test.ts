// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCultivationAftermathSurface } from '@app/cultivationRun/aftermathSurface';
import { createCultivationEndingSurface } from '@app/cultivationRun/endingSurface';
import { createCultivationLifeIntroSurface } from '@app/cultivationRun/lifeIntroSurface';
import { createCultivationRunMachineState, transitionCultivationRunMachine, type CultivationRunMachineAction, type CultivationRunMachineState } from '@app/cultivationRun/machine';
import { createCultivationOmenSurface } from '@app/cultivationRun/omenSurface';
import { createCultivationTribulationChoiceSurface } from '@app/cultivationRun/tribulationChoiceSurface';

function rootElement(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

function choiceState(settledAgendaCount: number): CultivationRunMachineState {
  const initial = createCultivationRunMachineState();
  return {
    ...initial,
    phase: 'tribulation-choice',
    settledAgendaCount,
    tribulationAgendaTarget: 2,
    runState: {
      ...initial.runState,
      herbs: 3,
      pills: 1,
      bodyFoundation: 12,
      endurance: 9,
      willpower: 8
    },
    insightEffectTags: ['tribulation:pill:warding-formula'],
    tribulationTags: ['starting-herb:thunder']
  };
}

function reducerDispatch(initial: CultivationRunMachineState, actions: CultivationRunMachineAction[]) {
  let state = initial;
  return (action: CultivationRunMachineAction) => {
    actions.push(action);
    const result = transitionCultivationRunMachine(state, action);
    state = result.state;
    return result;
  };
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe('D27-f · 一世过场玩家面', () => {
  it('life-intro 展示身份、余寿与传承，并以单次回调进入此世', () => {
    const root = rootElement();
    const onContinue = vi.fn();
    const surface = createCultivationLifeIntroSurface({
      root,
      view: {
        identityName: '陆青禾',
        generation: 2,
        stageLabel: '锻体一阶',
        lifespanRemainingDays: 720,
        premise: '你从劫灰旁拾起残卷，旧锄仍沾着上一世的泥。',
        inheritedMarks: [{ label: '旧锄', value: '开局灵草 +1', tone: 'good' }]
      },
      artwork: {
        assetId: 'cg.prologue.awakening-v1',
        url: 'cg/cg.prologue.awakening-v1.png',
        alt: '陆青禾在破屋中醒来'
      },
      onContinue
    });

    expect(root.querySelector('h2')?.textContent).toBe('陆青禾');
    expect(root.querySelector('.cr-interlude__facts')?.textContent).toContain('720 日');
    expect(root.querySelector('.cr-interlude__list')?.textContent).toContain('旧锄：开局灵草 +1');
    expect(root.querySelector('.cr-interlude__art')?.getAttribute('data-asset-id')).toBe('cg.prologue.awakening-v1');
    expect(root.querySelector('.cr-interlude__art')?.getAttribute('aria-label')).toBe('陆青禾在破屋中醒来');
    expect(root.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');

    const button = root.querySelector<HTMLButtonElement>('.cr-interlude__button')!;
    surface.focusInitial();
    expect(document.activeElement).toBe(root.querySelector('h2'));
    button.click();
    button.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);

    surface.destroy();
    expect(root.childElementCount).toBe(0);
    expect(root.hasAttribute('data-cultivation-interlude-host')).toBe(false);
  });

  it('omen 把目标、已知信息与风险分成可读语义区', () => {
    const root = rootElement();
    const onContinue = vi.fn();
    createCultivationOmenSurface({
      root,
      view: {
        stageLabel: '锻体一阶',
        tribulationName: '青雷洗骨劫',
        objective: '把入体雷威控制在安全区间，并让至少一道雷流经灵田。',
        lifespanRemainingDays: 630,
        knownSigns: ['西北雷源先动', '金阵石可以改变雷路'],
        risks: [
          { label: '雷威过载', detail: '超过安全上限会直接伤及性命。', severity: 'danger' },
          { label: '灵草烧毁', detail: '未导开的雷会灼毁田中灵草。', severity: 'warning' }
        ]
      },
      onContinue
    });

    expect(root.querySelector('h2')?.textContent).toBe('青雷洗骨劫');
    expect(root.querySelector('[aria-label="已知劫兆"]')?.textContent).toContain('金阵石');
    expect(root.querySelectorAll('.cr-omen__risk')).toHaveLength(2);
    expect(root.querySelector('[data-severity="danger"]')?.textContent).toContain('雷威过载');
    expect(root.querySelector('.cr-interlude__status')?.getAttribute('aria-live')).toBe('polite');

    root.querySelector<HTMLButtonElement>('.cr-interlude__button')?.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('tribulation-choice 使用 state + dispatch 决定继续准备或引劫', () => {
    const firstRound = choiceState(1);
    const firstActions: CultivationRunMachineAction[] = [];
    const firstRoot = rootElement();
    createCultivationTribulationChoiceSurface({
      root: firstRoot,
      state: firstRound,
      dispatch: reducerDispatch(firstRound, firstActions)
    });

    const prepare = firstRoot.querySelector<HTMLButtonElement>('[data-choice="prepare"]')!;
    const invoke = firstRoot.querySelector<HTMLButtonElement>('[data-choice="invoke"]')!;
    expect(prepare.disabled).toBe(false);
    expect(invoke.disabled).toBe(false);
    expect(firstRoot.querySelector('.cr-interlude__art')?.getAttribute('data-asset-id')).toBe('cg.first-person.tribulation.purple-v2');
    expect(firstRoot.querySelector('.cr-interlude__facts')?.textContent).toContain('丹药 1 · 灵草 3');
    expect(firstRoot.querySelector('[aria-label="当前备劫结果"]')?.textContent).toContain('护持');
    prepare.click();
    expect(firstActions).toEqual([{ type: 'choose-tribulation-timing', choice: 'prepare' }]);
    expect(prepare.disabled).toBe(true);
    expect(invoke.disabled).toBe(true);

    const forced = choiceState(2);
    const forcedActions: CultivationRunMachineAction[] = [];
    const forcedRoot = rootElement();
    const forcedSurface = createCultivationTribulationChoiceSurface({
      root: forcedRoot,
      state: forced,
      dispatch: reducerDispatch(forced, forcedActions)
    });
    const forcedPrepare = forcedRoot.querySelector<HTMLButtonElement>('[data-choice="prepare"]')!;
    const forcedInvoke = forcedRoot.querySelector<HTMLButtonElement>('[data-choice="invoke"]')!;
    expect(forcedPrepare.disabled).toBe(true);
    expect(forcedRoot.querySelector('.cr-interlude__status')?.textContent).toContain('不能再拖延');
    forcedSurface.focusInitial();
    expect(document.activeElement).toBe(forcedRoot.querySelector('h2'));
    forcedInvoke.click();
    expect(forcedActions).toEqual([{ type: 'choose-tribulation-timing', choice: 'invoke' }]);
  });

  it('aftermath 呈现劫后后果并保留下一阶段回调边界', () => {
    const root = rootElement();
    const onContinue = vi.fn();
    const surface = createCultivationAftermathSurface({
      root,
      view: {
        kind: 'recovery',
        stageLabel: '锻体一阶',
        title: '护脉丹替你接住了最后一道雷',
        detail: '性命保住了，丹药、灵草和伤势都按真实结果留下。',
        consequences: [
          { label: '伤势', value: '+2', tone: 'danger' },
          { label: '丹药', value: '-1', tone: 'warning' }
        ],
        rememberedMoments: ['护脉丹在过载时碎成灰。'],
        nextActionLabel: '带伤补修一轮'
      },
      onContinue
    });

    expect(root.querySelector('.cr-aftermath')?.textContent).toContain('伤势+2');
    expect(root.querySelector('.cr-interlude__fact-value[data-tone="danger"]')?.textContent).toBe('+2');
    const button = root.querySelector<HTMLButtonElement>('.cr-interlude__button')!;
    button.click();
    expect(onContinue).toHaveBeenCalledTimes(1);
    surface.destroy();
    expect(root.classList.contains('cr-aftermath-host')).toBe(false);
  });

  it('ending 使用现有结局资产契约，并分别回调返回标题或再开一世', () => {
    const root = rootElement();
    const onReturnToTitle = vi.fn();
    const onBeginAnotherLife = vi.fn();
    const surface = createCultivationEndingSurface({
      root,
      view: {
        kind: 'unfinished',
        identityName: '沈砚',
        title: '雷停在未写完的一页',
        epilogue: '这一世没有飞升，但有人会在灰中找到他的字。',
        records: [{ label: '最高阶段', value: '锻体三阶' }],
        closingLines: ['旧锄埋在田边。', '残卷仍有一页温热。']
      },
      onReturnToTitle,
      onBeginAnotherLife
    });

    expect(root.querySelector('.cr-interlude__art')?.getAttribute('data-asset-id')).toBe('cg.first-person.scene.farm-autumn-v2');
    expect(root.querySelectorAll<HTMLButtonElement>('.cr-interlude__button')).toHaveLength(2);
    const anotherLife = Array.from(root.querySelectorAll<HTMLButtonElement>('.cr-interlude__button')).find(button => button.textContent === '再开一世')!;
    surface.focusInitial();
    expect(document.activeElement).toBe(root.querySelector('h2'));
    anotherLife.click();
    expect(onBeginAnotherLife).toHaveBeenCalledTimes(1);
    expect(onReturnToTitle).not.toHaveBeenCalled();
    expect(Array.from(root.querySelectorAll<HTMLButtonElement>('.cr-interlude__button')).every(button => button.disabled)).toBe(true);

    const styles = root.querySelector('style')?.textContent ?? '';
    expect(styles).toContain('[data-cultivation-interlude-host]');
    expect(styles).toContain('prefers-reduced-motion:reduce');
    expect(styles).toContain('touch-action:manipulation');
  });
});
