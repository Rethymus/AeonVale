/**
 * 灵韵叙录 · 叙录界面（docs/22 §11 / docs/23 §4）。
 *
 * 三区：
 *  - 顶栏章节轨：4 幕岛横排（序章/一/二/终），当前幕高亮、已过打勾、未到灰显；
 *    右侧「已见证结局 X/8」徽章。
 *  - 主区节点图：按 {@link NARRATION_SCENES} 建 DAG（scene=节点，choice.goto=边），
 *    节点形状编码 ●剧情 ◆抉择 ■场景 ▲汇流 ✕劫损 🔒跨章；已走 seen 亮，未走两档
 *    （Detroit ??? 当前周目邻路 / VN ?+≤14字线索 跨周目未触发）。
 *  - 侧栏结局图鉴墙：8 卡（docs/22 §7），已解锁=CG+名+主题标，未解锁=问号+≤14字线索。
 *
 * 状态机（docs/23 §4）：seen(当前存档) / unlocked(跨周目历史) / locked(从未触发)。
 * 防剧透工程化：本周目/跨周目数据**物理分离两张 localStorage 表**（seenThisRun vs
 * seenScenesEver / seenEndings）；locked CG 不进首屏（仅 seen 节点才解析 CG URL）。
 *
 * 红线（硬守）：
 *  - 只读 narrationScenes 纯数据；零 `src/sim/` 访问；运行时不调 AI 模型。
 *  - 不改 NarrationScene 公开 schema——节点显示元数据（title/clue）为本模块私有查表，
 *    Scene 表不增字段（向后兼容）。
 *  - 副作用仅 localStorage 读写（防剧透分层存储），由 narrationSurface 推进时调用本模块的
 *    `beginNewRun` / `recordSeenScene` / `recordEnding` 写入；本模块 open() 只读。
 */

import { t } from '@content/i18n';
import { NARRATION_SCENES, NARRATION_SCENES_BY_ID } from './narrationScenes';
import { ENDING_IDS, type EndingId, type NarrationAct, type NarrationScene } from './narrationTypes';

// —— localStorage 物理分层（docs/23 §4） ——
const RUN_KEY = 'narration.codex.seenThisRun';
const SCENES_EVER_KEY = 'narration.codex.seenScenesEver';
const ENDINGS_KEY = 'narration.codex.seenEndings';

export interface NarrationCodexStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): NarrationCodexStorage {
  return {
    getItem(key: string): string | null {
      if (typeof localStorage === 'undefined') return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key, value);
      } catch {
        /* 配额/隐私模式：静默降级（叙录退化为纯本周目只读视图） */
      }
    }
  };
}

