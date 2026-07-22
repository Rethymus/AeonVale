import type { AssetId } from '@io/assets';
import type { CultivationRunMachineState } from './machine';
import { appendCultivationFacts, appendCultivationList, appendCultivationStatus, createCultivationInterludeFrame, type CultivationInterludeArtwork } from './interludeSurfaceShared';
import { machineErrorMessage, type CultivationRunPhaseSurface, type CultivationRunSurfaceDispatch } from './surfaceShared';

export const CULTIVATION_TRIBULATION_CHOICE_ART_ASSET_ID: AssetId = 'cg.first-person.tribulation.purple-v2';

export interface CultivationTribulationChoiceSurfaceOptions {
  readonly root: HTMLElement;
  readonly state: CultivationRunMachineState;
  readonly dispatch: CultivationRunSurfaceDispatch;
  readonly artwork?: CultivationInterludeArtwork;
}

function preparationNotes(state: CultivationRunMachineState): string[] {
  const notes: string[] = [];
  if (state.runState.pills > 0) notes.push(`丹药 ${state.runState.pills}：可在天劫中启用护持。`);
  if (state.runState.herbs > 0) notes.push(`灵草 ${state.runState.herbs}：会参与阵地与劫后损耗。`);
  if (state.insightEffectTags.length > 0) notes.push(`已参透 ${state.insightEffectTags.length} 项残卷批注。`);
  if (state.tribulationTags.length > 0) notes.push(`事件留下 ${state.tribulationTags.length} 项天劫影响。`);
  return notes;
}

