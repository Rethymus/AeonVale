/**
 * 灵韵叙录（第一人称沉浸叙事模式）公共类型契约。
 *
 * 红线（docs/23 §0）：
 *  - narration 层只读不写 `src/sim/`；本文件仅含类型与常量，零运行时副作用、零 IO。
 *  - 选图 / 判定用纯函数（见 `firstPersonView.ts`），不引第二随机源。
 *
 * 本模块是 Wave 1 地基：类型契约 + 阈值常量。后续 wave（narrationScenes /
 * narrationVN / narrationSurface / narrationCodex）都依赖此处 schema，字段保持稳定。
 *
 * Scene schema 对齐 docs/23 §1（在序章/第一幕既有 `{cgAssetId,lines,choices,converge}`
 * 之上扩展 `id/act/layerKeys/onEnter/ends/status/locale` 与 choice 的
 * `requires/effects/goto/once/tags/speaker/ends`）。
 */

/** 幕标识：序章 + 三幕主线（docs/22 §6 四幕骨架）。 */
export type NarrationAct = 'prologue' | 1 | 2 | 3;

/**
 * 结局标识（docs/22 §7）。
 *  - E0 林中第四日（序章早夭支线）
 *  - 5 失败/类型结局：飞升 / 丹毒亡 / 渡劫身死 / 走火入魔 / 寿终
 *  - E6 觉醒·牺牲救世 / E7 觉醒·合道驱逐（终局天道诘问，defiance≥门槛时触发）
 */
export type EndingId =
  | 'e0-mushroom'
  | 'ascension'
  | 'poison-death'
  | 'tribulation-death'
  | 'madness'
  | 'lifespan-death'
  | 'e6-sacrifice'
  | 'e7-usurp';

/** 全部结局清单（供叙录界面图鉴墙遍历，顺序即图鉴陈列顺序）。 */
export const ENDING_IDS: readonly EndingId[] = [
  'e0-mushroom',
  'ascension',
  'poison-death',
  'tribulation-death',
  'madness',
  'lifespan-death',
  'e6-sacrifice',
  'e7-usurp'
];

/**
 * 声明式副作用（docs/23 §0/§1）。narration 层唯一允许的状态改动通道——
 * 选图/判定纯函数不埋隐式变量改动，所有变动必须经 `effects` 声明，由
 * `firstPersonView.applyEffects` 统一解释。
 *  - `set`：数值状态直赋；target 为数值状态键（见 `NumericStatKey`）。
 *  - `add`：数值状态增减；target 为数值状态键。
 *  - `flag`：置一个剧情 flag（一次性事件 / once 选项隐藏 / 解锁标记）。
 *  - `unflag`：清除一个 flag。
 *  - `lore`：神农线索碎片收集（等价于 add shennongLore，但语义独立，便于人审/CI 统计）。
 */
export type EffectKind = 'set' | 'add' | 'flag' | 'unflag' | 'lore';

export interface Effect {
  readonly kind: EffectKind;
  /** 目标键名：数值状态键（set/add）或 flag 名（flag/unflag）；`lore` 时忽略。 */
  readonly target: string;
  /** 数值（set/add/lore）；flag/unflag 时忽略。 */
  readonly value?: number | string;
}

/** speaker：从 `Line{text,speaker?}` 中拎出，决定六色 token / 字形 / blip 音轨（docs/23 §5）。 */
export type Speaker = 'narrator' | 'master' | 'heart-demon' | 'intuition' | 'self' | 'system';

/** 单行旁白/对白（docs/23 §1：speaker 从文本拎出到结构字段）。 */
export interface NarrationLine {
  readonly text: string;
  readonly speaker?: Speaker;
  /** 条件行：仅在守卫满足时进入本次演出队列，用于让后文真实承认此前选择。 */
  readonly requires?: string;
}

/** 分层选图键（docs/23 §2）。`daoAmbience:'auto'` 由纯函数按道心分桶派生。 */
export interface LayerKeys {
  /** 背景 AssetId（cg.first-person.*）。 */
  readonly bg?: string;
  /** 道心氛围层：`'auto'` 时由 `deriveLayerKeys` 按 defiance/bond 分桶拼键；否则直传。 */
  readonly daoAmbience?: 'auto' | string;
  /** NPC 立绘层 AssetId。 */
  readonly npc?: string;
  /** 渡劫层 AssetId。 */
  readonly tribulation?: string;
}

/** 选项（docs/23 §1）。 */
export interface NarrationChoice {
  readonly id: string;
  readonly label: string;
  /** 选中后浮现的单段回应（兼容旧数据；新内容优先使用 responseLines）。 */
  readonly response?: string;
  /**
   * 选中后的独有兑现段。全部演完后才进入 converge / goto，避免“一句话回应后立刻弹回 hub”。
   * 可混用 narrator / self / heart-demon 等声部。
   */
  readonly responseLines?: readonly NarrationLine[];
  /** 守卫表达式（见 `firstPersonView.checkRequires` 的最小语法）。 */
  readonly requires?: string;
  readonly effects?: readonly Effect[];
  /** 下一场景 id（命名空间如 `act2.tribulation.grip-1`）。 */
  readonly goto?: string;
  /** 一次性选项：选中后写入 flag（`once:<sceneId>:<choiceId>`）隐藏，不再出现。 */
  readonly once?: boolean;
  /**
   * 内容/演出标签。`hide-when-unavailable` 用于互斥剧情分支：守卫不满足时完全隐藏，
   * 避免把另一条人生以“锁定选项”形式提前剧透；普通 requires 仍渲染锁因。
   */
  readonly tags?: readonly string[];
  readonly speaker?: Speaker;
  /** 直接终结到指定结局（优先于 goto 与 judgeEnding）。 */
  readonly ends?: EndingId;
}

