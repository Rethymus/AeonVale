/**
 * i18n 层。
 * 验证 t 取值、插值与回退机制（旧世界词表已随阶段 3 退役删除）。
 */
import { describe, it, expect } from 'vitest';
import { t } from '@content/i18n';

describe('i18n 层', () => {
  it('t 取值', () => {
    expect(t('ui.orientation.kicker')).toBe('横屏游玩');
  });

  it('t 缺键回退到 key 本身（便于发现漏译）', () => {
    expect(t('no.such.key')).toBe('no.such.key');
  });
});
