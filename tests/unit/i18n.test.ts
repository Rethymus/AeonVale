/**
 * i18n 层。
 * 验证 t/tList 取值、插值、回退，以及 renderer 所依赖的稳定词表已外部化。
 */
import { describe, it, expect } from 'vitest';
import { t, tList } from '@content/i18n';

describe('i18n 层', () => {
  it('t dotted key 取值', () => {
    expect(t('ui.hud.hp')).toBe('气血');
    expect(t('ui.hud.season.winter')).toBe('冬');
  });

  it('t {var} 插值', () => {
    expect(t('ui.hud.day', { n: 7 })).toBe('第 7 日');
    expect(t('ui.hud.year', { n: 3 })).toBe('第 3 年');
  });

  it('t 缺键回退到 key 本身（便于发现漏译）', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('tList 取阶段名表（8 阶）', () => {
    const stages = tList('ui.hud.stages');
    expect(stages.length).toBe(8);
    expect(stages[0]).toBe('凡骨');
    expect(stages[7]).toBe('飞升前夜');
  });

  it('结局文案含 epilogue 多行', () => {
    expect(t('ending.ascension')).toContain('白日飞升');
    expect(t('ending.ascension')).toContain('天道');
    expect(t('ending.poison-death')).toContain('丹毒暴毙');
  });

  it('renderer 稳定词表键齐全（帮助/背包组/季节）', () => {
    expect(t('ui.help.default').length).toBeGreaterThan(20);
    expect(t('ui.help.default')).toContain('点击目标移动/互动');
    expect(t('ui.help.default')).toContain('行囊常驻');
    expect(t('ui.help.default')).toContain('丹炉/山河图/修行在更多中');
    expect(t('ui.help.default')).toContain('B 行囊');
    expect(t('ui.help.default')).toContain('Esc 暂停/返回');
    expect(t('ui.help.default')).not.toContain('WASD');
    expect(t('ui.help.default')).not.toContain('M/C');
    expect(t('ui.help.default')).not.toContain('空格/E互动');
    expect(t('ui.help.default')).not.toContain('滚轮');
    expect(t('ui.help.default')).not.toContain('Q切热栏');
    expect(t('ui.help.inventory')).toContain('B/Esc关闭');
    expect(t('ui.help.pause')).toContain('Esc恢复行动');
    expect(t('ui.help.dialogue')).toContain('点击继续');
    expect(t('ui.help.location')).toContain('点选地点与服务');
    expect(t('ui.help.farmAction')).toContain('点选');
    expect(t('ui.help.storage')).toContain('当前不会过夜');
    expect(t('ui.help.ascensionChoice')).toContain('仅 1/2 可选结局');
    expect(t('ui.objective.first-till')).toContain('先翻出一块地');
    expect(t('ui.objective.first-sleep')).toContain('点击居所或“歇息”过夜');
    expect(t('ui.objective.first-market-restock')).toContain('去山谷集市补几颗种子');
    expect(t('ui.objective.first-second-sow')).toContain('把刚补到的种子播回田里');
    expect(t('ui.objective.first-loop-complete')).toContain('第二轮药材动线已成立');
    for (const k of ['ui.hud.invSeed', 'ui.hud.invHerb', 'ui.hud.invPill', 'ui.hud.invMisc', 'ui.hud.invOther', 'ui.hud.invTitle', 'ui.hud.invEmpty']) {
      expect(t(k), `${k} 应有值`).not.toBe(k);
    }
  });
});