export function createCultivationTribulationChoiceSurface(options: CultivationTribulationChoiceSurfaceOptions): CultivationRunPhaseSurface {
  const { root, dispatch } = options;
  let state = options.state;
  let feedback = '';
  let destroyed = false;
  let dispatching = false;

  const frame = createCultivationInterludeFrame({
    root,
    hostClass: 'cr-tribulation-choice-host',
    sectionClass: 'cr-tribulation-choice',
    phaseMark: '劫',
    phaseLabel: '引劫之问',
    kicker: '劫兆已近 · 准备就此作数',
    title: '现在引劫，还是再借一轮人间？',
    lede: '早引劫能少耗余寿，却要接受当前准备；继续日课可以补足短板，但天道不会无限等待。',
    artwork: options.artwork ?? {
      assetId: CULTIVATION_TRIBULATION_CHOICE_ART_ASSET_ID,
      alt: '紫色天劫在灵田上空聚拢，等待玩家决定何时引落',
      caption: '这一问决定准备到此为止，还是再押上一轮余寿',
      objectPosition: 'center 42%'
    },
    extraStyles: [
      '[data-cultivation-interlude-host] .cr-tribulation-choice .cr-interlude__rail{position:relative;border-color:var(--color-qiFlow);}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice .cr-interlude__rail::after{content:"";position:absolute;inset-inline-end:-2px;inset-block:16% 12%;inline-size:3px;background:linear-gradient(155deg,transparent 0 18%,var(--color-qiFlow) 18% 27%,transparent 27% 43%,var(--color-qiFlow) 43% 54%,transparent 54% 69%,var(--color-qiFlow) 69% 78%,transparent 78%);opacity:.8;}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice .cr-interlude__mark{border-color:var(--color-qiFlow);box-shadow:0 0 0 5px rgb(var(--rgb-qiFlow) / .1);}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__button{min-block-size:118px;display:grid;gap:7px;align-content:start;text-align:left;padding:14px;border:1px solid rgb(var(--rgb-paperBorder) / .58);border-radius:4px;background:rgb(var(--rgb-shellPine) / .66);color:var(--color-paperBright);cursor:pointer;touch-action:manipulation;}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__button[data-choice="invoke"]{border-color:var(--color-qiFlow);background:rgb(var(--rgb-qiFlow) / .1);}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__button:hover:not(:disabled){border-color:var(--color-giltUi);}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__button:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px;}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__button:disabled{cursor:default;opacity:.58;}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__label{font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:21px;font-weight:700;}',
      '[data-cultivation-interlude-host] .cr-tribulation-choice__detail{color:var(--color-paperUi);font-size:14px;line-height:1.55;}',
      '@container(max-width:520px){[data-cultivation-interlude-host] .cr-tribulation-choice__choices{grid-template-columns:1fr}[data-cultivation-interlude-host] .cr-tribulation-choice__button{min-block-size:auto}}'
    ]
  });

  const factsHost = document.createElement('div');
  frame.copy.appendChild(factsHost);
  const notesHost = document.createElement('div');
  frame.copy.appendChild(notesHost);
  const choices = document.createElement('div');
  choices.className = 'cr-tribulation-choice__choices';
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', '选择引劫时机');
  frame.copy.appendChild(choices);

  function choiceButton(choice: 'prepare' | 'invoke', label: string, detail: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cr-tribulation-choice__button';
    button.dataset.choice = choice;
    const labelElement = document.createElement('span');
    labelElement.className = 'cr-tribulation-choice__label';
    labelElement.textContent = label;
    const detailElement = document.createElement('span');
    detailElement.className = 'cr-tribulation-choice__detail';
    detailElement.textContent = detail;
    button.append(labelElement, detailElement);
    choices.appendChild(button);
    return button;
  }

  const prepareButton = choiceButton('prepare', '再备一轮', '回到六格日课，继续补资源、降心压或参悟残卷。');
  const invokeButton = choiceButton('invoke', '现在引劫', '以此刻的身体、护持和阵地进入天劫。');
  const status = appendCultivationStatus(frame.actions, `${frame.section.getAttribute('aria-labelledby')}-status`, '');
  prepareButton.setAttribute('aria-describedby', status.id);
  invokeButton.setAttribute('aria-describedby', status.id);

  function choose(choice: 'prepare' | 'invoke'): void {
    if (destroyed || dispatching || state.phase !== 'tribulation-choice') return;
    dispatching = true;
    const result = dispatch({ type: 'choose-tribulation-timing', choice });
    state = result.state;
    feedback = result.ok ? (choice === 'prepare' ? '已把引劫压后一轮，返回日课。' : '准备封卷，天劫将至。') : machineErrorMessage(result.error);
    dispatching = false;
    render();
  }

  const onPrepareClick = (): void => choose('prepare');
  const onInvokeClick = (): void => choose('invoke');
  prepareButton.addEventListener('click', onPrepareClick);
  invokeButton.addEventListener('click', onInvokeClick);

  function render(): void {
    if (destroyed) return;
    const active = state.phase === 'tribulation-choice';
    const canPrepare = active && state.settledAgendaCount < state.tribulationAgendaTarget;
    const earliestInvocationAgenda = Math.max(1, state.tribulationAgendaTarget - 1);
    const canInvoke = active && state.settledAgendaCount >= earliestInvocationAgenda;
    const remaining = Math.max(0, state.tribulationAgendaTarget - state.settledAgendaCount);

    factsHost.replaceChildren();
    appendCultivationFacts(factsHost, [
      { label: '已备日课', value: `${state.settledAgendaCount}/${state.tribulationAgendaTarget} 轮`, tone: remaining === 0 ? 'danger' : 'warning' },
      { label: '承雷根底', value: `体魄 ${state.runState.bodyFoundation} · 耐力 ${state.runState.endurance} · 意志 ${state.runState.willpower}` },
      { label: '护持资源', value: `丹药 ${state.runState.pills} · 灵草 ${state.runState.herbs}`, tone: state.runState.pills > 0 ? 'good' : 'neutral' },
      { label: '天道压力', value: `天债 ${state.runState.heavenDebt} · 注视 ${state.runState.daoAttention}`, tone: 'warning' }
    ]);
    notesHost.replaceChildren();
    appendCultivationList(notesHost, preparationNotes(state), '尚无明确护持，天劫只会检验当前根底。').setAttribute('aria-label', '当前备劫结果');

    prepareButton.disabled = !canPrepare;
    invokeButton.disabled = !canInvoke;
    if (feedback) status.textContent = feedback;
    else if (!active) status.textContent = '引劫时机已经选定。';
    else if (!canPrepare) status.textContent = '天道催讨已至，不能再拖延；只能以当前准备引劫。';
    else if (!canInvoke) status.textContent = `至少还需完成 ${earliestInvocationAgenda - state.settledAgendaCount} 轮日课，才能主动引劫。`;
    else status.textContent = `还可再准备 ${remaining} 轮；现在引劫也已开放。`;
  }

  render();

  return {
    update(nextState): void {
      if (destroyed) return;
      state = nextState;
      feedback = '';
      render();
    },
    focusInitial(): void {
      frame.section.scrollIntoView?.({ block: 'start', behavior: 'auto' });
      frame.heading.focus({ preventScroll: true });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      prepareButton.removeEventListener('click', onPrepareClick);
      invokeButton.removeEventListener('click', onInvokeClick);
      frame.destroy();
    }
  };
}
