import { CULTIVATION_INSIGHT_NODES, type CultivationInsightEffectTag, type CultivationInsightNodeCategory, type CultivationInsightNodeDefinition } from '@sim/cultivation-run/insight';
import type { CultivationRunMachineState } from './machine';
import { appendTextElement, focusableButton, hasCommandModifier, machineErrorMessage, type CultivationRunPhaseSurface, type CultivationRunSurfaceDispatch } from './surfaceShared';

export interface CultivationInsightSurfaceOptions {
  readonly root: HTMLElement;
  readonly state: CultivationRunMachineState;
  readonly dispatch: CultivationRunSurfaceDispatch;
  readonly nodes?: readonly CultivationInsightNodeDefinition[];
}

const INSIGHT_CATEGORY_LABELS: Readonly<Record<CultivationInsightNodeCategory, string>> = {
  'activity-upgrade': '日课批注',
  'array-stone': '阵理',
  'pill-recipe': '丹方',
  'tribulation-intel': '劫兆',
  'narrative-annotation': '前人余声'
};

const INSIGHT_EFFECT_LABELS: Readonly<Record<CultivationInsightEffectTag, string>> = {
  'activity:training:foundation-rhythm': '记下苦练的吐纳与根骨节律',
  'activity:farming:field-breathing': '读懂灵田的五行呼吸',
  'activity:alchemy:clear-furnace': '理清一道稳炉次序',
  'tribulation:block:thunder-guiding-stone': '解锁引雷阵石',
  'tribulation:pill:warding-formula': '天劫前多得一次护持',
  'tribulation:preview:violet-omen': '提高下一劫的预见层级',
  'narrative:annotation:ash-vow': '读到劫灰中未尽的誓言'
};

let insightSurfaceSequence = 0;

function prerequisiteDepth(node: CultivationInsightNodeDefinition, nodesById: ReadonlyMap<string, CultivationInsightNodeDefinition>, visiting = new Set<string>()): number {
  if (node.prerequisiteNodeIds.length === 0 || visiting.has(node.id)) return 0;
  const nextVisiting = new Set(visiting).add(node.id);
  return (
    1 +
    Math.max(
      ...node.prerequisiteNodeIds.map(id => {
        const prerequisite = nodesById.get(id);
        return prerequisite ? prerequisiteDepth(prerequisite, nodesById, nextVisiting) : 0;
      })
    )
  );
}

