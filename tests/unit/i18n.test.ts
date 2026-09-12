/**
 * i18n 层。
 * 验证 t 取值、插值、回退与结局/目标文案的稳定键（renderer 词表已随
 * 旧世界退役删除，docs/21 §8.27）。
 */
import { describe, it, expect } from 'vitest';
import { t } from '@content/i18n';

describe('i18n 层', () => {
  it('t dotted key 取值', () => {
    expect(t('ui.hud.season.winter')).toBe('冬');
  });

  it('t {var} 插值', () => {
    expect(t('ui.hud.day', { n: 7 })).toBe('第 7 日');
    expect(t('ui.hud.year', { n: 3 })).toBe('第 3 年');
  });

  it('t 缺键回退到 key 本身（便于发现漏译）', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });

  it('结局文案含 epilogue 多行', () => {
    expect(t('ending.ascension')).toContain('白日飞升');
    expect(t('ending.ascension')).toContain('天道');
    expect(t('ending.poison-death')).toContain('丹毒暴毙');
  });

  it('修途目标文案键齐全', () => {
    expect(t('ui.objective.first-till')).toContain('先翻出一块地');
    expect(t('ui.objective.first-sleep')).toContain('点击居所或“歇息”过夜');
    expect(t('ui.objective.first-market-restock')).toContain('去山谷集市补几颗种子');
    expect(t('ui.objective.first-second-sow')).toContain('把刚补到的种子播回田里');
    expect(t('ui.objective.first-loop-complete')).toContain('第二轮药材动线已成立');
  });
});
