/**
 * 灵韵叙录 · 第一人称沉浸叙事层纯函数状态机（docs/22 §5 / docs/23 §0）。
 *
 * 红线（硬守）：
 *  - 零 `src/sim/` 读写；本模块只依赖 `narrationTypes` 的纯数据契约。
 *  - 纯函数：不调 `Math.random` / `Date.now` / `performance.now`，不引第二随机源。
 *  - 副作用只走 `applyEffects(state, effects)` 声明通道；状态不可变更新（返回新对象/Set）。
 *
 * 本模块是 Wave 1 地基：状态机契约 + 选图/判定纯函数。API 在 Wave 4 的 fast-check
 * 属性测试中被消费，因此签名与语义须保持稳定。后续 wave（narrationSurface）按下述
 * 流转接线：
 *   开场：enterScene(initialState(), firstScene)
 *   推进：const { state: s1, nextSceneId, ending } = nextState(state, scene, choiceId)
 *         若 nextSceneId 非空：enterScene(s1, scenesById[nextSceneId])
 *         若 ending 非空：进入结局展示，记 unlockedEndings/seenEndings
 */

import {
  BOND_THRESHOLD,
  CULT_PROGRESSION_MAX,
  DEFIANCE_THRESHOLD,
  LIFESPAN_MAX,
  MADNESS_LETHAL,
  PILL_POISON_LETHAL,
  TRIBULATION_STAGE_THRESHOLD,
  type Effect,
  type EndingId,
  type LayerKeys,
  type NarrationChoice,
  type NarrationScene,
  type NarrationState
} from './narrationTypes';

// —— 数值状态键（Effect.target 的合法数值目标；未知键在 applyEffects 中安全忽略） ——

type NumericStatKey =
  | 'cultProgress'
  | 'pillPoison'
  | 'madness'
  | 'lifespan'
  | 'tribGrip'
  | 'defiance'
  | 'bond'
  | 'shennongLore';

/** 每个数值状态的合法上下界（applyEffects 按 set/add 钳制）。 */
const STAT_BOUNDS: Readonly<Record<NumericStatKey, readonly [number, number]>> = {
  cultProgress: [0, CULT_PROGRESSION_MAX],
  pillPoison: [0, 100],
  madness: [0, 100],
  lifespan: [0, LIFESPAN_MAX],
  tribGrip: [-100, 100],
  defiance: [0, 100],
  bond: [0, 100],
  shennongLore: [0, 100]
};

const NUMERIC_KEYS: ReadonlySet<NumericStatKey> = new Set<NumericStatKey>(Object.keys(STAT_BOUNDS) as NumericStatKey[]);

function isNumericKey(key: string): key is NumericStatKey {
  return NUMERIC_KEYS.has(key as NumericStatKey);
}

