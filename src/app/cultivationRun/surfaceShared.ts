import type { CultivationRunMachineAction, CultivationRunMachineError, CultivationRunMachineTransition } from './machine';
import type { CultivationEventResource } from '@sim/cultivation-run/events';
import type { CultivationRunState } from '@sim/cultivation-run/types';

export type CultivationRunSurfaceDispatch = (action: CultivationRunMachineAction) => CultivationRunMachineTransition;

export interface CultivationRunPhaseSurface {
  update(state: import('./machine').CultivationRunMachineState): void;
  focusInitial(): void;
  destroy(): void;
}

export const CULTIVATION_RESOURCE_LABELS: Readonly<Record<CultivationEventResource, string>> = {
  lifespanRemainingDays: '余寿',
  insight: '悟痕',
  herbs: '灵草',
  food: '食物',
  spiritStones: '灵石',
  pills: '丹药'
};

export function cultivationResourceValue(state: CultivationRunState, resource: CultivationEventResource): number {
  return state[resource];
}

export function signedValue(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

export function hasCommandModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

export function focusableButton(root: HTMLElement, selector = 'button:not([disabled])'): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(selector);
}

export function machineErrorMessage(error: CultivationRunMachineError): string {
  switch (error.code) {
    case 'invalid-phase':
      return '当前步骤已经改变，请继续新的修行步骤。';
    case 'current-event-missing':
      return '未找到当前事件。请返回日程页重新结算。';
    case 'event-resolution-failed': {
      const eventError = error.cause?.system === 'event' ? error.cause.error : null;
      if (eventError?.code === 'insufficient-resource' && eventError.resource) {
        return `${CULTIVATION_RESOURCE_LABELS[eventError.resource]}不足，请换一个选择。`;
      }
      if (eventError?.code === 'choice-not-found') return '这个选择已不可用，请重新选择。';
      if (eventError?.code === 'event-unavailable') return '这件事已经错过，请继续当前流程。';
      return '当前修行状态无法结算这个选择。';
    }
    case 'insight-unlock-failed': {
      const insightError = error.cause?.system === 'insight' ? error.cause.error : null;
      switch (insightError?.code) {
        case 'agenda-unlock-limit-reached':
          return '本轮已参悟过一个节点。请继续日程或前往天劫。';
        case 'missing-prerequisite':
          return `前置残卷未解：${insightError.missingPrerequisiteNodeIds.join('、')}。`;
        case 'insufficient-insight':
          return '悟痕不足。可以先继续日程，下轮再来。';
        case 'already-unlocked':
          return '这一页残卷已经参透。';
        case 'unknown-target-node':
          return '未找到这一页残卷。';
        default:
          return '当前参悟状态无法解锁这个节点。';
      }
    }
    case 'tribulation-not-ready':
      return '劫前修途还没有完成，请再安排一轮。';
    case 'preparation-window-closed':
      return '天道催讨已至，不能再拖延这一劫。';
    case 'lifespan-still-sufficient':
      return '余寿尚能排满一轮修途，不必现在封卷。';
    case 'unknown-activity':
    case 'agenda-resolution-failed':
    case 'event-sampling-failed':
      return '日程结算未完成，请返回日程页检查安排。';
  }
}

export function appendTextElement<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tagName: K, className: string, text: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
}
