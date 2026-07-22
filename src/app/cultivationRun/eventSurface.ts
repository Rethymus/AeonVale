import type { CultivationEventChoiceDefinition, CultivationEventEffectField, CultivationEventResource } from '@sim/cultivation-run/events';
import type { CultivationRunMachineState } from './machine';
import { CULTIVATION_RESOURCE_LABELS, appendTextElement, cultivationResourceValue, focusableButton, hasCommandModifier, machineErrorMessage, signedValue, type CultivationRunPhaseSurface, type CultivationRunSurfaceDispatch } from './surfaceShared';

export interface CultivationEventSurfaceOptions {
  readonly root: HTMLElement;
  readonly state: CultivationRunMachineState;
  readonly dispatch: CultivationRunSurfaceDispatch;
}

const EVENT_CATEGORY_LABELS = {
  'mortal-life': '人间小事',
  'celestial-omen': '天象异动',
  'thematic-contrast': '世道之间'
} as const;

const EFFECT_LABELS: Readonly<Record<CultivationEventEffectField, string>> = {
  bodyFoundation: '体魄',
  endurance: '耐力',
  willpower: '意志',
  pillPoison: '丹毒',
  heavenDebt: '天债',
  daoAttention: '天道注视',
  pressure: '心压',
  mortalHeart: '凡心',
  insight: '悟痕',
  injury: '伤势',
  herbs: '灵草',
  food: '食物',
  spiritStones: '灵石',
  pills: '丹药'
};

let eventSurfaceSequence = 0;

function costText(choice: CultivationEventChoiceDefinition): string {
  if (choice.costs.length === 0) return '无额外消耗';
  return choice.costs.map(cost => `${CULTIVATION_RESOURCE_LABELS[cost.resource]} −${cost.amount}`).join(' · ');
}

function effectText(choice: CultivationEventChoiceDefinition): string {
  const effects = Object.entries(choice.effects) as [CultivationEventEffectField, number][];
  if (effects.length === 0) return '不改变当前状态';
  return effects.map(([field, value]) => `${EFFECT_LABELS[field]} ${signedValue(value)}`).join(' · ');
}

function firstMissingResource(state: CultivationRunMachineState, choice: CultivationEventChoiceDefinition): { readonly resource: CultivationEventResource; readonly required: number; readonly current: number } | null {
  for (const cost of choice.costs) {
    const current = cultivationResourceValue(state.runState, cost.resource);
    if (current < cost.amount) return { resource: cost.resource, required: cost.amount, current };
  }
  return null;
}