function clamp(value: number, [min, max]: readonly [number, number]): number {
  if (Number.isNaN(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toNumber(raw: number | string | undefined, fallback: number): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

/** 初始 narration 状态（新一周目 / 第一次进入模式）。 */
export function initialState(): NarrationState {
  return {
    cultProgress: 0,
    pillPoison: 0,
    madness: 0,
    lifespan: LIFESPAN_MAX,
    tribGrip: 0,
    defiance: 0,
    bond: 0,
    shennongLore: 0,
    flags: new Set<string>(),
    seenScenes: new Set<string>(),
    currentSceneId: null,
    unlockedEndings: new Set<string>(),
    seenEndings: new Set<string>(),
    introRead: false
  };
}

/** 不可变复制 Set 并写入一个值（不修改入参）。 */
function withFlagAdded(flags: Set<string>, flag: string): Set<string> {
  const next = new Set(flags);
  next.add(flag);
  return next;
}

function withFlagRemoved(flags: Set<string>, flag: string): Set<string> {
  const next = new Set(flags);
  next.delete(flag);
  return next;
}

/**
 * 解释声明式副作用，返回**新**状态（入参不变）。
 *  - `set` / `add`：数值状态按 STAT_BOUNDS 钳制（defiance/bond/shennongLore 等一律 0..100）。
 *  - `flag` / `unflag`：增删 flags 集合。
 *  - `lore`：神农碎片收集，等价于对 `shennongLore` 做 `add`（value 缺省为 1）。
 * 未知 target 与未知 kind 安全忽略（不抛错，保证内容数据 typo 不致运行时崩）。
 */
export function applyEffects(state: NarrationState, effects?: readonly Effect[] | null): NarrationState {
  if (!effects || effects.length === 0) return state;
  let next: NarrationState = state;
  for (const effect of effects) {
    next = applyOne(next, effect);
  }
  return next;
}

function applyOne(state: NarrationState, effect: Effect): NarrationState {
  switch (effect.kind) {
    case 'set': {
      if (!isNumericKey(effect.target)) return state;
      const value = clamp(toNumber(effect.value, 0), STAT_BOUNDS[effect.target]);
      return withNumericStat(state, effect.target, value);
    }
    case 'add': {
      if (!isNumericKey(effect.target)) return state;
      const current = readNumericStat(state, effect.target);
      const delta = toNumber(effect.value, 0);
      return withNumericStat(state, effect.target, clamp(current + delta, STAT_BOUNDS[effect.target]));
    }
    case 'lore': {
      // lore 独立于 add，固定作用于 shennongLore（每条碎片默认 +1），便于 CI 统计与人审。
      const increment = toNumber(effect.value, 1);
      const clamped = clamp(state.shennongLore + increment, STAT_BOUNDS.shennongLore);
      return withNumericStat(state, 'shennongLore', clamped);
    }
    case 'flag': {
      if (!effect.target) return state;
      if (state.flags.has(effect.target)) return state;
      return { ...state, flags: withFlagAdded(state.flags, effect.target) };
    }
    case 'unflag': {
      if (!effect.target || !state.flags.has(effect.target)) return state;
      return { ...state, flags: withFlagRemoved(state.flags, effect.target) };
    }
    default:
      return state;
  }
}

function readNumericStat(state: NarrationState, key: NumericStatKey): number {
  return state[key];
}

function withNumericStat(state: NarrationState, key: NumericStatKey, value: number): NarrationState {
  return { ...state, [key]: value };
}

// —— checkRequires：最小递归下降解析器（不引外部 expr 库） ——

/**
 * 守卫表达式语法（最小可用）：
 *   expr   := term ('||' term)*
 *   term   := factor ('&&' factor)*
 *   factor := 'flag:' name
 *           | '!flag:' name
 *           | stat ( '>=' | '<=' | '>' | '<' | '==' | '!=' ) number
 *           | '(' expr ')'
 *   name   := 标识符（字母/数字/下划线/连字符/点）
 *   stat   := NumericStatKey 之一（defiance/bond/cultProgress/...）
 *
 * 例：`defiance>=60 && bond<50` / `flag:met_xiao` / `!flag:betrayed_villager` /
 *     `(defiance>=60 && bond<50) || flag:forced_choice`。
 *
 * 解析失败 → false（fail-closed：守卫不明确时选项隐藏，避免误放行）。
 */
export function checkRequires(state: NarrationState, requires?: string | null): boolean {
  if (!requires) return true;
  const src = requires.trim();
  if (src.length === 0) return true;
  const parser = new RequiresParser(state, src);
  const result = parser.parseExpression();
  if (!parser.atEnd() || parser.failed) return false;
  return result;
}

interface NumericComparison {
  readonly stat: NumericStatKey;
  readonly op: '>=' | '<=' | '>' | '<' | '==' | '!=';
  readonly threshold: number;
}

class RequiresParser {
  private pos = 0;
  public failed = false;

  constructor(private readonly state: NarrationState, private readonly src: string) {}

  parseExpression(): boolean {
    let value = this.parseTerm();
    while (this.matchOperator('||')) {
      const rhs = this.parseTerm();
      value = value || rhs;
    }
    return value;
  }

  private parseTerm(): boolean {
    let value = this.parseFactor();
    while (this.matchOperator('&&')) {
      const rhs = this.parseFactor();
      value = value && rhs;
    }
    return value;
  }

  private parseFactor(): boolean {
    this.skipWhitespace();
    if (this.peek() === '(') {
      this.advance();
      const inner = this.parseExpression();
      this.skipWhitespace();
      if (this.peek() !== ')') {
        this.failed = true;
        return false;
      }
      this.advance();
      return inner;
    }
    // flag presence / absence
    if (this.matchToken('!flag:')) {
      const name = this.readName();
      if (!name) {
        this.failed = true;
        return false;
      }
      return !this.state.flags.has(name);
    }
    if (this.matchToken('flag:')) {
      const name = this.readName();
      if (!name) {
        this.failed = true;
        return false;
      }
      return this.state.flags.has(name);
    }
    return this.parseNumericComparison();
  }

  private parseNumericComparison(): boolean {
    const stat = this.readName();
    if (!stat) {
      this.failed = true;
      return false;
    }
    if (!isNumericKey(stat)) {
      this.failed = true;
      return false;
    }
    const op = this.readComparator();
    if (!op) {
      this.failed = true;
      return false;
    }
    const threshold = this.readNumber();
    if (Number.isNaN(threshold)) {
      this.failed = true;
      return false;
    }
    const comparison: NumericComparison = { stat, op, threshold };
    return evalComparison(this.state, comparison);
  }

  private readComparator(): '>=' | '<=' | '>' | '<' | '==' | '!=' | null {
    this.skipWhitespace();
    const two = this.src.slice(this.pos, this.pos + 2);
    if (two === '>=' || two === '<=' || two === '==' || two === '!=') {
      this.pos += 2;
      return two;
    }
    const one = this.src[this.pos];
    if (one === '>' || one === '<') {
      this.pos += 1;
      return one;
    }
    return null;
  }

  private readNumber(): number {
    this.skipWhitespace();
    const start = this.pos;
    if (this.src[this.pos] === '-' || this.src[this.pos] === '+') this.pos += 1;
    while (this.pos < this.src.length && /[0-9.]/.test(this.src[this.pos]!)) this.pos += 1;
    const text = this.src.slice(start, this.pos);
    if (text === '' || text === '-' || text === '+') return Number.NaN;
    return Number(text);
  }

  private readName(): string | null {
    this.skipWhitespace();
    const start = this.pos;
    while (this.pos < this.src.length && /[A-Za-z0-9_.\-]/.test(this.src[this.pos]!)) this.pos += 1;
    if (this.pos === start) return null;
    return this.src.slice(start, this.pos);
  }

  private matchToken(token: string): boolean {
    this.skipWhitespace();
    if (this.src.slice(this.pos, this.pos + token.length) === token) {
      this.pos += token.length;
      return true;
    }
    return false;
  }

  private matchOperator(op: '&&' | '||'): boolean {
    this.skipWhitespace();
    if (this.src.slice(this.pos, this.pos + 2) === op) {
      this.pos += 2;
      return true;
    }
    return false;
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos]!)) this.pos += 1;
  }

  private peek(): string | undefined {
    return this.src[this.pos];
  }

  private advance(): void {
    this.pos += 1;
  }

  atEnd(): boolean {
    this.skipWhitespace();
    return this.pos >= this.src.length;
  }
}

