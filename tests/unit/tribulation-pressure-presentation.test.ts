import { describe, expect, it } from 'vitest';
import { tribulationPressurePresentation } from '@app/tribulationPressurePresentation';

const base = {
  daysRemaining: 0,
  lifespanRemainingDays: 200,
  readyToInvoke: false,
  frozen: false,
  prepLine: '备劫：缺避雷丹｜阵法未成(0/2)｜准备度0%'
};

describe('tribulation pressure presentation', () => {
  it('idle + not ready reads 劫势未成 and stays calm', () => {
    const p = tribulationPressurePresentation({ ...base, status: 'idle' });
    expect(p.tribulationRow).toBe('劫势未成');
    expect(p.danger).toBe('calm');
    expect(p.lifespanRow).toBe('距大限：200 日');
    expect(p.prepRow).toContain('备劫');
  });

  it('idle + ready reads 可主动引劫 (player choice, not a danger)', () => {
    const p = tribulationPressurePresentation({ ...base, status: 'idle', readyToInvoke: true });
    expect(p.tribulationRow).toBe('可主动引劫');
    expect(p.danger).toBe('calm');
  });

  it('countdown escalates warning then critical near the tribulation', () => {
    expect(tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 10 }).danger).toBe('calm');
    expect(tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 7 }).danger).toBe('warning');
    expect(tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 5 }).danger).toBe('warning');
    expect(tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 3 }).danger).toBe('critical');
    expect(tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 1 }).danger).toBe('critical');
    expect(tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 5 }).tribulationRow).toBe('距天劫：5 日');
  });

  it('due tribulation is always critical', () => {
    const p = tribulationPressurePresentation({ ...base, status: 'due' });
    expect(p.tribulationRow).toBe('天劫已至');
    expect(p.danger).toBe('critical');
  });

  it('lifespan escalates danger independently of tribulation', () => {
    expect(tribulationPressurePresentation({ ...base, status: 'idle', lifespanRemainingDays: 50 }).danger).toBe('warning');
    expect(tribulationPressurePresentation({ ...base, status: 'idle', lifespanRemainingDays: 20 }).danger).toBe('critical');
    expect(tribulationPressurePresentation({ ...base, status: 'idle', lifespanRemainingDays: 0 }).danger).toBe('critical');
    expect(tribulationPressurePresentation({ ...base, status: 'idle', lifespanRemainingDays: 0 }).lifespanRow).toBe('大限已至');
  });

  it('takes the more severe danger across tribulation and lifespan', () => {
    // calm trib + critical lifespan -> critical
    expect(tribulationPressurePresentation({ ...base, status: 'idle', lifespanRemainingDays: 10 }).danger).toBe('critical');
    // warning trib + calm lifespan -> warning
    expect(tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 6, lifespanRemainingDays: 200 }).danger).toBe('warning');
  });

  it('frozen (留世/终局) reads terminal and drops the prep row', () => {
    const p = tribulationPressurePresentation({ ...base, status: 'countdown', daysRemaining: 1, frozen: true });
    expect(p.danger).toBe('terminal');
    expect(p.tribulationRow).toBe('此界劫数已定');
    expect(p.prepRow).toBe('');
    expect(p.lifespanRow).toContain('留世');
  });
});
