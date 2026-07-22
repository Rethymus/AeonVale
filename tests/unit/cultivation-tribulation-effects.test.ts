import { describe, expect, test } from 'vitest';
import { interpretCultivationTribulationTags } from '@sim/cultivation-run/tribulation-effects';

describe('D27-c→D27-d · 离散效果适配', () => {
  test('事件与参悟标签合并为准备修正', () => {
    const result = interpretCultivationTribulationTags([
      'protected-herbs:2',
      'preview-level:+1',
      'tribulation:preview:violet-omen',
      'ward-charge:+1',
      'tribulation:pill:warding-formula',
      'source-power:+5',
      'safe-range:-3',
      'tribulation:block:thunder-guiding-stone'
    ]);

    expect(result.preparationModifiers).toEqual({
      previewLevelBonus: 2,
      wardChargesBonus: 2,
      protectedHerbCountBonus: 2,
      maxSurvivablePowerBonus: -3,
      sourcePowerBonus: 5,
      eventPowerModifierMilli: 1000,
      unlockedBlockKinds: ['conductor']
    });
  });

  test('棋盘结构标签不降格为数值加成', () => {
    const result = interpretCultivationTribulationTags([
      'starting-herb:thunder',
      'sword-scar-obstacle:1',
      'second-lightning-source:1'
    ]);

    expect(result.boardModifierTags).toEqual([
      'starting-herb:thunder',
      'sword-scar-obstacle:1',
      'second-lightning-source:1'
    ]);
  });

  test('未知标签被显式保留，避免静默丢失内容效果', () => {
    expect(interpretCultivationTribulationTags(['future-effect']).ignoredTags).toEqual(['future-effect']);
  });
});
