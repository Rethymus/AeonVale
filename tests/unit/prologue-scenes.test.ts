import { describe, expect, it } from 'vitest';
import { PROLOGUE_SCENES } from '@content/prologueScenes';

/** 把全部场景文本摊平为一行数组，便于做全局护栏断言。 */
function allLines(): string[] {
  const lines: string[] = [];
  for (const scene of PROLOGUE_SCENES) {
    lines.push(...scene.lines);
    if (scene.converge) lines.push(scene.converge);
    for (const choice of scene.choices ?? []) {
      lines.push(choice.label);
      lines.push(choice.response);
    }
  }
  return lines;
}

describe('prologue scenes', () => {
  it('plays exactly three acts: awaken → spirit-test → intro', () => {
    expect(PROLOGUE_SCENES.map(scene => scene.id)).toEqual(['awaken', 'spirit-test', 'intro']);
  });

  it('binds the approved prologue CGs and funnels the system fake-outs to the failure image', () => {
    const awaken = PROLOGUE_SCENES.find(scene => scene.id === 'awaken');
    const spiritTest = PROLOGUE_SCENES.find(scene => scene.id === 'spirit-test');
    const intro = PROLOGUE_SCENES.find(scene => scene.id === 'intro');

    expect(awaken?.cgAssetId).toBe('cg.prologue.awakening-v1');
    expect(spiritTest?.cgAssetId).toBe('cg.prologue.spirit-test-silent-v1');
    expect(intro?.cgAssetId).toBe('cg.prologue.return-valley-v1');
    for (const choice of awaken?.choices ?? []) {
      expect(choice.cgAssetId).toBe('cg.prologue.system-fails-v1');
    }
  });

  it('forbids the term 空灵根 anywhere in the prologue (canon §17, D-34/D-39)', () => {
    for (const line of allLines()) {
      expect(line).not.toContain('空灵根');
    }
  });

  it('spirit-test act: 无灵根 as fact, no old abandoned-by-heaven verdict; elder notes will → 可惜 → 盘缠 → 凡人该待的地方 (user revision)', () => {
    const spiritTest = PROLOGUE_SCENES.find(scene => scene.id === 'spirit-test');
    const joined = (spiritTest?.lines ?? []).join('');
    // 无灵根 作为事实告知（保留）；旧的弃子残酷判法已按用户订正移除。
    expect(joined).toContain('无灵根');
    expect(joined).not.toContain(`天道${'弃子'}`);
    // 长老先看出意志坚定（硬气），测出后叹「可惜」、给盘缠、说「这里不是凡人该待的地方」让其离去。
    expect(joined).toContain('硬气');
    expect(joined).toContain('可惜');
    expect(joined).toContain('盘缠');
    expect(joined).toContain('凡人该待的地方');
  });

  it('reuses the awaken beat lines verbatim and funnels every fake choice to the same converge', () => {
    const awaken = PROLOGUE_SCENES.find(scene => scene.id === 'awaken');
    expect(awaken?.lines).toContain('穿越了——按八百本小说的套路，此刻该有「系统绑定」，或脑海里一声苍老的「小子，老夫等你三千年」。');
    expect(awaken?.lines).toContain('我等了三天。什么都没等到。');
    // 末行作为漏斗收敛行保留原文（含前导省略号）。
    expect(awaken?.converge).toBe('……也许，我就是那个，穿越了也没人要的废柴。');
    expect(awaken?.choices?.map(choice => choice.label)).toEqual(['高呼『系统！』', '找戒指里的老爷爷', '默念『戒中残魂，速来！』']);
  });

  it('closes the intro act with the 无灵根 lament (§6); 功法/偷天 不进序章（第一幕内容）', () => {
    const intro = PROLOGUE_SCENES.find(scene => scene.id === 'intro');
    expect(intro?.lines.at(-1)).toBe('难道没有灵根，就真的不能修仙了吗？——没人回答。');
    // 《偷天换劫诀》由第一幕「修士斗法→败者逆遗储物戒」主线引出；序章不出现「偷天」。
    for (const line of allLines()) {
      expect(line).not.toContain('偷天');
      expect(line).not.toContain('偷天换劫诀');
    }
  });
});