function evalComparison(state: NarrationState, comparison: NumericComparison): boolean {
  const actual = readNumericStat(state, comparison.stat);
  switch (comparison.op) {
    case '>=':
      return actual >= comparison.threshold;
    case '<=':
      return actual <= comparison.threshold;
    case '>':
      return actual > comparison.threshold;
    case '<':
      return actual < comparison.threshold;
    case '==':
      return actual === comparison.threshold;
    case '!=':
      return actual !== comparison.threshold;
  }
}

/** 判断选项当前是否可选（requires 满足 且 非一次性已选）。 */
export function isChoiceAvailable(state: NarrationState, sceneId: string, choice: NarrationChoice): boolean {
  if (choice.once && state.flags.has(onceFlag(sceneId, choice.id))) return false;
  return checkRequires(state, choice.requires);
}

/** once 选项选中后写入的 flag 名（稳定命名，便于叙录界面/CI 排查）。 */
export function onceFlag(sceneId: string, choiceId: string): string {
  return `once:${sceneId}:${choiceId}`;
}

// —— 场景进入 / 推进 ——

/**
 * 进入场景：应用 `scene.onEnter`，记 seenScenes，设 currentSceneId。
 * 返回新状态（入参不变）。叶节点场景（无选项）由调用方随后读 `scene.ends` 或 judgeEnding。
 */
