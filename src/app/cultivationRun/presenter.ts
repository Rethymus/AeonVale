import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import {
  CULTIVATION_ACTIVITY_IDS,
  CULTIVATION_ACTIVITY_LABELS,
  type CultivationActivityId,
  type CultivationAgenda,
  type CultivationAgendaError,
  type CultivationRunState
} from '@sim/cultivation-run';

export const CULTIVATION_AGENDAS_BEFORE_TRIBULATION = 2;

export interface CultivationAgendaDraft {
  readonly slots: readonly (CultivationActivityId | null)[];
  readonly selectedSlot: number;
}

export interface CultivationActivityPresentation {
  readonly id: CultivationActivityId;
  readonly label: string;
  readonly shortcut: string;
  readonly timeCostDays: number;
  readonly summary: string;
}

export interface CultivationStatPresentation {
  readonly label: string;
  readonly value: string;
}

const ACTIVITY_SUMMARY: Readonly<Record<CultivationActivityId, (params: BalanceParams) => string>> = {
  training: params => `食物 −${params.cultivationRun.activities.training.foodCost} · 体魄、耐力、意志`,
  farming: params =>
    `灵草 +${params.cultivationRun.activities.farming.herbGain} · 食物 +${params.cultivationRun.activities.farming.foodGain}`,
  alchemy: params => `灵草 −${params.cultivationRun.activities.alchemy.herbCost} · 丹药、悟痕`,
  livelihood: params => `灵石 +${params.cultivationRun.activities.livelihood.spiritStoneGain} · 心压上升`,
  insight: params => `灵石 −${params.cultivationRun.activities.insight.spiritStoneCost} · 悟痕、意志`,
  rest: params => `食物 −${params.cultivationRun.activities.rest.foodCost} · 养伤、减压`
};

const DEFAULT_AGENDA_SLOT_COUNT = DEFAULT_BALANCE.cultivationRun.slotsPerAgenda;

function normalizeSlotCount(slotCount: number): number {
  return Number.isFinite(slotCount) && Number.isInteger(slotCount) && slotCount > 0
    ? slotCount
    : DEFAULT_AGENDA_SLOT_COUNT;
}

function normalizeSlotIndex(slotCount: number, slotIndex: number): number {
  if (slotCount <= 0) return 0;
  const finiteIndex = Number.isFinite(slotIndex) ? Math.trunc(slotIndex) : 0;
  return Math.max(0, Math.min(slotCount - 1, finiteIndex));
}

export function createCultivationAgendaDraft(slotCount = DEFAULT_BALANCE.cultivationRun.slotsPerAgenda): CultivationAgendaDraft {
  return { slots: new Array(normalizeSlotCount(slotCount)).fill(null) as null[], selectedSlot: 0 };
}

export function selectCultivationAgendaSlot(draft: CultivationAgendaDraft, slotIndex: number): CultivationAgendaDraft {
  const selectedSlot = normalizeSlotIndex(draft.slots.length, slotIndex);
  return { slots: draft.slots.slice(), selectedSlot };
}

export function assignCultivationActivity(
  draft: CultivationAgendaDraft,
  activity: CultivationActivityId
): CultivationAgendaDraft {
  const slots = draft.slots.slice();
  if (slots.length === 0) return { slots, selectedSlot: 0 };
  const currentSlot = normalizeSlotIndex(slots.length, draft.selectedSlot);
  slots[currentSlot] = activity;
  let selectedSlot = slots.findIndex((slot, index) => index > currentSlot && slot === null);
  if (selectedSlot < 0) selectedSlot = slots.findIndex(slot => slot === null);
  if (selectedSlot < 0) selectedSlot = currentSlot;
  return { slots, selectedSlot };
}

export function clearSelectedCultivationActivity(draft: CultivationAgendaDraft): CultivationAgendaDraft {
  const slots = draft.slots.slice();
  if (slots.length === 0) return { slots, selectedSlot: 0 };
  const selectedSlot = normalizeSlotIndex(slots.length, draft.selectedSlot);
  slots[selectedSlot] = null;
  return { slots, selectedSlot };
}

