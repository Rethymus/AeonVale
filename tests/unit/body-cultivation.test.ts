import { describe, expect, it } from 'vitest';
import { advanceDay, advanceTribulationDay, applyAction, bodyFoundationCap, clearTribulationCountdown, createSimContext, createWorld, DEFAULT_BALANCE, invokeTribulation, readyToInvokeTribulation, recordTribulationInvocation, resolveDueTribulation, shouldStartForcedTribulationCountdown } from '@sim';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  state.player.stage = 1;
  return { state, ctx };
}

describe('体修主轴', () => {
  it('新世界带有体修字段和大限倒计时', () => {
    const { state } = setup();
    expect(state.player.bodyFoundation).toBe(0);
    expect(state.player.endurance).toBe(0);
    expect(state.player.willpower).toBe(0);
    expect(state.player.heavenDebt).toBe(0);
    expect(state.player.daoAttention).toBe(0);
    expect(state.player.lifespanRemainingDays).toBe(DEFAULT_BALANCE.bodyCultivation.lifespanStartDays);
  });

  it('埼玉训练法动作会消耗体力并增长体魄、耐力、意志', () => {
    const { state, ctx } = setup();
    const staminaBefore = state.player.stamina;
    applyAction(state, { kind: 'train', method: 'push-up' }, ctx);
    expect(state.player.stamina).toBe(staminaBefore - DEFAULT_BALANCE.bodyCultivation.pushUpStaminaCost * MILLI);
    expect(state.player.bodyFoundation).toBe(DEFAULT_BALANCE.bodyCultivation.pushUpGain);
    expect(state.player.cultivation).toBe(DEFAULT_BALANCE.bodyCultivation.pushUpGain);
    expect(state.player.endurance).toBe(DEFAULT_BALANCE.bodyCultivation.endurancePerSet);
    expect(state.player.willpower).toBe(DEFAULT_BALANCE.bodyCultivation.willpowerPerSet);
    expect(state.events.some(e => e.type === 'body-training')).toBe(true);
  });

  it('主动引劫条件由体魄根基驱动，并兼容旧淬体进度迁移', () => {
    const { state } = setup();
    state.player.cultivation = 0;
    state.player.bodyFoundation = 0;
    expect(readyToInvokeTribulation(state, DEFAULT_BALANCE)).toBe(false);
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);
    expect(readyToInvokeTribulation(state, DEFAULT_BALANCE)).toBe(true);

    const { state: legacy } = setup(2);
    legacy.player.cultivation = bodyFoundationCap(1, DEFAULT_BALANCE);
    legacy.player.bodyFoundation = 0;
    expect(readyToInvokeTribulation(legacy, DEFAULT_BALANCE)).toBe(true);
    expect(legacy.player.bodyFoundation).toBe(bodyFoundationCap(1, DEFAULT_BALANCE));
  });

  it('主动引劫会增加因果债和天道注视', () => {
    const { state, ctx } = setup();
    recordTribulationInvocation(state, ctx);
    expect(state.player.heavenDebt).toBe(DEFAULT_BALANCE.bodyCultivation.heavenDebtPerInvoke);
    expect(state.player.daoAttention).toBe(DEFAULT_BALANCE.bodyCultivation.daoAttentionPerInvoke);
    expect(state.events.some(e => e.type === 'tribulation-invoked')).toBe(true);
  });

  it('主动引劫动作会开启天劫准备窗倒计时', () => {
    const { state, ctx } = setup();
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);
    const ok = invokeTribulation(state, ctx);
    expect(ok).toBe(true);
    expect(state.tribulation).toMatchObject({
      status: 'countdown',
      source: 'active',
      daysRemaining: DEFAULT_BALANCE.breakthrough.tTribBase,
      stage: 1,
      startedDay: 1
    });
    expect(state.events.some(e => e.type === 'tribulation-countdown-started')).toBe(true);
  });

  it('倒计时已开启后重复主动引劫不会再次累加因果债或重置状态', () => {
    const { state, ctx } = setup();
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);

    expect(invokeTribulation(state, ctx)).toBe(true);
    const debtAfterFirst = state.player.heavenDebt;
    const attentionAfterFirst = state.player.daoAttention;
    const tribulationAfterFirst = { ...state.tribulation };
    const eventsAfterFirst = state.events.filter(e => e.type === 'tribulation-invoked').length;

    expect(invokeTribulation(state, ctx)).toBe(false);
    expect(state.player.heavenDebt).toBe(debtAfterFirst);
    expect(state.player.daoAttention).toBe(attentionAfterFirst);
    expect(state.tribulation).toEqual(tribulationAfterFirst);
    expect(state.events.filter(e => e.type === 'tribulation-invoked')).toHaveLength(eventsAfterFirst);
  });

  it('满足引劫条件后长期拖延会触发天道催讨倒计时', () => {
    const { state, ctx } = setup();
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);
    for (let i = 0; i < DEFAULT_BALANCE.breakthrough.tTribBase; i++) advanceTribulationDay(state, ctx);
    expect(state.tribulation.status).toBe('countdown');
    expect(state.tribulation.source).toBe('delay');
    expect(state.events.some(e => e.type === 'tribulation-countdown-started')).toBe(true);
  });

  it('因果债或寿元压力会触发强制催讨来源判定', () => {
    const { state } = setup();
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);
    state.player.heavenDebt = DEFAULT_BALANCE.bodyCultivation.heavenDebtPerInvoke * 2;
    expect(shouldStartForcedTribulationCountdown(state, DEFAULT_BALANCE)).toBe('heaven-debt');

    clearTribulationCountdown(state);
    state.player.heavenDebt = 0;
    state.player.lifespanRemainingDays = 3;
    expect(shouldStartForcedTribulationCountdown(state, DEFAULT_BALANCE)).toBe('lifespan');
  });

  it('倒计时每日推进并在归零时转为到期状态', () => {
    const { state, ctx } = setup();
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);
    invokeTribulation(state, ctx);
    for (let i = 0; i < DEFAULT_BALANCE.breakthrough.tTribBase; i++) advanceTribulationDay(state, ctx);
    expect(state.tribulation.status).toBe('due');
    expect(state.tribulation.daysRemaining).toBe(0);
    expect(state.events.some(e => e.type === 'tribulation-collection-due')).toBe(true);
  });

  it('到期状态会自动进入真实天劫结算并清空倒计时', () => {
    const { state, ctx } = setup(11);
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);
    invokeTribulation(state, ctx);
    for (let i = 0; i < DEFAULT_BALANCE.breakthrough.tTribBase; i++) advanceTribulationDay(state, ctx);

    const result = resolveDueTribulation(state, ctx);
    expect(result.resolved).toBe(true);
    expect(result.tribulation).not.toBeNull;
    expect(state.tribulation).toMatchObject({
      status: 'idle',
      source: null,
      daysRemaining: 0,
      stage: 0,
      readyDays: 0,
      startedDay: null
    });
    expect(state.events.some(e => e.type === 'tribulation-forced-start')).toBe(true);
    expect(state.events.some(e => e.type === 'tribulation-due-resolved')).toBe(true);
  });

  it('advanceDay 会在催讨到期时自动结算真实天劫并清空倒计时', () => {
    const { state, ctx } = setup(17);
    state.player.bodyFoundation = bodyFoundationCap(1, DEFAULT_BALANCE);
    invokeTribulation(state, ctx);
    for (let i = 0; i < DEFAULT_BALANCE.breakthrough.tTribBase; i++) advanceDay(state, ctx);

    expect(state.tribulation.status).toBe('idle');
    expect(state.events.some(e => e.type === 'tribulation-forced-start')).toBe(true);
    expect(state.events.some(e => e.type === 'tribulation-end')).toBe(true);
    expect(state.events.some(e => e.type === 'tribulation-due-resolved')).toBe(true);
  });

  it('每日推进会消耗寿元，大限归零时结束游戏', () => {
    const { state, ctx } = setup();
    state.player.lifespanRemainingDays = 1;
    advanceDay(state, ctx);
    expect(state.gameOver).toBe(true);
    expect(state.ending).toBe('lifespan-death');
  });
});