export function enterScene(state: NarrationState, scene: NarrationScene): NarrationState {
  const withOnEnter = applyEffects(state, scene.onEnter);
  const seenScenes = withOnEnter.seenScenes.has(scene.id)
    ? withOnEnter.seenScenes
    : withFlagAdded(withOnEnter.seenScenes, scene.id);
  if (seenScenes === withOnEnter.seenScenes && withOnEnter.currentSceneId === scene.id) {
    return withOnEnter;
  }
  return { ...withOnEnter, seenScenes, currentSceneId: scene.id };
}

export interface NextStateResult {
  readonly state: NarrationState;
  /** 下一场景 id（命名空间）；无 goto 且无 ends 时为 null（叶节点，调用方读 ending）。 */
  readonly nextSceneId: string | null;
  /** 触发的结局（choice.ends 优先，否则叶节点用 judgeEnding 兜底判定）。 */
  readonly ending?: EndingId;
}

/**
 * 处理一次抉择：
 *  1. 在 `scene.choices` 中按 id 找到选项；找不到或不可选（requires 不满足 / once 已选）→ 原样返回，nextSceneId=null。
 *  2. 应用 `choice.effects`。
 *  3. 若 choice.once → 写入 `once:<sceneId>:<choiceId>` flag 隐藏。
 *  4. **失败态优先**：应用 effects 后立即 `judgeEnding(next)`；命中（丹毒/走火/大限/雷劫）
 *     则覆盖一切路由——即便 choice 自带 `ends` 或 `goto`，也以失败态为准（docs/22 §7
 *     「失败态优先于一切结局判定」）。这避免「choice 有 goto → 推进到下一场景，但玩家
 *     已触发走火入魔」之类运行时死代码：失败态必须在当前帧收束。
 *  5. 路由：choice.ends 优先（直接终结）> choice.goto（下一场景）> 否则按 judgeEnding 兜底（叶节点）。
 *
 * 注意：本函数**不**应用下一场景的 onEnter（nextScene 对象不在签名内）——调用方拿到
 * nextSceneId 后，对下一场景调用 `enterScene(state, nextScene)` 完成 onEnter + 记 seenScenes。
 * 调用方还需在 enterScene 后再做一次 `judgeEnding`（onEnter effects 也可能致失败态）。
 * 这一分拆保持 nextState 纯函数签名最小，且便于 Wave 4 fast-check 属性测试。
 */