function readArray(storage: NarrationCodexStorage, key: string): string[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

function writeArray(storage: NarrationCodexStorage, key: string, values: readonly string[]): void {
  storage.setItem(key, JSON.stringify(values));
}

/** 新一周目开始：清空「本周目已历」表（跨周目 seenScenesEver / seenEndings 不动）。 */
export function beginNewRun(storage: NarrationCodexStorage = defaultStorage()): void {
  writeArray(storage, RUN_KEY, []);
}

/** 推进时登记一个已历场景：写入本周目表 + 跨周目追加表（幂等）。 */
export function recordSeenScene(sceneId: string, storage: NarrationCodexStorage = defaultStorage()): void {
  const run = readArray(storage, RUN_KEY);
  if (!run.includes(sceneId)) {
    run.push(sceneId);
    writeArray(storage, RUN_KEY, run);
  }
  const ever = readArray(storage, SCENES_EVER_KEY);
  if (!ever.includes(sceneId)) {
    ever.push(sceneId);
    writeArray(storage, SCENES_EVER_KEY, ever);
  }
}

/** 触发结局：写入跨周目结局表（幂等）。 */
export function recordEnding(endingId: string, storage: NarrationCodexStorage = defaultStorage()): void {
  const seen = readArray(storage, ENDINGS_KEY);
  if (!seen.includes(endingId)) {
    seen.push(endingId);
    writeArray(storage, ENDINGS_KEY, seen);
  }
}

function readSeenThisRun(storage: NarrationCodexStorage): Set<string> {
  return new Set(readArray(storage, RUN_KEY));
}
function readSeenScenesEver(storage: NarrationCodexStorage): Set<string> {
  return new Set(readArray(storage, SCENES_EVER_KEY));
}
/** 对外只读：跨周目已见证结局集合（供图鉴墙 unlocked 判定）。 */
export function readSeenEndings(storage: NarrationCodexStorage = defaultStorage()): Set<string> {
  return new Set(readArray(storage, ENDINGS_KEY));
}

// —— 节点显示元数据（私有查表，Scene schema 不动） ——

interface SceneMeta {
  /** 节点名（≤6 字，seen 时显示）。可含专名（已揭示）。 */
  readonly title: string;
  /** ≤14 字线索（unlocked 跨周目档显示）。禁专名/数字/因果连接词（docs/23 §4 content-lint）。 */
  readonly clue: string;
}

const SCENE_META: Readonly<Record<string, SceneMeta>> = {
  'prologue.awaken': { title: '睁眼·山谷', clue: '林深处或荒村那头' },
  'prologue.deep': { title: '林深处', clue: '深处迷路，一念之差' },
  'prologue.village': { title: '荒村', clue: '落空之后，仍可伸手' },
  'prologue.village.calm': { title: '村稍安', clue: '稍作歇脚，再问前路' },
  'prologue.depart': { title: '赴宗途中', clue: '善意随脚步传开' },
  'prologue.depart.road': { title: '山道义举', clue: '一前一后，两桩麻烦' },
  'prologue.depart.token': { title: '赠木哨', clue: '一枚木哨，一道旧纹' },
  'prologue.depart.spread': { title: '名声传开', clue: '山道之上，薄有声名' },
  'prologue.depart.silent': { title: '独上山门', clue: '绕开求助，独自走完山路' },
  'prologue.sect': { title: '测灵', clue: '当众一试，高下立判' },
  'prologue.return': { title: '递锄头', clue: '一把旧锄，一句无言' },
  'act1.battle': { title: '斗法余波', clue: '天降横祸，一物遗落' },
  'act1.battle.sky': { title: '天上对照', clue: '顺天者雁，逆天者雷' },
  'act1.battle.cellar': { title: '地窖避劫', clue: '强者斗法，凡人先求活命' },
  'act1.battle.stare': { title: '一瞬对视', clue: '他记住了，这张脸' },
  'act1.ring': { title: '储物戒', clue: '无主之物，凡手可开' },
  'act1.ring.attempts': { title: '三次试开', clue: '戒指只认真正的来处' },
  'act1.ring.flash': { title: '开戒一闪', clue: '金黄的田，简体的字' },
  'act1.ring.oldman': { title: '戒中无人', clue: '期待落空，只余遗物' },
  'act1.scroll': { title: '翻残卷', clue: '字字惊心，竟似旧识' },
  'act1.reveal': { title: '拼出真相', clue: '一线串起，此身有异' },
  'act1.seclude': { title: '埋骨归田', clue: '一念放下，便是一生' },
  'act2.train': { title: '灵田', clue: '田与炉之间，自择其重' },
  'act2.train.lore-hub': { title: '田侧旧迹', clue: '田埂石像与泛黄村志' },
  'act2.temper': { title: '引劫淬体', clue: '以雷为窑，碎而复生' },
  'act2.temper.late': { title: '更深的劫', clue: '云后目光，识海开口' },
  'act2.temper.stage1': { title: '察漏', clue: '先辨认仍可决定的余量' },
  'act2.temper.stage2': { title: '引路', clue: '让错误方向更难通行' },
  'act2.temper.stage3': { title: '借势', clue: '来势与去势都留下痕迹' },
  'act2.temper.stage4': { title: '淬骨', clue: '停雷三息，让万物分担' },
  'act2.temper.stage5': { title: '守我', clue: '为不能烧去的记忆留锚' },
  'act2.temper.stage6': { title: '归一', clue: '独自承受或承认彼此' },
  'act2.alchemy': { title: '炼丹', clue: '一炉暗红，半是灵药' },
  'act2.peek': { title: '窥天机', clue: '深一层，险一分' },
  'act2.farm-lore': { title: '巡田', clue: '地肥有因，非天所赐' },
  'act2.relic-lore': { title: '无面石像', clue: '荒草间，被摸亮的石' },
  'act2.annals-lore': { title: '村志', clue: '旧账里，藏着一笔' },
  'act2.side.hub': { title: '出村', clue: '世道比田里复杂' },
  'act2.side.more-hub': { title: '再往前', clue: '风波比拳脚更险' },
  'act2.side.bully': { title: '欺凌', clue: '出手或低头，一念间' },
  'act2.side.herb': { title: '求救', clue: '一声呼救，回不回应' },
  'act2.side.bribe': { title: '利诱', clue: '半句入伙，半生难洗' },
  'act2.side.whistle': { title: '黑幕', clue: '说与不说，都是祸' },
  'act2.side.xiao': { title: '剑光再现', clue: '顺天者，来清异端' },
  'act2.xiao-death': { title: '化劫灰', clue: '蝼蚁终是蝼蚁' },
  'act2.madness-death': { title: '走火入魔', clue: '万不存一，反噬其主' },
  'act2.side.famine': { title: '荒年', clue: '一口粮，一条命' },
  'act2.famine-death': { title: '倒于树下', clue: '落叶满身，异乡异土' },
  'act2.village.hub': { title: '荒村日常', clue: '凡人时候，有人记得' },
  'act2.village.ditch': { title: '修渠', clue: '重定坡度，水与灵气同归' },
  'act2.village.market': { title: '辨毒灵米', clue: '旧错后来替别人挡灾' },
  'act2.village.song': { title: '童谣', clue: '无面人种田，孩子嘴唱' },
  'act2.encounter.hub': { title: '山道同道', clue: '修士也走这条道' },
  'act2.encounter.wanderer': { title: '逆的旧宿', clue: '半张阵图与一笔旧账' },
  'act2.encounter.herbgirl': { title: '药田再会', clue: '救过的人也有自己的路' },
  'act2.encounter.herbgirl-cold': { title: '失约之后', clue: '旧伤站在面前，不能回避' },
  'act2.encounter.artificer': { title: '护田阵', clue: '守阵与夺阵只差四笔' },
  'act2.encounter.ring-peek': { title: '夹层便笺', clue: '写给后来者的分担之法' },
  'act3.entry': { title: '神农洞府', clue: '一片田，一个旧人' },
  'act3.cave.entrance': { title: '浮雕六图', clue: '六幅浮雕，等己指认' },
  'act3.cave.lab': { title: '实验台', clue: '图表公式，旧世之字' },
  'act3.cave.faceless': { title: '无面石像', clue: '半页残纸，留与后人' },
  'act3.cave.light': { title: '一线劫光', clue: '一线劫光，再念一遍' },
  'act3.preparation': { title: '劫前清点', clue: '只带上此前真正留下的' },
  'act3.tribulation': { title: '终劫·察漏', clue: '紫雷核对六次旧伤' },
  'act3.tribulation.route': { title: '终劫·引路', clue: '骨线与泄口守住正路' },
  'act3.tribulation.borrow': { title: '终劫·借势', clue: '借回卷之力钉住淬炼' },
  'act3.tribulation.recast': { title: '终劫·重塑', clue: '新骨保留每一道代价' },
  'act3.tribulation.question': { title: '天道诘问', clue: '最后一步由谁的意志走出' },
  'act3.e6': { title: '自择', clue: '心声起处，选项消失' },
  'act3.e7': { title: '驱逐', clue: '隔屏一眼，滚出此界' },
  'act3.ascend': { title: '飞升', clue: '答天之后，此我非我' }
};

// —— 节点类型（形状编码 docs/23 §4） ——

type SceneType = 'story' | 'choice' | 'scene' | 'confluence' | 'damage' | 'cross-act';

const TERMINAL_ENDINGS = new Set<string>(['act3.e6', 'act3.e7', 'act3.ascend']);
const CONFLUENCE_HUBS = new Set<string>(['act2.side.hub', 'act2.side.more-hub', 'act2.train.lore-hub']);

function isFailureLeaf(scene: NarrationScene): boolean {
  // 显式失败/死亡叶节点（不含终局 e6/e7/ascend，那些归 confluence）。
  if (!scene.ends) return false;
  return scene.ends === 'e0-mushroom' || scene.ends === 'tribulation-death' || scene.ends === 'lifespan-death' || scene.ends === 'poison-death' || scene.ends === 'madness';
}

/** 节点类型分类（优先级 ruleset）。 */
function classifyScene(scene: NarrationScene): SceneType {
  if (TERMINAL_ENDINGS.has(scene.id)) return 'confluence';
  if (isFailureLeaf(scene)) return 'damage';
  if (CONFLUENCE_HUBS.has(scene.id)) return 'confluence';
  // 跨章门户：任一 choice.goto 跨入下一幕。
  const choices = scene.choices ?? [];
  for (const choice of choices) {
    if (!choice.goto) continue;
    const target = NARRATION_SCENES_BY_ID.get(choice.goto);
    if (target && target.act !== scene.act) return 'cross-act';
  }
  if (scene.id.includes('lore') || scene.id === 'act2.peek') return 'scene';
  if ((scene.choices?.length ?? 0) >= 2) return 'choice';
  return 'story';
}

function typeGlyph(type: SceneType): string {
  switch (type) {
    case 'choice':
      return '◆';
    case 'scene':
      return '■';
    case 'confluence':
      return '▲';
    case 'damage':
      return '✕';
    case 'cross-act':
      return '🔒';
    case 'story':
    default:
      return '●';
  }
}

function typeLabel(type: SceneType): string {
  switch (type) {
    case 'choice':
      return t('narration.codex.nodeChoice');
    case 'scene':
      return t('narration.codex.nodeScene');
    case 'confluence':
      return t('narration.codex.nodeConfluence');
    case 'damage':
      return t('narration.codex.nodeDamage');
    case 'cross-act':
      return t('narration.codex.nodeCrossAct');
    case 'story':
    default:
      return t('narration.codex.nodeStory');
  }
}

// —— 幕与结局辅助 ——

function actIndex(act: NarrationAct): number {
  if (act === 'prologue') return 0;
  return act;
}

function actLabel(act: NarrationAct): string {
  switch (act) {
    case 'prologue':
      return t('narration.codex.actPrologue');
    case 1:
      return t('narration.codex.act1');
    case 2:
      return t('narration.codex.act2');
    case 3:
      return t('narration.codex.act3');
  }
}

type EndingTopic = 'good' | 'doom' | 'hidden';

function endingTopic(ending: EndingId): EndingTopic {
  switch (ending) {
    case 'ascension':
    case 'e6-sacrifice':
      return 'good';
    case 'lifespan-death':
    case 'e7-usurp':
      return 'hidden';
    case 'e0-mushroom':
    case 'poison-death':
    case 'tribulation-death':
    case 'madness':
    default:
      return 'doom';
  }
}

function topicLabel(topic: EndingTopic): string {
  switch (topic) {
    case 'good':
      return t('narration.codex.topicGood');
    case 'doom':
      return t('narration.codex.topicDoom');
    case 'hidden':
      return t('narration.codex.topicHidden');
  }
}

// —— 图邻接（ predecessors ∪ successors） ——

function buildPredecessorMap(): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const scene of NARRATION_SCENES) {
    const choices = scene.choices ?? [];
    for (const choice of choices) {
      if (!choice.goto) continue;
      const list = map.get(choice.goto) ?? [];
      if (!list.includes(scene.id)) list.push(scene.id);
      map.set(choice.goto, list);
    }
  }
  return map;
}