export function filledCultivationAgendaSlots(draft: CultivationAgendaDraft): number {
  return draft.slots.filter((activity): activity is CultivationActivityId => activity !== null).length;
}

export function cultivationAgendaEstimatedDays(
  draft: CultivationAgendaDraft,
  params: BalanceParams = DEFAULT_BALANCE
): number {
  const resolved = withDefaultBalanceParams(params);
  return draft.slots.reduce(
    (days, activity) => days + (activity === null ? 0 : resolved.cultivationRun.activities[activity].timeCostDays),
    0
  );
}

export function toCultivationAgenda(draft: CultivationAgendaDraft): CultivationAgenda | null {
  if (draft.slots.length === 0 || filledCultivationAgendaSlots(draft) !== draft.slots.length) return null;
  return { slots: draft.slots.slice() as CultivationActivityId[] };
}

export function cultivationActivityPresentations(
  params: BalanceParams = DEFAULT_BALANCE
): readonly CultivationActivityPresentation[] {
  const resolved = withDefaultBalanceParams(params);
  return CULTIVATION_ACTIVITY_IDS.map((id, index) => ({
    id,
    label: CULTIVATION_ACTIVITY_LABELS[id],
    shortcut: String(index + 1),
    timeCostDays: resolved.cultivationRun.activities[id].timeCostDays,
    summary: ACTIVITY_SUMMARY[id](resolved)
  }));
}

export function cultivationRunStats(
  state: CultivationRunState,
  agendasBeforeTribulation = CULTIVATION_AGENDAS_BEFORE_TRIBULATION,
  agendaIndexOffset = 0
): readonly CultivationStatPresentation[] {
  const currentAgenda = Math.max(1, state.agendaIndex - agendaIndexOffset + 1);
  return [
    { label: '轮次', value: `${Math.min(currentAgenda, agendasBeforeTribulation)}/${agendasBeforeTribulation}` },
    { label: '余寿', value: `${state.lifespanRemainingDays} 日` },
    { label: '心压', value: `${state.pressure}/100` },
    { label: '凡心', value: `${state.mortalHeart}/100` },
    { label: '食物', value: String(state.food) },
    { label: '灵草', value: String(state.herbs) },
    { label: '灵石', value: String(state.spiritStones) }
  ];
}

export function cultivationAgendaErrorMessage(error: CultivationAgendaError): string {
  const slot = error.slotIndex === null ? '' : `第 ${error.slotIndex + 1} 格`;
  const activity = error.activity === null ? '' : `「${CULTIVATION_ACTIVITY_LABELS[error.activity]}」`;
  const target = `${slot}${activity}`;
  switch (error.code) {
    case 'invalid-state':
      return '当前修行记录无法结算。请返回标题后重新开始这一世。';
    case 'invalid-slot-count':
      return '日程必须排满六格。请继续选择活动。';
    case 'run-ended':
      return '余寿已经耗尽，无法继续安排日程。';
    case 'insufficient-lifespan':
      return `${target}所需余寿不足。请换成耗时更短的活动。`;
    case 'insufficient-food':
      return `${target}缺少食物。请把「灵田」排到它前面，或换成不耗食物的活动。`;
    case 'insufficient-herbs':
      return `${target}缺少灵草。请把「灵田」排到它前面，或换成其他活动。`;
    case 'insufficient-spirit-stones':
      return `${target}缺少灵石。请把「谋生」排到它前面，或换成其他活动。`;
  }
}

export function cultivationAgendaSuccessMessage(state: CultivationRunState): string {
  return `第 ${state.agendaIndex} 轮日课结清：余寿 ${state.lifespanRemainingDays} 日，心压 ${state.pressure}，凡心 ${state.mortalHeart}。`;
}