export function nextState(state: NarrationState, scene: NarrationScene, choiceId: string): NextStateResult {
  const choice = scene.choices?.find(candidate => candidate.id === choiceId);
  if (!choice) {
    return { state, nextSceneId: null };
  }
  if (!isChoiceAvailable(state, scene.id, choice)) {
    return { state, nextSceneId: null };
  }

  let next = applyEffects(state, choice.effects);
  if (choice.once) {
    const flag = onceFlag(scene.id, choice.id);
    if (!next.flags.has(flag)) {
      next = { ...next, flags: withFlagAdded(next.flags, flag) };
    }
  }

  // 失败态优先（docs/22 §7）：effects 致死则立即收束，覆盖 ends/goto。
  // 例：choice.effects 将 madness 推到 ≥100 → 走火入魔结局当下触发，不走 goto。
  // 注：此处只判失败态子集（poison/madness/lifespan/tribulation）；e6/e7/ascension 仍由
  // act3.tribulation 等终局场景的 scene.ends 显式触发，避免 onEnter set cult MAX 抢选择。
  const failed = judgeFailState(next);
  if (failed) {
    return { state: markEnding(next, failed), nextSceneId: null, ending: failed };
  }

  if (choice.ends) {
    return { state: markEnding(next, choice.ends), nextSceneId: null, ending: choice.ends };
  }
  if (choice.goto) {
    return { state: next, nextSceneId: choice.goto };
  }
  // 叶节点（无 goto / ends）：用完整 judgeEnding 兜底判定（此处可能命中终局矩阵）。
  const judged = judgeEnding(next);
  if (judged) {
    return { state: markEnding(next, judged), nextSceneId: null, ending: judged };
  }
  return { state: next, nextSceneId: null };
}

/**
 * 把触发的结局登记进 seenEndings / unlockedEndings（跨周目解锁由 surface 持久化层提升）。
 * MEDIUM10：导出给 narrationSurface.showEnding 调用，确保 choice.ends / scene.ends /
 * judgeEnding 三条路径都登记入内存（与 narrationCodex localStorage 一致，便于人审/测试）。
 */
export function markEnding(state: NarrationState, ending: EndingId): NarrationState {
  const seenEndings = state.seenEndings.has(ending) ? state.seenEndings : withFlagAdded(state.seenEndings, ending);
  const unlockedEndings = state.unlockedEndings.has(ending) ? state.unlockedEndings : withFlagAdded(state.unlockedEndings, ending);
  if (seenEndings === state.seenEndings && unlockedEndings === state.unlockedEndings) return state;
  return { ...state, seenEndings, unlockedEndings };
}

// —— 离散化 / 分层选图 ——

/**
 * 把 0..100 的连续值离散成三段：low(<33) / med(<66) / high(≥66)。
 * docs/23 §2：defiance/bond 离散化组合 ≤9 个道心氛围层。入参先钳制到 0..100。
 */
export function bucket(value: number): 'low' | 'med' | 'high' {
  const clamped = clamp(value, [0, 100]);
  if (clamped < 33) return 'low';
  if (clamped < 66) return 'med';
  return 'high';
}

/**
 * 派生本帧图层键。规则：
 *  - `bg` / `npc` / `tribulation` 直传（写手填 manifest AssetId）。
 *  - `daoAmbience`：`'auto'` 时按 `bucket(defiance)` × `bucket(bond)` 拼成
 *    `dao-<defyBucket>-<bondBucket>`（如 `dao-low-med`）；非 auto 直传。
 *  - scene 无 layerKeys → 返回空对象（由 surface 退化为水墨氛围）。
 */
export function deriveLayerKeys(state: NarrationState, scene: NarrationScene): LayerKeys {
  const keys = scene.layerKeys;
  if (!keys) return {};
  const daoAmbience = resolveDaoAmbience(state, keys.daoAmbience);
  return {
    ...(keys.bg !== undefined ? { bg: keys.bg } : {}),
    ...(daoAmbience !== undefined ? { daoAmbience } : {}),
    ...(keys.npc !== undefined ? { npc: keys.npc } : {}),
    ...(keys.tribulation !== undefined ? { tribulation: keys.tribulation } : {})
  };
}

function resolveDaoAmbience(state: NarrationState, declared: 'auto' | string | undefined): string | undefined {
  if (declared === undefined) return undefined;
  if (declared !== 'auto') return declared;
  return `dao-${bucket(state.defiance)}-${bucket(state.bond)}`;
}