function neighbors(sceneId: string, predecessorMap: ReadonlyMap<string, readonly string[]>): Set<string> {
  const set = new Set<string>();
  const scene = NARRATION_SCENES_BY_ID.get(sceneId);
  if (scene) {
    for (const choice of scene.choices ?? []) {
      if (choice.goto) set.add(choice.goto);
    }
  }
  for (const pred of predecessorMap.get(sceneId) ?? []) set.add(pred);
  return set;
}

// —— 节点状态机（docs/23 §4） ——

type NodeState = 'seen' | 'unlocked' | 'locked';

function nodeState(
  sceneId: string,
  runSet: Set<string>,
  everSet: Set<string>
): NodeState {
  if (runSet.has(sceneId)) return 'seen';
  if (everSet.has(sceneId)) return 'unlocked';
  return 'locked';
}

/** Detroit 档：locked 且为本周目邻路（未走过但紧邻本周目路径）。 */
function isDetroitAdjacent(
  sceneId: string,
  runSet: Set<string>,
  predecessorMap: ReadonlyMap<string, readonly string[]>
): boolean {
  const adjacent = neighbors(sceneId, predecessorMap);
  for (const n of adjacent) {
    if (runSet.has(n)) return true;
  }
  return false;
}

// —— 控制器 ——

