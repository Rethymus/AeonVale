/**
 * 炼丹失败反馈（P1-4）：把 BrewResult.outcome 映射为 FailureReason + 古风文案 + 可执行提示。
 *
 * 纯函数：只读 BrewResult，不读/写 GameState，不影响炼丹决策或回放确定性。
 * 不伪造细节——只根据 outcome 这一真值分类；相反/寒热等更细因需 sim 侧标注（留作后续）。
 */
export type BrewFailureReason = 'explosion' | 'waste' | 'flawed';

export interface BrewFailurePresentation {
  reason: BrewFailureReason;
  title: string;   // 古风短题
  message: string; // 古风解释（世界观内）
  hint: string;    // 可执行下一步
}

export interface BrewFailureInput {
  outcome: 'exploded' | 'pill' | 'flawed' | 'waste';
}

export function brewFailurePresentation(input: BrewFailureInput): BrewFailurePresentation {
  switch (input.outcome) {
    case 'exploded':
      return {
        reason: 'explosion',
        title: '炉崩丹毁',
        message: '药性相冲、寒热失御——丹炉轰然炸裂，毒火反噬入体。',
        hint: '撤去相冲之料，或调火候压住寒热再试。'
      };
    case 'waste':
      return {
        reason: 'waste',
        title: '废丹一枚',
        message: '火候不当、药性离散——出炉只得一枚无用的废丹。',
        hint: '核对此料对应的丹方，并把炉温挪进理想区间。'
      };
    case 'flawed':
      return {
        reason: 'flawed',
        title: '残丹尚可',
        message: '火候略偏，丹成而质劣——勉强能用，却不如重炼。',
        hint: '炉温再贴近丹方理想区间，可得正丹、上丹。'
      };
    default:
      return {
        reason: 'waste',
        title: '炼制未成',
        message: '药性不聚，未能成丹。',
        hint: '检查材料与火候后再开炉。'
      };
  }
}