export function createCultivationEventSurface(options: CultivationEventSurfaceOptions): CultivationRunPhaseSurface {
  const { root, dispatch } = options;
  const instanceId = `cultivation-event-${++eventSurfaceSequence}`;
  let state = options.state;
  let feedback = '';
  let feedbackTone: 'neutral' | 'success' | 'error' = 'neutral';
  let destroyed = false;

  root.replaceChildren();
  root.classList.add('cr-event-host');

  const style = document.createElement('style');
  style.textContent = [
    '.cr-event-host{height:100%;min-height:0;overflow:hidden;}',
    '.cr-event{display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;gap:10px;width:min(100%,760px);height:100%;min-height:0;margin:0 auto;padding:clamp(10px,2vw,18px);overflow:hidden;color:var(--color-paperBright);}',
    '.cr-event__header{display:grid;gap:6px;border-inline-start:4px solid var(--color-giltUi);padding-inline-start:14px;}',
    '.cr-event__kicker{margin:0;color:var(--color-giltPale);font-size:12px;letter-spacing:.16em;}',
    '.cr-event__title{margin:0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(24px,5vw,38px);font-weight:600;text-wrap:balance;}',
    '.cr-event__detail{margin:0;color:var(--color-paperUi);line-height:1.75;text-wrap:pretty;}',
    '.cr-event__resources{display:flex;flex-wrap:wrap;gap:6px 12px;margin:0;color:var(--color-paperMuted);font-size:13px;font-variant-numeric:tabular-nums;}',
    '.cr-event__choices{min-height:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;list-style:none;margin:0;padding:1px 4px 1px 1px;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;}',
    '.cr-event__choice{min-width:0;}',
    '.cr-event__button{width:100%;min-height:100%;display:grid;gap:8px;align-content:start;text-align:left;padding:14px;border:1px solid rgb(var(--rgb-paperBorder) / .55);border-radius:4px;background:rgb(var(--rgb-shellPine) / .72);color:var(--color-paperBright);cursor:pointer;touch-action:manipulation;}',
    '.cr-event__button:hover{border-color:var(--color-giltUi);background:rgb(var(--rgb-shellPine) / .9);}',
    '.cr-event__button:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px;}',
    '.cr-event__button[data-affordable="false"]{border-style:dashed;}',
    '.cr-event__button:disabled{cursor:default;opacity:.62;}',
    '.cr-event__choice-label{font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:18px;font-weight:700;}',
    '.cr-event__choice-detail{color:var(--color-paperUi);line-height:1.6;}',
    '.cr-event__instruction{margin:0;padding:8px 10px;border-inline-start:3px solid rgb(var(--rgb-paperBorder) / .72);background:rgb(var(--rgb-shellPine) / .42);color:var(--color-paperUi);font-size:14px;line-height:1.55;}',
    '.cr-event__choice-cost,.cr-event__choice-effect,.cr-event__choice-warning{font-size:13px;line-height:1.5;}',
    '.cr-event__choice-cost{color:var(--color-giltPale);}',
    '.cr-event__choice-effect{color:var(--color-paperMuted);}',
    '.cr-event__choice-warning{color:var(--color-dangerUi);font-weight:700;}',
    '.cr-event__feedback{min-height:1.5em;margin:0;padding:8px 10px;border-inline-start:3px solid var(--color-paperBorder);color:var(--color-paperMuted);line-height:1.5;}',
    '.cr-event__feedback[data-tone="success"]{border-color:var(--color-giltUi);color:var(--color-giltPale);}',
    '.cr-event__feedback[data-tone="error"]{border-color:var(--color-dangerUi);color:var(--color-dangerUi);}',
    '@media(max-width:620px){.cr-event{gap:6px;padding:7px}.cr-event__header{gap:3px}.cr-event__title{font-size:22px}.cr-event__detail{font-size:12px;line-height:1.4}.cr-event__instruction{font-size:11px;padding:5px 7px}.cr-event__choices{grid-template-columns:1fr}.cr-event__button{min-height:auto;padding:9px;gap:4px}.cr-event__feedback{font-size:11px;padding:5px 7px}}'
  ].join('\n');
  root.appendChild(style);

  const section = document.createElement('section');
  section.className = 'cr-event';
  section.setAttribute('aria-labelledby', `${instanceId}-heading`);
  root.appendChild(section);

  const header = document.createElement('header');
  header.className = 'cr-event__header';
  section.appendChild(header);
  const kicker = appendTextElement(header, 'p', 'cr-event__kicker', '');
  const heading = appendTextElement(header, 'h2', 'cr-event__title', '');
  heading.id = `${instanceId}-heading`;
  const detail = appendTextElement(header, 'p', 'cr-event__detail', '');

  const resources = document.createElement('p');
  resources.className = 'cr-event__resources';
  resources.setAttribute('aria-label', '当前可用资源');
  section.appendChild(resources);

  appendTextElement(section, 'p', 'cr-event__instruction', '本步：从两种处置中选一项；代价与变化会立即写入此身记录。');

  const choices = document.createElement('ol');
  choices.className = 'cr-event__choices';
  choices.setAttribute('aria-label', '事件选择');
  section.appendChild(choices);

  const feedbackElement = document.createElement('p');
  feedbackElement.id = `${instanceId}-feedback`;
  feedbackElement.className = 'cr-event__feedback';
  feedbackElement.setAttribute('role', 'status');
  feedbackElement.setAttribute('aria-live', 'polite');
  feedbackElement.setAttribute('aria-atomic', 'true');
  section.appendChild(feedbackElement);

  function choose(choice: CultivationEventChoiceDefinition): void {
    if (destroyed || state.phase !== 'event') return;
    const result = dispatch({ type: 'choose-event', choiceId: choice.id });
    state = result.state;
    if (!result.ok) {
      feedback = machineErrorMessage(result.error);
      feedbackTone = 'error';
    } else {
      feedback = `已选择「${choice.label}」。这一笔会写进此身记录。`;
      feedbackTone = 'success';
    }
    render();
  }

  function render(): void {
    if (destroyed) return;
    const event = state.currentEvent;
    const active = state.phase === 'event' && event !== null;
    kicker.textContent = event ? EVENT_CATEGORY_LABELS[event.category] : '人间一瞬';
    heading.textContent = event?.title ?? '这一轮没有留下可选之事';
    detail.textContent = event?.detail ?? '请返回日程流程重新结算。';
    resources.textContent = [`余寿 ${state.runState.lifespanRemainingDays}`, `食物 ${state.runState.food}`, `灵草 ${state.runState.herbs}`, `灵石 ${state.runState.spiritStones}`, `悟痕 ${state.runState.insight}`, `丹药 ${state.runState.pills}`].join(' · ');

    choices.replaceChildren();
    for (const [index, choice] of (event?.choices ?? []).entries()) {
      const missing = firstMissingResource(state, choice);
      const item = document.createElement('li');
      item.className = 'cr-event__choice';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cr-event__button';
      button.dataset.choiceId = choice.id;
      button.dataset.affordable = String(missing === null);
      button.disabled = !active;
      button.setAttribute('aria-keyshortcuts', String(index + 1));
      const descriptionIds: string[] = [];

      appendTextElement(button, 'span', 'cr-event__choice-label', choice.label);
      appendTextElement(button, 'span', 'cr-event__choice-detail', choice.detail);
      const cost = appendTextElement(button, 'span', 'cr-event__choice-cost', `付出：${costText(choice)}`);
      cost.id = `${instanceId}-choice-${index}-cost`;
      descriptionIds.push(cost.id);
      const effect = appendTextElement(button, 'span', 'cr-event__choice-effect', `变化：${effectText(choice)}`);
      effect.id = `${instanceId}-choice-${index}-effect`;
      descriptionIds.push(effect.id);
      if (missing) {
        const warning = appendTextElement(button, 'span', 'cr-event__choice-warning', `${CULTIVATION_RESOURCE_LABELS[missing.resource]}不足：需要 ${missing.required}，当前 ${missing.current}`);
        warning.id = `${instanceId}-choice-${index}-warning`;
        descriptionIds.push(warning.id);
      }
      button.setAttribute('aria-describedby', descriptionIds.join(' '));
      button.addEventListener('click', () => choose(choice));
      item.appendChild(button);
      choices.appendChild(item);
    }

    if (!feedback && !active) feedback = '事件选择已结束，可继续参悟。';
    feedbackElement.textContent = feedback;
    feedbackElement.dataset.tone = feedbackTone;
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (destroyed || hasCommandModifier(event) || state.phase !== 'event') return;
    if (event.key !== '1' && event.key !== '2') return;
    const choice = state.currentEvent?.choices[Number(event.key) - 1];
    if (!choice) return;
    event.preventDefault();
    choose(choice);
  };
  root.addEventListener('keydown', onKeyDown);

  render();

  return {
    update(nextState): void {
      if (destroyed) return;
      const eventChanged = nextState.currentEvent?.id !== state.currentEvent?.id;
      state = nextState;
      if (eventChanged) {
        feedback = '';
        feedbackTone = 'neutral';
      }
      render();
    },
    focusInitial(): void {
      if (destroyed) return;
      focusableButton(root, '.cr-event__button:not([disabled])')?.focus({ preventScroll: true });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener('keydown', onKeyDown);
      root.classList.remove('cr-event-host');
      root.replaceChildren();
    }
  };
}
