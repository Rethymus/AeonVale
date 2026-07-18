/**
 * 叙事文案词表与基调指南（P2-1 第一刀：零风险基底）。
 *
 * 本模块是"现代词 → 修仙古风"的可审阅映射 + 取舍理由，**暂不改任何调用点**。
 * 目的：先把口径定下来，给人审阅；后续按 stance 分批、有守卫地替换。
 *
 * 三种 stance：
 *   - keep       保留现代词（功能性 UI / 凡人吐槽幽默感，古风化反而出戏）。
 *   - xianxia    古风化（叙事/描述里替换为修仙措辞）。
 *   - contextual 动作短标签保留（玩家直觉/操作连贯），叙事与描述古风化。
 *
 * 基调原则（TONE_PRINCIPLES）：主角是穿越的凡人废柴，第一人称带自嘲；
 * 系统/机制词偏功能（keep），世界观/叙事词偏古风（xianxia）。
 */
export type GlossaryStance = 'keep' | 'xianxia' | 'contextual';

export interface GlossaryEntry {
  modern: string;
  xianxia: string;
  stance: GlossaryStance;
  rationale: string;
}

export const TONE_PRINCIPLES = [
  '主角第一人称、穿越者视角、带自嘲——"凡人吐槽"的幽默感要保留，不全古风化。',
  '功能/UI 动作短词（种植、翻地、浇水、背包）优先保留，保证玩家操作直觉与连贯。',
  '世界观与叙事描述（炼丹、渡劫、灵田、因果）走古风，强化修仙沉浸。',
  '已是修仙常用词（灵石、灵气、丹炉、天劫、境界）直接保留，不再翻译。',
  '替换时分批、带字符串守卫测试，避免一次性大改冲垮基调与既有断言。'
] as const;

export const NARRATIVE_GLOSSARY: readonly GlossaryEntry[] = [
  { modern: '种植', xianxia: '栽种', stance: 'contextual', rationale: '动作标签保留"种植"保直觉；叙事/描述改"栽种（灵草）"点明对象。' },
  { modern: '收获', xianxia: '采收', stance: 'contextual', rationale: '同上：标签保留，描述古风化。' },
  { modern: '浇水', xianxia: '浇灌', stance: 'contextual', rationale: '操作词保留；描述可用"润田/浇灌"。' },
  { modern: '翻地', xianxia: '翻耕', stance: 'contextual', rationale: '操作词保留；描述可用"整地/翻耕"。' },
  { modern: '升级', xianxia: '突破', stance: 'xianxia', rationale: '"升级"太游戏化；修丹/体修语境用"突破/精进/淬体"。' },
  { modern: '经验值', xianxia: '修为', stance: 'xianxia', rationale: '"经验值"出戏；修仙用"修为/体魄根基"。' },
  { modern: '背包', xianxia: '储物戒', stance: 'contextual', rationale: 'UI 标签"背包"保直觉；叙事/物件描述用"储物戒/行囊"。' },
  { modern: '商店', xianxia: '坊市', stance: 'xianxia', rationale: '游戏内交易场景用"坊市/游方散仙"更贴世界观。' },
  { modern: '任务', xianxia: '差事/委托', stance: 'xianxia', rationale: '"任务"偏网游；镇守人间/佣金语境用"差事/委托/贡赋"。' },
  { modern: '系统', xianxia: '天道', stance: 'keep', rationale: '主角"无系统"是核心设定梗（穿越却没系统），保留现代词制造反差幽默。' },
  { modern: '设置', xianxia: '设置', stance: 'keep', rationale: '功能性 UI 入口，古风化反而难找，保留。' },
  { modern: '暂停', xianxia: '暂停', stance: 'keep', rationale: '功能性 UI，保留。' },
  { modern: '炸炉', xianxia: '炉崩丹毁', stance: 'xianxia', rationale: '"炸炉"已是修仙炼丹常用词可保留；失败描述古风化（P1-4 已做"炉崩丹毁/化为飞灰"）。' },
  { modern: '血量', xianxia: '气血', stance: 'xianxia', rationale: 'HUD 已用"气血"；描述避免"血量"。' },
  { modern: '蓝量/法力', xianxia: '灵力/真元', stance: 'xianxia', rationale: '凡人体修无灵力——用"灵力/真元"且强调主角绝缘，呼应空灵根设定。' }
];

const MODERN_INDEX: ReadonlyMap<string, GlossaryEntry> = new Map(NARRATIVE_GLOSSARY.map(e => [e.modern, e]));

/** 按现代词查词条；无则 null（调用方应优雅降级，不得凭空调用古风译法）。 */
export function glossaryEntryFor(modern: string): GlossaryEntry | null {
  return MODERN_INDEX.get(modern) ?? null;
}

/** 某现代词是否被判为"古风化"（xianxia）——供后续分批替换的守卫用。 */
export function shouldXianxia(modern: string): boolean {
  const entry = MODERN_INDEX.get(modern);
  return entry?.stance === 'xianxia';
}
