import { describe, expect, it } from 'vitest';
import { brewFailurePresentation } from '@app/brewFailurePresentation';

describe('brew failure presentation', () => {
  it('maps exploded outcome to the explosion reason with 古风 copy + actionable hint', () => {
    const p = brewFailurePresentation({ outcome: 'exploded' });
    expect(p.reason).toBe('explosion');
    expect(p.title).toBe('炉崩丹毁');
    expect(p.message).toContain('药性');
    expect(p.hint.length).toBeGreaterThan(0);
  });

  it('maps waste outcome to the waste reason', () => {
    const p = brewFailurePresentation({ outcome: 'waste' });
    expect(p.reason).toBe('waste');
    expect(p.title).toBe('废丹一枚');
  });

  it('maps flawed outcome (partial success) to the flawed reason, not a hard failure', () => {
    const p = brewFailurePresentation({ outcome: 'flawed' });
    expect(p.reason).toBe('flawed');
    expect(p.title).toBe('残丹尚可');
  });

  it('does not treat a successful pill as a failure-like state (falls through to a neutral 未成 line, not explosion)', () => {
    const p = brewFailurePresentation({ outcome: 'pill' });
    expect(p.reason).toBe('waste'); // default branch, never explosion
    expect(p.title).toBe('炼制未成');
  });

  it('always returns a non-empty message and hint for every outcome', () => {
    for (const outcome of ['exploded', 'pill', 'flawed', 'waste'] as const) {
      const p = brewFailurePresentation({ outcome });
      expect(p.message.length).toBeGreaterThan(0);
      expect(p.hint.length).toBeGreaterThan(0);
    }
  });
});
