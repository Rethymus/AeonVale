/**
 * 收获反馈（P1-1 长期反馈链）：把一次收获压缩成一行可读因果——
 *   作物名×数量 ｜ 真实引雷性 ｜ registry 反查的真实关联丹方
 *
 * 纯函数：只读 ContentRegistry，不读/写 GameState，不伪造数值或配方。
 * 无关联丹方时显示真实替代用途（布阵料 / 出货），绝不编造不存在的丹方。
 */
import type { ContentRegistry } from '@content/defs';

export interface HarvestFeedbackLine {
  /** 人类可读一行 */
  message: string;
  /** 反查到的真实丹方 id（透明、可测、不伪造） */
  recipeIds: readonly string[];
}

function formatMetal(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * 由收获事件 defId + 数量 + 内容注册表派生反馈行。
 * 引雷性取 SpiritHerbDef.metalAttract；关联丹方由 recipes.inputs 反查，丹名取 outputPillId→pills。
 */
export function harvestFeedbackPresentation(
  defId: string,
  count: number,
  content: ContentRegistry
): HarvestFeedbackLine {
  const herb = defId ? content.herbs.get(defId) : undefined;
  const name = herb?.displayName ?? (defId || '灵草');
  const qty = Math.max(1, Math.floor(count));

  const segments: string[] = [`${name} ×${qty}`];

  const metal = herb?.metalAttract ?? 0;
  const metalText = formatMetal(metal);
  if (metalText) segments.push(`引雷性 ${metalText}`);

  const recipeIds: string[] = [];
  const pillNames: string[] = [];
  for (const [recipeId, recipe] of content.recipes) {
    if (recipe.inputs.some(inp => inp.herbId === defId)) {
      recipeIds.push(recipeId);
      const pill = content.pills.get(recipe.outputPillId);
      const label = pill?.displayName ?? recipe.displayName ?? recipeId;
      if (!pillNames.includes(label)) pillNames.push(label);
    }
  }

  if (pillNames.length > 0) {
    segments.push(`可炼制${pillNames.slice(0, 2).join('、')}`);
  } else if (metalText) {
    segments.push('布阵备劫之料');
  } else {
    segments.push('可炼丹或出货');
  }

  return { message: segments.join('｜'), recipeIds };
}