// —— 结局判定（docs/22 §7 + docs/23 §3 阈值矩阵） ——

/**
 * 失败态判定纯函数（docs/22 §7 失败态优先子集：前 4 项）。仅含致死条件，**不含**
 * defiance/cultProgress 终局矩阵（e6/e7/ascension 仍由 `act3.tribulation` 等场景的
 * `scene.ends` 显式收束——否则进入 act3.tribulation 时 onEnter 把 cultProgress set 到
 * MAX 会立即判 ascension，玩家看不到终局天道诘问三选项）。
 *
 * 任一命中即返回对应 EndingId；否则返回 null（仍可推进）。
 *  1. pillPoison ≥ 100 → poison-death
 *  2. madness ≥ 100 → madness
 *  3. lifespan ≤ 0 → lifespan-death
 *  4. tribGrip < 0 且 cultProgress ≥ TRIBULATION_STAGE_THRESHOLD（渡劫中失利）→ tribulation-death
 */
export function judgeFailState(state: NarrationState): EndingId | null {
  if (state.pillPoison >= PILL_POISON_LETHAL) return 'poison-death';
  if (state.madness >= MADNESS_LETHAL) return 'madness';
  if (state.lifespan <= 0) return 'lifespan-death';
  if (state.tribGrip < 0 && state.cultProgress >= TRIBULATION_STAGE_THRESHOLD) return 'tribulation-death';
  return null;
}

/**
 * 终局/失败态判定纯函数。优先级（前述覆盖后者）：
 *  1. pillPoison ≥ 100 → poison-death
 *  2. madness ≥ 100 → madness
 *  3. lifespan ≤ 0 → lifespan-death
 *  4. tribGrip < 0 且 cultProgress ≥ TRIBULATION_STAGE_THRESHOLD（渡劫中）→ tribulation-death
 *  5. defiance ≥ DEFIANCE_THRESHOLD：bond ≥ BOND_THRESHOLD → e6-sacrifice，否则 → e7-usurp
 *  6. cultProgress ≥ CULT_PROGRESSION_MAX（凡骨修到飞升前夜，tribGrip 仍 ≥0）→ ascension
 *  7. 其余 → null（仍在推进中；叶节点由 scene.ends 显式收束为 lifespan-death 等认命分支）
 *
 * 说明：`lifespan-death` 有两种到达路径——(a) 本函数失败态 `lifespan<=0`；(b) 场景叶节点
 * 显式 `ends:'lifespan-death'`（第一幕「埋藏归隐」凡人蒙太奇 / 终局凡骨归田）。两条路径
 * 都映射到同一 EndingId，由 nextState/markEnding 统一登记。
 *
 * 运行时使用约定（docs/22 §7 失败态优先）：
 *  - **失败态子集**（1-4 项）由 {@link judgeFailState} 单独暴露，供 `nextState`/`enterScene`
 *    在每次 choice.effects/onEnter 应用后立即判定——玩家撞 madness/pillPoison/lifespan/劫
 *    阈值当下即收束，覆盖 choice.goto/ends 路由。
 *  - **完整 judgeEnding**（含 5-6 项终局矩阵）只在终局叶节点（act3.e6/e7/ascend 自带 ends
 *    的兄弟节点 act3.tribulation）由 `scene.ends` 显式触发，避免 act3.tribulation.onEnter
 *    set cult MAX 后立刻判 ascension 抢走玩家选择。
 */
export function judgeEnding(state: NarrationState): EndingId | null {
  const fail = judgeFailState(state);
  if (fail) return fail;

  if (state.defiance >= DEFIANCE_THRESHOLD) {
    return state.bond >= BOND_THRESHOLD ? 'e6-sacrifice' : 'e7-usurp';
  }

  if (state.cultProgress >= CULT_PROGRESSION_MAX) return 'ascension';

  return null;
}