export interface NarrationCodexOptions {
  readonly root: HTMLElement;
  readonly reducedMotion: boolean;
  /** manifest AssetId → 运行时 URL（仅 seen 节点/结局解析，locked 不进首屏）。 */
  readonly assetUrlForId: (assetId: string) => string | undefined;
  readonly storage?: NarrationCodexStorage;
}

export interface NarrationCodexController {
  /** 读 localStorage + NARRATION_SCENES，渲染三区。 */
  open(): void;
  /** 拆 DOM（不删 root 本身）。 */
  destroy(): void;
}

const MAX_CLUE_CHARS = 14;
const MAX_LINE_CHARS = 40;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function sceneFirstLine(scene: NarrationScene): string {
  const first = scene.lines[0];
  return first ? first.text : '';
}

function sceneCgAssetId(scene: NarrationScene): string | undefined {
  return scene.layerKeys?.bg;
}

function endingCgAssetId(ending: EndingId): string {
  return `cg.first-person.ending.${ending}-v2`;
}

export function createNarrationCodex(options: NarrationCodexOptions): NarrationCodexController {
  const root = options.root;
  const storage = options.storage ?? defaultStorage();
  const reducedMotion = options.reducedMotion;
  let destroyed = false;
  /** open 后的边重绘闭包；destroy / 下次 open 时清空。 */
  let redrawEdges: (() => void) | null = null;
  let resizeHandler: (() => void) | null = null;

  function clearEdgeListeners(): void {
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    redrawEdges = null;
  }

  function open(): void {
    if (destroyed) return;
    clearEdgeListeners();
    root.textContent = '';
    root.setAttribute('data-codex-host', 'true');
    // `codex-host` 类是 CSS 布局钩子（docs/23 §4）：把三区排成
    // 「顶栏章节轨整行 + 节点图|结局墙并列」的扫描友好布局。
    root.classList.add('codex-host');
    if (reducedMotion) root.dataset.reducedMotion = 'true';

    const runSet = readSeenThisRun(storage);
    const everSet = readSeenScenesEver(storage);
    const seenEndings = readSeenEndings(storage);
    const predecessorMap = buildPredecessorMap();

    const fragment = document.createDocumentFragment();
    fragment.appendChild(renderTrack(runSet));
    const { graph, paintEdges } = renderGraph(runSet, everSet, predecessorMap);
    fragment.appendChild(graph);
    fragment.appendChild(renderWall(seenEndings));
    root.appendChild(fragment);

    // DOM 入树后再量 rect 画边；resize 时重画。
    redrawEdges = paintEdges;
    const schedulePaint = (): void => {
      if (destroyed || !redrawEdges) return;
      redrawEdges();
    };
    requestAnimationFrame(schedulePaint);
    resizeHandler = schedulePaint;
    window.addEventListener('resize', resizeHandler);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    clearEdgeListeners();
    root.textContent = '';
    root.removeAttribute('data-codex-host');
    root.classList.remove('codex-host');
    delete root.dataset.reducedMotion;
  }

  // —— 顶栏章节轨 ——
  function renderTrack(runSet: Set<string>): HTMLElement {
    const track = document.createElement('div');
    track.className = 'codex-track';
    track.dataset.codexRegion = 'track';
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', t('narration.codex.regionTrack'));

    // 计算每幕是否本周目涉足 + 当前幕（涉足的最高幕）。
    const actsTouched = new Set<number>();
    let currentAct = -1;
    for (const scene of NARRATION_SCENES) {
      if (runSet.has(scene.id)) {
        const idx = actIndex(scene.act);
        actsTouched.add(idx);
        if (idx > currentAct) currentAct = idx;
      }
    }

    const ol = document.createElement('ol');
    ol.className = 'codex-track-acts';
    const actIds: NarrationAct[] = ['prologue', 1, 2, 3];
    for (const act of actIds) {
      const idx = actIndex(act);
      const touched = actsTouched.has(idx);
      const li = document.createElement('li');
      li.className = 'codex-track-act';
      li.dataset.act = String(idx);
      const state = touched ? (idx === currentAct ? 'current' : 'passed') : 'future';
      li.dataset.state = state;
      const mark = document.createElement('span');
      mark.className = 'codex-track-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = state === 'passed' ? '✓' : state === 'current' ? '◉' : '○';
      const label = document.createElement('span');
      label.className = 'codex-track-label';
      label.textContent = actLabel(act);
      li.append(mark, label);
      li.setAttribute('aria-label', `${actLabel(act)}：${state === 'passed' ? '已过' : state === 'current' ? '当前' : '未至'}`);
      ol.appendChild(li);
    }
    track.appendChild(ol);

    const progress = document.createElement('p');
    progress.className = 'codex-track-progress';
    progress.textContent = t('narration.codex.chapterProgress', { x: actsTouched.size });
    track.appendChild(progress);
    track.appendChild(renderEndingBadge(readSeenEndings(storage)));
    return track;
  }

  function renderEndingBadge(seenEndings: Set<string>): HTMLElement {
    const badge = document.createElement('p');
    badge.className = 'codex-track-endings';
    badge.textContent = t('narration.codex.endingWall', { x: seenEndings.size });
    return badge;
  }

  // —— 主区节点图 ——
  interface GraphRender {
    readonly graph: HTMLElement;
    /** 对同幕 seen/unlocked 节点按 choice.goto 画 SVG 边（locked 不连）。 */
    readonly paintEdges: () => void;
  }

  function renderGraph(
    runSet: Set<string>,
    everSet: Set<string>,
    predecessorMap: ReadonlyMap<string, readonly string[]>
  ): GraphRender {
    const graph = document.createElement('div');
    graph.className = 'codex-graph';
    graph.dataset.codexRegion = 'graph';
    graph.setAttribute('role', 'group');
    graph.setAttribute('aria-label', t('narration.codex.regionGraph'));

    const actSections: Array<{
      readonly section: HTMLElement;
      readonly list: HTMLElement;
      readonly scenes: readonly NarrationScene[];
    }> = [];

    const actIds: NarrationAct[] = ['prologue', 1, 2, 3];
    for (const act of actIds) {
      const scenes = NARRATION_SCENES.filter(scene => scene.act === act);
      if (scenes.length === 0) continue;
      // 只渲染：本周目已历 / 跨周目解锁 / 本周目邻路（Detroit 档）；隐藏纯 locked 避免四列问号墙。
      const visibleScenes = scenes.filter(scene => {
        const state = nodeState(scene.id, runSet, everSet);
        if (state !== 'locked') return true;
        return isDetroitAdjacent(scene.id, runSet, predecessorMap);
      });
      // 纯未来幕（无任何痕迹）整列省略；动态列数贴合进度。
      if (visibleScenes.length === 0) continue;

      const section = document.createElement('section');
      section.className = 'codex-act';
      section.dataset.act = String(actIndex(act));
      const heading = document.createElement('h2');
      heading.className = 'codex-act-title';
      heading.textContent = actLabel(act);
      section.appendChild(heading);

      const list = document.createElement('ul');
      list.className = 'codex-nodes';
      for (const scene of visibleScenes) {
        list.appendChild(renderNode(scene, runSet, everSet, predecessorMap, act));
      }
      section.appendChild(list);
      graph.appendChild(section);
      actSections.push({ section, list, scenes: visibleScenes });
    }
    // 动态列数：有几幕有痕迹就几列，避免 1/4 进度时四列全空。
    const colCount = Math.max(1, actSections.length);
    graph.style.gridTemplateColumns = `repeat(${colCount}, minmax(0, 1fr))`;

    const paintEdges = (): void => {
      for (const { section, list, scenes } of actSections) {
        paintActEdges(section, list, scenes, runSet, everSet);
      }
    };

    return { graph, paintEdges };
  }

  /**
   * 同幕内按 choice.goto 画边：
   *  - seen→seen 金色实线
   *  - 涉及 unlocked 邻接虚线
   *  - locked 不连
   * 量 getBoundingClientRect 相对 section，绝对定位 SVG。
   */
  function paintActEdges(
    section: HTMLElement,
    list: HTMLElement,
    scenes: readonly NarrationScene[],
    runSet: Set<string>,
    everSet: Set<string>
  ): void {
    section.querySelector(':scope > svg.codex-edges')?.remove();

    const sectionRect = section.getBoundingClientRect();
    if (sectionRect.width <= 0 || sectionRect.height <= 0) return;

    const nodeEls = new Map<string, HTMLElement>();
    for (const el of list.querySelectorAll<HTMLElement>('.codex-node[data-scene-id]')) {
      const id = el.dataset.sceneId;
      if (id) nodeEls.set(id, el);
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'codex-edges');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', String(Math.round(sectionRect.width)));
    svg.setAttribute('height', String(Math.round(sectionRect.height)));
    svg.setAttribute('viewBox', `0 0 ${Math.round(sectionRect.width)} ${Math.round(sectionRect.height)}`);

    let edgeCount = 0;
    for (const scene of scenes) {
      const fromState = nodeState(scene.id, runSet, everSet);
      if (fromState === 'locked') continue;
      const fromEl = nodeEls.get(scene.id);
      if (!fromEl) continue;

      for (const choice of scene.choices ?? []) {
        if (!choice.goto) continue;
        const target = NARRATION_SCENES_BY_ID.get(choice.goto);
        // 仅同幕边；跨幕由章节轨表达，不在 act 内连。
        if (!target || target.act !== scene.act) continue;
        const toState = nodeState(choice.goto, runSet, everSet);
        if (toState === 'locked') continue;
        const toEl = nodeEls.get(choice.goto);
        if (!toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        // 锚在节点左侧 timeline 圆点附近，避免穿过正文。
        const x1 = fromRect.left - sectionRect.left + 6;
        const y1 = fromRect.top - sectionRect.top + fromRect.height / 2;
        const x2 = toRect.left - sectionRect.left + 6;
        const y2 = toRect.top - sectionRect.top + toRect.height / 2;

        const solid = fromState === 'seen' && toState === 'seen';
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1.toFixed(1));
        line.setAttribute('y1', y1.toFixed(1));
        line.setAttribute('x2', x2.toFixed(1));
        line.setAttribute('y2', y2.toFixed(1));
        line.setAttribute('class', solid ? 'codex-edge-seen' : 'codex-edge-unlocked');
        svg.appendChild(line);
        edgeCount += 1;
      }
    }

    if (edgeCount === 0) return;
    // 插在标题后、节点列表前，z-index 由 CSS 压在节点下。
    section.insertBefore(svg, list);
  }

  function renderNode(
    scene: NarrationScene,
    runSet: Set<string>,
    everSet: Set<string>,
    predecessorMap: ReadonlyMap<string, readonly string[]>,
    act: NarrationAct
  ): HTMLElement {
    const li = document.createElement('li');
    const type = classifyScene(scene);
    const state = nodeState(scene.id, runSet, everSet);
    const meta = SCENE_META[scene.id];
    li.className = 'codex-node';
    li.dataset.type = type;
    li.dataset.state = state;
    li.dataset.sceneId = scene.id;
    li.tabIndex = 0;
    li.dataset.flowFocusable = 'true';

    const glyph = document.createElement('span');
    glyph.className = 'codex-node-glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = typeGlyph(type);
    li.appendChild(glyph);

    const body = document.createElement('span');
    body.className = 'codex-node-body';

    if (state === 'seen') {
      // 全揭示：名 + CG 缩略 + 一句话旁白。
      li.dataset.tier = 'full';
      const title = document.createElement('span');
      title.className = 'codex-node-title';
      title.textContent = meta?.title ?? scene.id;
      body.appendChild(title);
      const cgAsset = sceneCgAssetId(scene);
      if (cgAsset) {
        const url = options.assetUrlForId(cgAsset);
        if (url) {
          const img = document.createElement('img');
          img.className = 'codex-node-cg';
          img.src = url;
          img.alt = '';
          img.setAttribute('aria-hidden', 'true');
          img.decoding = 'async';
          img.loading = 'lazy';
          body.appendChild(img);
        }
      }
      const line = document.createElement('span');
      line.className = 'codex-node-line';
      line.textContent = truncate(sceneFirstLine(scene), MAX_LINE_CHARS);
      body.appendChild(line);
    } else if (state === 'unlocked') {
      // VN 档：? + ≤14 字线索（跨周目已历、本周目未走）。
      li.dataset.tier = 'clue';
      const title = document.createElement('span');
      title.className = 'codex-node-title';
      title.textContent = '?';
      body.appendChild(title);
      const clue = document.createElement('span');
      clue.className = 'codex-node-clue';
      clue.textContent = truncate(meta?.clue ?? '', MAX_CLUE_CHARS);
      body.appendChild(clue);
    } else {
      // locked：Detroit 档（本周目邻路，??? 无文案）/ 纯问号（从未触及）。
      const detroit = isDetroitAdjacent(scene.id, runSet, predecessorMap);
      li.dataset.tier = detroit ? 'detroit' : 'unknown';
      const title = document.createElement('span');
      title.className = 'codex-node-title';
      title.textContent = detroit ? '???' : '?';
      body.appendChild(title);
    }

    li.appendChild(body);

    const stateText = state === 'seen' ? t('narration.codex.stateSeen') : state === 'unlocked' ? t('narration.codex.stateUnlocked') : t('narration.codex.stateLocked');
    const nameOrClue = state === 'seen' ? (meta?.title ?? scene.id) : state === 'unlocked' ? truncate(meta?.clue ?? '', MAX_CLUE_CHARS) : (li.dataset.tier === 'detroit' ? '???' : '?');
    li.setAttribute('aria-label', `第${actIndex(act) + 1}幕 节点：${stateText}·${typeLabel(type)}·${nameOrClue}`);
    return li;
  }

  // —— 侧栏结局图鉴墙 ——
  function renderWall(seenEndings: Set<string>): HTMLElement {
    const aside = document.createElement('aside');
    aside.className = 'codex-wall';
    aside.dataset.codexRegion = 'wall';
    aside.setAttribute('role', 'group');
    aside.setAttribute('aria-label', t('narration.codex.regionWall'));

    const heading = document.createElement('h2');
    heading.className = 'codex-wall-title';
    heading.textContent = t('narration.codex.endingWall', { x: seenEndings.size });
    aside.appendChild(heading);

    const list = document.createElement('ul');
    list.className = 'codex-endings';
    for (const ending of ENDING_IDS) {
      list.appendChild(renderEndingCard(ending, seenEndings));
    }
    aside.appendChild(list);
    return aside;
  }

  function renderEndingCard(ending: EndingId, seenEndings: Set<string>): HTMLElement {
    const li = document.createElement('li');
    li.className = 'codex-ending';
    li.dataset.ending = ending;
    const topic = endingTopic(ending);
    li.dataset.topic = topic;
    const seen = seenEndings.has(ending);
    li.dataset.state = seen ? 'seen' : 'locked';
    li.tabIndex = 0;
    li.dataset.flowFocusable = 'true';

    if (seen) {
      const url = options.assetUrlForId(endingCgAssetId(ending));
      if (url) {
        const img = document.createElement('img');
        img.className = 'codex-ending-cg';
        img.src = url;
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.decoding = 'async';
        img.loading = 'lazy';
        li.appendChild(img);
      }
      const name = document.createElement('span');
      name.className = 'codex-ending-name';
      name.textContent = t(`narration.ending.${ending}.name`);
      li.appendChild(name);
      const tag = document.createElement('span');
      tag.className = 'codex-ending-topic';
      tag.textContent = topicLabel(topic);
      li.appendChild(tag);
      li.setAttribute('aria-label', `${t(`narration.ending.${ending}.name`)}：${topicLabel(topic)}·已见证`);
    } else {
      const q = document.createElement('span');
      q.className = 'codex-ending-q';
      q.setAttribute('aria-hidden', 'true');
      q.textContent = '?';
      li.appendChild(q);
      const clue = document.createElement('span');
      clue.className = 'codex-ending-clue';
      clue.textContent = truncate(t(`narration.ending.${ending}.clue`), MAX_CLUE_CHARS);
      li.appendChild(clue);
      li.setAttribute('aria-label', `未见证结局：${truncate(t(`narration.ending.${ending}.clue`), MAX_CLUE_CHARS)}`);    }
    return li;
  }

  return { open, destroy };
}
