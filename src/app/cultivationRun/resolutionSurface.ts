import { CULTIVATION_ACTIVITY_LABELS, type CultivationActivityDelta } from '@sim/cultivation-run';
import type { CultivationRunMachineState } from './machine';
import { appendTextElement, machineErrorMessage, signedValue, type CultivationRunPhaseSurface, type CultivationRunSurfaceDispatch } from './surfaceShared';

export interface CultivationResolutionSurfaceOptions {
  readonly root: HTMLElement;
  readonly state: CultivationRunMachineState;
  readonly dispatch: CultivationRunSurfaceDispatch;
}

const DELTA_LABELS: Readonly<Record<keyof CultivationActivityDelta, string>> = {
  lifespanRemainingDays: '余寿',
  bodyFoundation: '体魄',
  endurance: '耐力',
  willpower: '意志',
  pillPoison: '丹毒',
  pressure: '心压',
  mortalHeart: '凡心',
  insight: '悟痕',
  injury: '伤势',
  herbs: '灵草',
  food: '食物',
  spiritStones: '灵石',
  pills: '丹药'
};

function deltaText(delta: CultivationActivityDelta): string {
  return (Object.entries(delta) as [keyof CultivationActivityDelta, number][])
    .filter(([, value]) => value !== 0)
    .map(([field, value]) => `${DELTA_LABELS[field]} ${signedValue(value)}`)
    .join(' · ') || '本格没有数值变化';
}

export function createCultivationResolutionSurface(
  options: CultivationResolutionSurfaceOptions
): CultivationRunPhaseSurface {
  const { root, dispatch } = options;
  let state = options.state;
  let destroyed = false;
  root.replaceChildren();

  const style = document.createElement('style');
  style.textContent = [
    '.cr-resolution{display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:8px;width:min(100%,920px);height:100%;min-height:0;margin:0 auto;padding:clamp(8px,2vw,16px);overflow:hidden;color:var(--color-paperBright);}',
    '.cr-resolution__kicker{margin:0;color:var(--color-giltPale);font-size:12px;letter-spacing:.16em;}',
    '.cr-resolution__title{margin:0;font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:clamp(24px,5vw,38px);font-weight:600;}',
    '.cr-resolution__lede{margin:0;color:var(--color-paperUi);line-height:1.65;}',
    '.cr-resolution__slots{min-height:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:repeat(2,minmax(0,1fr));gap:7px;list-style:none;margin:0;padding:0;overflow:hidden;}',
    '.cr-resolution__slot{min-height:0;display:grid;align-content:center;gap:4px;padding:8px;border:1px solid rgb(var(--rgb-paperBorder) / .55);background:rgb(var(--rgb-shellPine) / .72);overflow:hidden;}',
    '.cr-resolution__index{color:var(--color-giltPale);font-size:11px;letter-spacing:.1em;}',
    '.cr-resolution__activity{font-family:"Noto Serif CJK SC","Songti SC",serif;font-size:19px;font-weight:700;}',
    '.cr-resolution__delta,.cr-resolution__warning{font-size:12px;line-height:1.55;}',
    '.cr-resolution__delta{color:var(--color-paperUi);}',
    '.cr-resolution__warning{color:var(--color-dangerUi);font-weight:700;}',
    '.cr-resolution__continue{justify-self:end;min-block-size:48px;padding:10px 16px;border:1px solid var(--color-giltUi);border-radius:4px;background:rgb(var(--rgb-giltUi) / .14);color:var(--color-giltPale);font-weight:700;cursor:pointer;touch-action:manipulation;}',
    '.cr-resolution__continue:focus-visible{outline:3px solid var(--color-giltUi);outline-offset:3px;}',
    '@media(max-width:680px){.cr-resolution{gap:5px;padding:6px}.cr-resolution__title{font-size:21px}.cr-resolution__lede{font-size:11px;line-height:1.35}.cr-resolution__slots{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(3,minmax(0,1fr));gap:5px}.cr-resolution__slot{padding:5px;gap:2px}.cr-resolution__activity{font-size:15px}.cr-resolution__delta,.cr-resolution__warning{font-size:10px;line-height:1.25}.cr-resolution__continue{min-block-size:44px;padding:6px 10px}}'
  ].join('\n');
  root.appendChild(style);

  const section = document.createElement('section');
  section.className = 'cr-resolution';
  section.setAttribute('aria-labelledby', 'cr-resolution-heading');
  root.appendChild(section);
  appendTextElement(section, 'p', 'cr-resolution__kicker', `第 ${state.settledAgendaCount} 轮 · 逐格结算`);
  const heading = appendTextElement(section, 'h2', 'cr-resolution__title', '这一轮是怎样活过来的');
  heading.id = 'cr-resolution-heading';
  heading.tabIndex = -1;
  appendTextElement(section, 'p', 'cr-resolution__lede', '修途按竹简顺序立即生效。重复、心压与资源前置会改变后续每一段。');
  const list = document.createElement('ol');
  list.className = 'cr-resolution__slots';
  list.setAttribute('aria-label', '六段修途逐项结算');
  section.appendChild(list);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'cr-resolution__continue';
  button.textContent = '收起竹简，处理本轮事件';
  button.addEventListener('click', () => {
    const result = dispatch({ type: 'continue-agenda-resolution' });
    state = result.state;
    if (!result.ok) button.textContent = machineErrorMessage(result.error);
    render();
  });
  section.appendChild(button);

  function render(): void {
    list.replaceChildren(...state.lastAgendaSlots.map(slot => {
      const item = document.createElement('li');
      item.className = 'cr-resolution__slot';
      appendTextElement(item, 'span', 'cr-resolution__index', `第 ${slot.slotIndex + 1} 格 · 效率 ${slot.efficiencyMilli / 10}%`);
      appendTextElement(item, 'strong', 'cr-resolution__activity', CULTIVATION_ACTIVITY_LABELS[slot.activity]);
      appendTextElement(item, 'span', 'cr-resolution__delta', deltaText(slot.delta));
      if (slot.consecutiveCount > 1) appendTextElement(item, 'span', 'cr-resolution__warning', `连续第 ${slot.consecutiveCount} 次，收益已经递减`);
      else if (slot.pressureCrisis) appendTextElement(item, 'span', 'cr-resolution__warning', '心压越界，本格收益受损');
      else if (slot.poisonCrisis) appendTextElement(item, 'span', 'cr-resolution__warning', '丹毒逼近上限');
      return item;
    }));
    button.disabled = state.phase !== 'schedule-resolving';
    button.textContent = state.runState.status === 'lifespan-ended'
      ? '收好竹简，立下劫灰碑记'
      : '收起竹简，处理本轮事件';
  }

  render();
  return {
    update(nextState): void {
      state = nextState;
      render();
    },
    focusInitial(): void {
      heading.focus({ preventScroll: true });
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.replaceChildren();
    }
  };
}
