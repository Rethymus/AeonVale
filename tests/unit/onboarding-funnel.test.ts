import { describe, expect, it } from 'vitest';

import { computeOnboardingFunnel, ONBOARDING_ORDER, type OnboardingSession } from '../../tools/onboarding-funnel';

function session(maxStep: number): OnboardingSession {
  return { id: `s${maxStep}`, maxStep, finalObjective: null, days: maxStep };
}

describe('computeOnboardingFunnel', () => {
  it('orders all 10 onboarding milestones', () => {
    expect(ONBOARDING_ORDER).toHaveLength(10);
    expect(ONBOARDING_ORDER[0]).toBe('first-till');
    expect(ONBOARDING_ORDER[9]).toBe('first-loop-complete');
  });

  it('reports 100% completion when every session clears all steps', () => {
    const funnel = computeOnboardingFunnel([session(10), session(10), session(10)]);
    expect(funnel.totalSessions).toBe(3);
    expect(funnel.completenessGate).toBe(true);
    expect(funnel.overallConversion).toBe(1);
    expect(funnel.steps[9]!.reached).toBe(3);
    expect(funnel.steps[0]!.conversion).toBeNull();
  });

  it('computes reach counts and step-to-step conversion for a leaky funnel', () => {
    // maxSteps: one drops after step1, one after step2, … three finish.
    const maxSteps = [1, 2, 2, 3, 5, 5, 8, 10, 10, 10];
    const funnel = computeOnboardingFunnel(maxSteps.map(session));
    expect(funnel.totalSessions).toBe(10);
    expect(funnel.steps[0]!.reached).toBe(10); // step1 全部到达
    expect(funnel.steps[1]!.reached).toBe(9); // step2：丢掉 maxStep=1 那个
    expect(funnel.steps[1]!.conversion).toBeCloseTo(9 / 10, 5);
    expect(funnel.steps[4]!.reached).toBe(6); // step5：5,5,8,10,10,10
    expect(funnel.steps[9]!.reached).toBe(3); // step10：三个完成
    expect(funnel.overallConversion).toBeCloseTo(3 / 10, 5);
    expect(funnel.completenessGate).toBe(false);
  });

  it('handles an empty session set without dividing by zero', () => {
    const funnel = computeOnboardingFunnel([]);
    expect(funnel.totalSessions).toBe(0);
    expect(funnel.overallConversion).toBe(0);
    expect(funnel.completenessGate).toBe(false);
    expect(funnel.steps[0]!.conversion).toBeNull();
  });
});