export function createCultivationInsightSurface(options: CultivationInsightSurfaceOptions): CultivationRunPhaseSurface {
  const { root, dispatch } = options;
  const nodes = options.nodes ?? CULTIVATION_INSIGHT_NODES;
  const nodesById = new Map(nodes.map(node => [node.id, node]));
  const instanceId = `cultivation-insight-${++insightSurfaceSequence}`;
  let state = options.state;
  let feedback = '';
  let feedbackTone: 'neutral' | 'success' | 'error' = 'neutral';
  let destroyed = false;

  root.replaceChildren();
  root.classList.add('cr-insight-host');

  const style = document.createElement('style');
  style.textContent = [
    '.cr-insight-host{container-type:inline-size;}',
    '.cr-insight{display:grid;gap:18px;max-width:1040px;margin:0 auto;padding:clamp(14px,3vw,24px);color:var(--color-paperBright);}',
    '.cr-insight__header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;border-block-end:1px solid rgb(var(--rgb-paperBorder) / .5);padding-block-end:12px;}',
    '.cr-insight__kicker{margin:0;color:var(--color-giltPale);font-size:12px;letter-spacing:.16em;}',
    '.cr-insight__title{margin:4px 0 0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(24px,5vw,38px);font-weight:600;text-wrap:balance;}',
    '.cr-insight__summary{justify-self:end;display:grid;gap:2px;margin:0;border-inline-start:2px solid var(--color-giltUi);padding:6px 0 6px 12px;text-align:right;font-variant-numeric:tabular-nums;}',
    '.cr-insight__summary strong{color:var(--color-giltUi);font-size:20px;}',
    '.cr-insight__summary span{color:var(--color-paperMuted);font-size:12px;}',
    '.cr-insight__lede{margin:0;padding:9px 11px;border-inline-start:3px solid rgb(var(--rgb-paperBorder) / .72);background:rgb(var(--rgb-shellPine) / .38);color:var(--color-paperUi);line-height:1.65;text-wrap:pretty;}',
    '.cr-insight__graph{position:relative;display:grid;grid-template-columns:repeat(5,minmax(140px,1fr));grid-template-rows:repeat(2,minmax(172px,auto));gap:18px 16px;list-style:none;margin:0;padding:12px 0;}',
    '.cr-insight__node{position:relative;min-width:0;}',
    '.cr-insight__node:not(:first-child)::before{content:"";position:absolute;z-index:0;inset-inline-start:-16px;inset-block-start:50%;inline-size:16px;border-block-start:1px solid rgb(var(--rgb-paperBorder) / .58);}',
    '.cr-insight__node:not(:first-child)::after{content:"◆";position:absolute;z-index:2;inset-inline-start:-20px;inset-block-start:calc(50% - 7px);color:rgb(var(--rgb-paperBorder) / .78);font-size:10px;}',
    '.cr-insight__node[data-availability="available"]::before,.cr-insight__node[data-availability="unlocked"]::before{border-color:var(--color-giltUi);}',
    '.cr-insight__node[data-availability="available"]::after,.cr-insight__node[data-availability="unlocked"]::after{color:var(--color-giltUi);}',
    '.cr-insight__node-button{position:relative;z-index:1;width:100%;height:100%;min-height:172px;display:grid;grid-template-rows:auto auto 1fr auto;gap:8px;text-align:left;padding:14px;border:1px solid rgb(var(--rgb-paperBorder) / .55);border-inline-start-width:3px;border-radius:3px;background:linear-gradient(145deg,rgb(var(--rgb-shellPine) / .78),rgb(var(--rgb-shellInk) / .86));color:var(--color-paperBright);cursor:pointer;touch-action:manipulation;}',
    '.cr-insight__node-button:hover{border-color:var(--color-giltUi);}',
    '.cr-insight__node-button:focus-visible,.cr-insight__continue:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px;}',
    '.cr-insight__node-button[aria-pressed="true"]{border-color:var(--color-giltUi);background:linear-gradient(145deg,rgb(var(--rgb-giltUi) / .18),rgb(var(--rgb-shellPine) / .88));box-shadow:inset 0 0 0 1px rgb(var(--rgb-giltUi) / .2);}',
    '.cr-insight__node-button[data-availability="available"]{border-color:var(--color-giltUi);box-shadow:0 0 0 1px rgb(var(--rgb-giltUi) / .18),0 8px 24px rgb(var(--rgb-shellInk) / .28);}',
    '.cr-insight__node-button[data-category="activity-upgrade"]{border-inline-start-color:var(--color-giltUi);}',
    '.cr-insight__node-button[data-category="array-stone"]{border-inline-start-color:var(--color-qiFlow);}',
    '.cr-insight__node-button[data-category="pill-recipe"]{border-inline-start-color:var(--color-purpleBright);}',
    '.cr-insight__node-button[data-category="tribulation-intel"]{border-inline-start-color:var(--color-qiBright);}',
    '.cr-insight__node-button[data-category="narrative-annotation"]{border-inline-start-color:var(--color-paperMuted);}',
    '.cr-insight__node-button[data-availability="locked"]{border-style:dashed;}',
    '.cr-insight__node-button:disabled{cursor:default;opacity:.62;}',
    '.cr-insight__node-category{color:var(--color-giltPale);font-size:13px;letter-spacing:.1em;}',
    '.cr-insight__node-label{font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:20px;font-weight:700;line-height:1.3;}',
    '.cr-insight__node-effect{color:var(--color-paperUi);font-size:14px;line-height:1.55;}',
    '.cr-insight__node-status{color:var(--color-paperMuted);font-size:13px;line-height:1.5;}',
    '.cr-insight__feedback{min-height:1.5em;margin:0;padding:8px 10px;border-inline-start:3px solid var(--color-paperBorder);color:var(--color-paperMuted);line-height:1.5;}',
    '.cr-insight__feedback[data-tone="success"]{border-color:var(--color-giltUi);color:var(--color-giltPale);}',
    '.cr-insight__feedback[data-tone="error"]{border-color:var(--color-dangerUi);color:var(--color-dangerUi);}',
    '.cr-insight__footer{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;}',
    '.cr-insight__hint{margin:0;color:var(--color-paperMuted);font-size:13px;}',
    '.cr-insight__continue{min-block-size:48px;padding:10px 16px;border:1px solid var(--color-giltUi);border-radius:4px;background:rgb(var(--rgb-giltUi) / .14);color:var(--color-giltPale);font-weight:700;cursor:pointer;touch-action:manipulation;}',
    '@container(max-width:760px){.cr-insight__graph{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:none;gap:14px;padding-block:8px}.cr-insight__graph::before{content:"";position:absolute;z-index:0;inset-block:8px;inset-inline-start:50%;inline-size:1px;background:linear-gradient(180deg,transparent,rgb(var(--rgb-paperBorder) / .58) 8% 92%,transparent)}.cr-insight__node{grid-column:auto!important;grid-row:auto!important}.cr-insight__node:not(:first-child)::before{display:block;inset-block-start:20px;inline-size:7px}.cr-insight__node:nth-child(odd)::before{inset-inline-start:auto;inset-inline-end:-7px}.cr-insight__node:nth-child(even)::before{inset-inline-start:-7px}.cr-insight__node:nth-child(odd)::after{inset-inline-start:auto;inset-inline-end:-11px;inset-block-start:14px}.cr-insight__node:nth-child(even)::after{inset-inline-start:-11px;inset-block-start:14px}.cr-insight__node-button{min-height:168px}}',
    '@container(max-width:380px){.cr-insight__header{grid-template-columns:1fr}.cr-insight__summary{justify-self:start;text-align:left}.cr-insight__graph{grid-template-columns:1fr}.cr-insight__graph::before{inset-inline-start:14px}.cr-insight__node:not(:first-child)::before{inset-inline-start:-10px;inset-inline-end:auto;inline-size:10px}.cr-insight__node:nth-child(odd)::after,.cr-insight__node:nth-child(even)::after{inset-inline-start:-14px;inset-inline-end:auto;inset-block-start:14px}.cr-insight__node-button{min-height:auto}}'
  ].join('\n');
  root.appendChild(style);

  const section = document.createElement('section');
  section.className = 'cr-insight';
  section.setAttribute('aria-labelledby', `${instanceId}-heading`);
  root.appendChild(section);

  const header = document.createElement('header');
  header.className = 'cr-insight__header';
  section.appendChild(header);
  const titleGroup = document.createElement('div');
  header.appendChild(titleGroup);
  appendTextElement(titleGroup, 'p', 'cr-insight__kicker', '《偷天换劫诀》· 残卷参悟');
  const heading = appendTextElement(titleGroup, 'h2', 'cr-insight__title', '沿前人留下的线索再走一步');
  heading.id = `${instanceId}-heading`;
  const summary = document.createElement('p');
  summary.className = 'cr-insight__summary';
  const insightValue = appendTextElement(summary, 'strong', '', '');
  const budgetValue = appendTextElement(summary, 'span', '', '');
  header.appendChild(summary);

  appendTextElement(section, 'p', 'cr-insight__lede', '本步：沿残卷脉络参透一页。必须先读懂相邻批注；也可保留悟痕，直接去决定是否引劫。');

  const graph = document.createElement('ol');
  graph.className = 'cr-insight__graph';
  graph.setAttribute('aria-label', '残卷节点图，按拓扑顺序排列');
  section.appendChild(graph);

  const feedbackElement = document.createElement('p');
  feedbackElement.id = `${instanceId}-feedback`;
  feedbackElement.className = 'cr-insight__feedback';
  feedbackElement.setAttribute('role', 'status');
  feedbackElement.setAttribute('aria-live', 'polite');
  feedbackElement.setAttribute('aria-atomic', 'true');
  section.appendChild(feedbackElement);

  const footer = document.createElement('footer');
  footer.className = 'cr-insight__footer';
  section.appendChild(footer);
  appendTextElement(footer, 'p', 'cr-insight__hint', '键盘：方向键在节点间移动，Enter 或 Space 选择。');
  const continueButton = document.createElement('button');
  continueButton.type = 'button';
  continueButton.className = 'cr-insight__continue';
  continueButton.setAttribute('aria-describedby', feedbackElement.id);
  footer.appendChild(continueButton);

  function nodeStatus(node: CultivationInsightNodeDefinition): {
    readonly availability: 'available' | 'locked' | 'unlocked';
    readonly message: string;
  } {
    if (state.insightNodeIds.includes(node.id)) return { availability: 'unlocked', message: '已参透' };
    const missing = node.prerequisiteNodeIds.filter(id => !state.insightNodeIds.includes(id));
    if (missing.length > 0) {
      const labels = missing.map(id => nodesById.get(id)?.label ?? id);
      return { availability: 'locked', message: `需先参透：${labels.join('、')}` };
    }
    if (state.insightBudget.unlockedThisAgenda >= state.insightBudget.maxUnlocksPerAgenda) {
      return { availability: 'locked', message: '本轮参悟次数已用尽' };
    }
    if (state.runState.insight < node.insightCost) {
      return { availability: 'locked', message: `悟痕不足：需要 ${node.insightCost}，当前 ${state.runState.insight}` };
    }
    return { availability: 'available', message: `可参悟 · 消耗 ${node.insightCost} 悟痕` };
  }

  function unlock(node: CultivationInsightNodeDefinition): void {
    if (destroyed || state.phase !== 'insight') return;
    const status = nodeStatus(node);
    if (status.availability !== 'available') {
      feedback = status.message;
      feedbackTone = 'error';
      feedbackElement.textContent = feedback;
      feedbackElement.dataset.tone = feedbackTone;
      return;
    }
    const result = dispatch({ type: 'unlock-insight', targetNodeId: node.id });
    state = result.state;
    if (!result.ok) {
      feedback = machineErrorMessage(result.error);
      feedbackTone = 'error';
    } else {
      feedback = `已参透「${node.label}」。${node.effectTags.map(tag => INSIGHT_EFFECT_LABELS[tag]).join('、')}。`;
      feedbackTone = 'success';
    }
    render();
  }

  function leaveInsight(): void {
    if (destroyed || state.phase !== 'insight') return;
    const result = dispatch({ type: 'leave-insight' });
    state = result.state;
    if (!result.ok) {
      feedback = machineErrorMessage(result.error);
      feedbackTone = 'error';
    } else {
      feedback = '残卷暂合，去看这一轮是否已经值得引劫。';
      feedbackTone = 'success';
    }
    render();
  }

  continueButton.addEventListener('click', leaveInsight);

  function render(): void {
    if (destroyed) return;
    const active = state.phase === 'insight';
    insightValue.textContent = `${state.runState.insight} 悟痕`;
    budgetValue.textContent = `本轮 ${state.insightBudget.unlockedThisAgenda}/${state.insightBudget.maxUnlocksPerAgenda}`;
    graph.replaceChildren();

    for (const [index, node] of nodes.entries()) {
      const status = nodeStatus(node);
      const item = document.createElement('li');
      item.className = 'cr-insight__node';
      item.dataset.availability = status.availability;
      const depth = prerequisiteDepth(node, nodesById);
      item.style.gridColumn = String(Math.min(5, depth + 1));
      item.style.gridRow = depth === 0 || depth >= 3 ? '1 / span 2' : node.id === 'field-breathing' || node.id === 'thunder-guiding-stone' ? '1' : '2';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cr-insight__node-button';
      button.dataset.nodeId = node.id;
      button.dataset.availability = status.availability;
      button.dataset.category = node.category;
      button.disabled = !active;
      button.setAttribute('aria-pressed', String(status.availability === 'unlocked'));
      button.setAttribute('aria-posinset', String(index + 1));
      button.setAttribute('aria-setsize', String(nodes.length));
      const category = appendTextElement(button, 'span', 'cr-insight__node-category', INSIGHT_CATEGORY_LABELS[node.category]);
      category.id = `${instanceId}-node-${index}-category`;
      appendTextElement(button, 'span', 'cr-insight__node-label', node.label);
      const effect = appendTextElement(button, 'span', 'cr-insight__node-effect', node.effectTags.map(tag => INSIGHT_EFFECT_LABELS[tag]).join('、'));
      effect.id = `${instanceId}-node-${index}-effect`;
      const statusElement = appendTextElement(button, 'span', 'cr-insight__node-status', status.message);
      statusElement.id = `${instanceId}-node-${index}-status`;
      button.setAttribute('aria-describedby', `${category.id} ${effect.id} ${statusElement.id}`);
      button.addEventListener('click', () => unlock(node));
      item.appendChild(button);
      graph.appendChild(item);
    }

    const skipped = state.insightBudget.unlockedThisAgenda === 0;
    continueButton.disabled = !active;
    continueButton.textContent = skipped ? '跳过参悟，查看劫兆' : '完成参悟，查看劫兆';
    if (!feedback && !active) feedback = '参悟阶段已结束。';
    feedbackElement.textContent = feedback;
    feedbackElement.dataset.tone = feedbackTone;
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (destroyed || hasCommandModifier(event) || state.phase !== 'insight') return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const target = event.target as Element | null;
    const current = target?.closest<HTMLButtonElement>('.cr-insight__node-button');
    if (!current) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.cr-insight__node-button:not([disabled])'));
    const currentIndex = buttons.indexOf(current);
    if (currentIndex < 0 || buttons.length === 0) return;
    const backwards = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const nextIndex = (currentIndex + (backwards ? -1 : 1) + buttons.length) % buttons.length;
    event.preventDefault();
    buttons[nextIndex]?.focus({ preventScroll: true });
  };
  root.addEventListener('keydown', onKeyDown);

  render();

  return {
    update(nextState): void {
      if (destroyed) return;
      const agendaChanged = nextState.insightBudget.agendaIndex !== state.insightBudget.agendaIndex;
      state = nextState;
      if (agendaChanged) {
        feedback = '';
        feedbackTone = 'neutral';
      }
      render();
    },
    focusInitial(): void {
      if (destroyed) return;
      section.scrollIntoView?.({ block: 'start', behavior: 'auto' });
      focusableButton(root, '.cr-insight__node-button:not([disabled])')?.focus({ preventScroll: true });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener('keydown', onKeyDown);
      root.classList.remove('cr-insight-host');
      root.replaceChildren();
    }
  };
}
