/**
 * 中医配伍七情—— 差异化设计骨架。
 *
 * 七情映射到机制：相须→增效 / 相使→辅效 / 相畏·相杀→减毒净毒 / 相恶→废丹 / 相反→炸炉。
 * 落为成对兼容性表（数据驱动）；命中"相反"则无视火候强制炸炉（十八反式必炸药对）。
 */
export type SevenRelation = '相须' | '相使' | '相畏' | '相杀' | '相恶' | '相反';

export interface CompatibilityRule {
  a: string;
  b: string;
  relation: SevenRelation;
  modifier: number; // 增益(+)/惩罚(−)/风险倍率，语义见下
}

/**
 * 配伍规则（示例性，对齐已有 6 种灵草）。
 * modifier 语义：
 * 相须/相使：quality 乘性加成（+0.3 等）
 * 相畏/相杀：丹毒产出折减（modifier 为保留比例，如 0.5 = 毒减半）
 * 相恶：quality 乘性惩罚（如 0.3）
 * 相反：guaranteedExplosion = true（modifier 标记）
 */
const RULES: CompatibilityRule[] = [
  // —— 相反（必炸药对，寒热极端对）——
  { a: 'herb.frostmarrow', b: 'herb.emberheart', relation: '相反', modifier: 1 }, // 强寒 × 强热
  { a: 'herb.griefvein', b: 'herb.emberheart', relation: '相反', modifier: 1 }, // 九死草寒热同体 × 强热
  { a: 'herb.voidmantle', b: 'herb.solar-pith', relation: '相反', modifier: 1 }, // 极寒 × 极热
  // —— 相杀（净毒：和合叶解九死草毒）——
  { a: 'herb.balmleaf', b: 'herb.griefvein', relation: '相杀', modifier: 0.5 },
  // —— 相须（同属性增效）——
  { a: 'herb.frostmarrow', b: 'herb.dewroot', relation: '相须', modifier: 0.3 }, // 同寒
  { a: 'herb.emberheart', b: 'herb.suncap', relation: '相须', modifier: 0.3 }, // 同热
  // —— 相使（辅效）——
  { a: 'herb.metalpine', b: 'herb.frostmarrow', relation: '相使', modifier: 0.2 }, // 金引雷 + 寒
  // —— 相畏（减毒）——
  { a: 'herb.dewroot', b: 'herb.emberheart', relation: '相畏', modifier: 0.6 }, // 温寒制热毒
  // —— 相杀（净毒）——
  { a: 'herb.mossling', b: 'herb.frostmarrow', relation: '相杀', modifier: 0.5 }, // 平性解寒毒
  // —— 相恶（废丹）——
  { a: 'herb.mossling', b: 'herb.metalpine', relation: '相恶', modifier: 0.3 } // 平 × 金 相互削弱
];

/** 对称查找两味药的关系（无序）。 */
export function lookupRelation(a: string, b: string): CompatibilityRule | undefined {
  for (const r of RULES) {
    if ((r.a === a && r.b === b) || (r.a === b && r.b === a)) return r;
  }
  return undefined;
}

/** 一炉材料中是否存在"相反"药对（必炸）。 */
export function hasIncompatibility(herbIds: string[]): boolean {
  for (let i = 0; i < herbIds.length; i++) {
    for (let j = i + 1; j < herbIds.length; j++) {
      const r = lookupRelation(herbIds[i]!, herbIds[j]!);
      if (r?.relation === '相反') return true;
    }
  }
  return false;
}

/** 汇总一炉材料的配伍影响（quality 倍率、毒保留比例、是否废丹倾向）。 */
export interface PairingSummary {
  qualityMult: number; // 相须/相使 加成 × 相恶 惩罚
  poisonRetention: number; // 相畏/相杀 后的毒保留比例（1.0=全毒）
  guaranteedExplosion: boolean;
  relations: CompatibilityRule[];
}

export function summarizePairings(herbIds: string[]): PairingSummary {
  let qualityMult = 1;
  let poisonRetention = 1;
  const relations: CompatibilityRule[] = [];
  let guaranteedExplosion = false;
  for (let i = 0; i < herbIds.length; i++) {
    for (let j = i + 1; j < herbIds.length; j++) {
      const r = lookupRelation(herbIds[i]!, herbIds[j]!);
      if (!r) continue;
      relations.push(r);
      switch (r.relation) {
        case '相须':
        case '相使':
          qualityMult += r.modifier;
          break;
        case '相恶':
          qualityMult *= r.modifier;
          break;
        case '相畏':
        case '相杀':
          poisonRetention *= r.modifier;
          break;
        case '相反':
          guaranteedExplosion = true;
          break;
      }
    }
  }
  return { qualityMult, poisonRetention, guaranteedExplosion, relations };
}
