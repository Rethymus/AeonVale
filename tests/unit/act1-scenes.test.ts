import { describe, expect, it } from 'vitest';
import { ACT1_SCENES } from '@content/act1Scenes';

/** 把全部场景文本摊平为一行数组，便于做全局护栏断言。 */
function allLines(): string[] {
  const lines: string[] = [];
  for (const scene of ACT1_SCENES) {
    lines.push(...scene.lines);
    if (scene.converge) lines.push(scene.converge);
    for (const choice of scene.choices ?? []) {
      lines.push(choice.label);
      lines.push(choice.response);
    }
  }
  return lines;
}

describe('act1 scenes', () => {
  it('plays five beats: duel → ash → relic → ring → scroll', () => {
    expect(ACT1_SCENES.map(scene => scene.id)).toEqual(['duel', 'ash', 'relic', 'ring', 'scroll']);
  });

  it('forbids the term 空灵根 in Act 1 (revealed mid-game per §2/§17)', () => {
    for (const line of allLines()) {
      expect(line).not.toContain('空灵根');
    }
  });

  it('does not name 神农 (hidden thread, §3) nor 萧无极 (interacts mid-game, §5)', () => {
    for (const line of allLines()) {
      expect(line).not.toContain('神农');
      expect(line).not.toContain('萧无极');
    }
  });

  it('introduces 偷天 / 《偷天换劫诀》 via the scroll beat (§6) — led in, not abrupt', () => {
    const scroll = ACT1_SCENES.find(scene => scene.id === 'scroll');
    const joined = (scroll?.lines ?? []).join('');
    expect(joined).toContain('偷天');
    expect(joined).toContain('此诀非人所修');
    expect(joined).toContain('以劫为薪，以骨为柴');
  });

  it('seeds the 神农 hidden thread via the scroll wording (engineering notes) without naming him', () => {
    const scroll = ACT1_SCENES.find(scene => scene.id === 'scroll');
    const joined = (scroll?.lines ?? []).join('');
    expect(joined).toContain('工程手记');
  });

  it('closes Act 1 with the §1 thesis (功法入手处)', () => {
    const scroll = ACT1_SCENES.find(scene => scene.id === 'scroll');
    expect(scroll?.lines).toContain('种田以炼丹，炼丹以承雷，引雷入体，借劫修漏。凡骨一线，硬撼天道。');
  });
});
