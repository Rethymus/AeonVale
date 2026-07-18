import { describe, expect, it } from 'vitest';
import { celestialCompassPresentation } from '@app/celestialCompassPresentation';

describe('celestial compass presentation', () => {
  it('shows calm farming guidance when no event or upcoming date exists', () => {
    const p = celestialCompassPresentation({ activeEvent: null, beastSurge: null, upcoming: null });
    expect(p.primary).toBe('天象平稳');
    expect(p.causal).toContain('补种');
    expect(p.upcoming).toContain('七日内无定期节令');
    expect(p.tone).toBe('calm');
  });

  it('explains qi tide as a growth-to-beast causal chain', () => {
    const p = celestialCompassPresentation({
      activeEvent: { id: 'event.qi-tide', displayName: '灵气潮汐', type: 'joy', daysLeft: 4, growthMod: 1.5, qiMod: 1.5 },
      beastSurge: null,
      upcoming: { id: 'event.spring-festival', title: '春社', kind: 'festival', daysFromNow: 3 }
    });
    expect(p.primary).toBe('灵气潮汐｜余4日');
    expect(p.causal).toContain('灵草疯长');
    expect(p.causal).toContain('妖兽');
    expect(p.upcoming).toBe('后兆：3日后 · 春社');
    expect(p.tone).toBe('opportunity');
  });

  it('marks demonic pass as warning and mentions field damage / loot', () => {
    const p = celestialCompassPresentation({
      activeEvent: { id: 'event.demonic-pass', displayName: '魔修过境', type: 'crisis', daysLeft: 1, growthMod: 1, qiMod: 1 },
      beastSurge: null,
      upcoming: null
    });
    expect(p.tone).toBe('warning');
    expect(p.causal).toContain('田地或损');
    expect(p.causal).toContain('残物');
  });

  it('beast surge overrides active event as critical', () => {
    const p = celestialCompassPresentation({
      activeEvent: { id: 'event.qi-tide', displayName: '灵气潮汐', type: 'joy', daysLeft: 2, growthMod: 1.5, qiMod: 1.5 },
      beastSurge: { beastsRemaining: 3, daysLeft: 2 },
      upcoming: { id: 'npc.foo', title: '忘言叟生辰', kind: 'birthday', daysFromNow: 0 }
    });
    expect(p.tone).toBe('critical');
    expect(p.primary).toContain('妖兽潮');
    expect(p.primary).toContain('3只');
    expect(p.upcoming).toBe('后兆：今日 · 忘言叟生辰');
  });

  it('uses generic copy for unknown opportunity/crisis events without inventing details', () => {
    expect(celestialCompassPresentation({ activeEvent: { id: 'event.unknown-op', displayName: '未知机缘', type: 'opportunity', daysLeft: 1, growthMod: 1, qiMod: 1 }, beastSurge: null, upcoming: null }).causal).toContain('机缘');
    expect(celestialCompassPresentation({ activeEvent: { id: 'event.unknown-crisis', displayName: '未知灾象', type: 'crisis', daysLeft: 1, growthMod: 1, qiMod: 1 }, beastSurge: null, upcoming: null }).causal).toContain('灾象');
  });
});
