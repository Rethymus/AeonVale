/** D27-c→D27-d：把事件/参悟离散效果标签翻译为天劫准备修正。 */
import type { TribulationPreparationModifiers } from './preparation';

export interface CultivationTribulationTagInterpretation {
  readonly preparationModifiers: TribulationPreparationModifiers;
  /** 需要棋盘生成器处理、不能伪装成数值加成的标签。 */
  readonly boardModifierTags: readonly string[];
  readonly ignoredTags: readonly string[];
}

export function interpretCultivationTribulationTags(
  tags: readonly string[]
): CultivationTribulationTagInterpretation {
  let previewLevelBonus = 0;
  let wardChargesBonus = 0;
  let protectedHerbCountBonus = 0;
  let maxSurvivablePowerBonus = 0;
  let sourcePowerBonus = 0;
  const unlockedBlockKinds: Array<'conductor'> = [];
  const boardModifierTags: string[] = [];
  const ignoredTags: string[] = [];

  for (const tag of tags) {
    switch (tag) {
      case 'protected-herbs:2':
        protectedHerbCountBonus += 2;
        break;
      case 'preview-level:+1':
      case 'tribulation:preview:violet-omen':
        previewLevelBonus += 1;
        break;
      case 'ward-charge:+1':
      case 'tribulation:pill:warding-formula':
        wardChargesBonus += 1;
        break;
      case 'source-power:+5':
        sourcePowerBonus += 5;
        break;
      case 'safe-range:-3':
        maxSurvivablePowerBonus -= 3;
        break;
      case 'tribulation:block:thunder-guiding-stone':
        if (!unlockedBlockKinds.includes('conductor')) unlockedBlockKinds.push('conductor');
        break;
      case 'starting-herb:thunder':
      case 'sword-scar-obstacle:1':
      case 'second-lightning-source:1':
        boardModifierTags.push(tag);
        break;
      case 'sect-tally:cleared':
        break;
      default:
        ignoredTags.push(tag);
        break;
    }
  }

  return {
    preparationModifiers: {
      previewLevelBonus,
      wardChargesBonus,
      protectedHerbCountBonus,
      maxSurvivablePowerBonus,
      sourcePowerBonus,
      eventPowerModifierMilli: 1000,
      unlockedBlockKinds
    },
    boardModifierTags,
    ignoredTags
  };
}