/** 场景（docs/23 §1，扩展现有 StoryScene/PrologueScene）。 */
export interface NarrationScene {
  /** 命名空间 id，如 `prologue.valley`、`act1.scroll`、`act3.tribulation.question`。 */
  readonly id: string;
  readonly act: NarrationAct;
  readonly layerKeys?: LayerKeys;
  readonly lines: readonly NarrationLine[];
  readonly choices?: readonly NarrationChoice[];
  /** 任一选项后浮现的收敛行（漏斗汇流）。 */
  readonly converge?: string;
  /**
   * 回访演出策略。`choices-only` 表示第一次完整播放 lines，之后回到本节点时直接列选项，
   * 适用于训练/村落/storylet hub，防止导航往返反复重播同一段开场。
   */
  readonly revisitMode?: 'choices-only';
  /** 进入本场景时一次性应用的声明式副作用。 */
  readonly onEnter?: readonly Effect[];
  /** 场景直接终结到指定结局（无选项的叶节点场景）。 */
  readonly ends?: EndingId;
  /** 人审状态：CI 拒 `status!=='approved'` 的 Scene 进 narrationScenes 入口（Wave 4 落实）。 */
  readonly status: 'draft' | 'review' | 'approved';
  /** 文案语种（默认 zh-CN；预留 en）。 */
  readonly locale?: string;
}

/** narration 层独立状态机的全部状态变量（docs/22 §5）。纯数据，不进 src/sim/。 */
export interface NarrationState {
  /** 体修进度（阶段 0..CULT_PROGRESSION_MAX）→ 飞升判定。 */
  readonly cultProgress: number;
  /** 丹毒（0..100）→ 丹毒亡。 */
  readonly pillPoison: number;
  /** 走火值（0..100）→ 走火入魔。 */
  readonly madness: number;
  /** 寿元（0..LIFESPAN_MAX）→ 寿终。 */
  readonly lifespan: number;
  /** 渡劫把握（-100..100）→ 渡劫身死 vs 飞升。 */
  readonly tribGrip: number;
  /** 反抗觉醒度（0..100，门槛 DEFIANCE_THRESHOLD）→ E6/E7 触发。 */
  readonly defiance: number;
  /** 红尘羁绊总量（0..100，阈值 BOND_THRESHOLD）→ E6 vs E7 走向。 */
  readonly bond: number;
  /** 神农碎片收集度（0..100）→ 揭示完整度（不影响结局分支）。 */
  readonly shennongLore: number;
  /** 剧情 flag 集合：一次性事件 / once 选项隐藏 / 解锁标记。 */
  readonly flags: Set<string>;
  /** 本周目已历场景 id 集合（叙录界面 seen 状态机）。 */
  readonly seenScenes: Set<string>;
  /** 当前所在场景 id（null = 尚未开场）。 */
  readonly currentSceneId: string | null;
  /** 跨周目已解锁结局 id 集合（叙录图鉴墙 unlocked，走 localStorage / serialize meta 段）。 */
  readonly unlockedEndings: Set<string>;
  /** 本周目已见证结局 id 集合（图鉴墙 seen）。 */
  readonly seenEndings: Set<string>;
  /** 开发者自白是否已读（第二次点入口「已读跳过」，docs/22 §2.4）。 */
  readonly introRead: boolean;
}

// —— 阈值 / 边界常量（docs/22 §7 用 60/50 示意；最终值由 balance-sweep-tune 调参） ——

/** 反抗觉醒度门槛：defiance ≥ 60 进入 E6/E7 终局矩阵。 */
export const DEFIANCE_THRESHOLD = 60;
/** 红尘羁绊阈值：在 defiance≥门槛时，bond ≥ 50 → E6 牺牲救世，否则 → E7 合道驱逐。 */
export const BOND_THRESHOLD = 50;

/** 体修进度上限（对齐 HUD stages 8 段，索引 0..7：凡骨→飞升前夜）。 */
export const CULT_PROGRESSION_MAX = 7;
/** 进入「渡劫中」的体修阶段下限（雷骨=6 及以上视为主动引劫淬体）。 */
export const TRIBULATION_STAGE_THRESHOLD = 6;
/** 寿元初始/上限（抽象寿元单位，0 即大限）。 */
export const LIFESPAN_MAX = 100;

/** 数值失败态阈值（docs/22 §7：任意幕可提前触发）。 */
export const PILL_POISON_LETHAL = 100;
export const MADNESS_LETHAL = 100;
