/**
 * 灵韵叙录 surface 控制器（docs/22 §5 / docs/23 §0）。
 *
 * narration screen 激活时由 main.ts 实例化并挂载到 `[data-app-surface="narration"]` 内的
 * 挂载点（`#narration-vn`）。本控制器拥有一个 narration 层 {@link NarrationState}
 * （独立于 `src/sim/`），驱动 {@link createNarrationVN} 打字机，并按 Wave 1 的推进循环路由：
 *   开场：enterScene(initialState(), firstScene)
 *   推进：const r = nextState(state, scene, choiceId)
 *         若 r.nextSceneId 非空：enterScene(r.state, scenesById[r.nextSceneId]) → showScene
 *         若 r.ending 非空：进入结局展示（占位 CG + 名称 + 线索）
 *
 * 红线（硬守）：
 *  - 只读不写 `src/sim/`：narration 状态用 `firstPersonView.initialState()`，不读 sim 实例。
 *  - 不引第二随机源；运行时不调 AI 模型。
 *  - BGM 单点原则：mount 时设 narration 语境，unmount 时交还（main.ts 渲染帧循环在 surface
 *    非活跃时恢复世界 BGM；见 main.ts 音乐守卫）。
 */

import { t } from '@content/i18n';
import type { NarrationBlipSpeaker, SfxId } from '@io/audio';
import type { MusicSeason, MusicTension, MusicZone } from '@io/generativeMusic';
import {
  bucket,
  deriveHeartPulse,
  deriveLayerKeys,
  enterScene,
  initialState,
  judgeFailState,
  judgeEnding,
  markEnding,
  nextState
} from './firstPersonView';
import type { HeartPulse, HeartQuality } from './firstPersonView';
import { beginNewRun, recordEnding, recordSeenScene } from './narrationCodex';
import { NARRATION_SCENES, NARRATION_SCENES_BY_ID } from './narrationScenes';
import type { EndingId, NarrationScene, NarrationState } from './narrationTypes';
import { createNarrationVN, type NarrationVNController } from './narrationVN';

/** E7 改写标题屏的 flag（docs/22 §2.5）：showEnding(e7) 时写入，title surface 检测。 */
export const NARRATION_E7_FLAG_KEY = 'narration.e7Triggered';

/**
 * 道心脉象 → 内心内阁声色映射（dogfood ISSUE-006 / docs/23 §5 六色守色律）。
 * 复用既有六色 token 与 blip 音轨，**不引入第七色**：
 *  - bond（羁绊）→ 金·师尊暖声（master blip，钟磬泛音）
 *  - defiance（反逆）→ 朱砂·心魔逆声（heart-demon blip，低频锯齿）
 *  - defilement（道心污染/走火）→ 靛·直觉浊声（intuition blip）
 * 三重冗余（色 + 形 + 音）色盲安全；颜色仅冗余，正文恒为墨 on 纸。
 */
const HEART_PULSE_SPEAKER: Readonly<Record<HeartQuality, NarrationBlipSpeaker>> = {
  bond: 'master',
  defiance: 'heart-demon',
  defilement: 'intuition'
};

/**
 * 灵韵叙录 surface 所需的音频适配器（解耦自 AudioEngine 具体类型）。
 * 第一刀音频接入（docs/22 §12 + 音频调研 Path B）：
 * - playSfx：触发 narration SFX（雷/钟/低语/glitch/章节切换/UI）。
 * - playNarrationTrack/stopNarrationTrack：回放烘焙 narration 茎（Tone.Player 循环 + crossfade）。
 *   替代旧 setMusicContext（narration 不再走 generative BGM，改走专用茎）。
 * - setMusicContext：保留为兼容字段（main.ts 帧循环在世界 BGM 复用），narrationSurface 内部不再调用。
 */
export interface NarrationSurfaceAudio {
  playBlip(speaker: NarrationBlipSpeaker): void;
  playSfx(id: SfxId): void;
  /** 第二刀：可叠 bed（程序化）+ stem（真实录音）。 */
  playNarrationTrack(
    trackId: string,
    opts?: { fade?: number; bedId?: string; stemId?: string; bedGain?: number; stemGain?: number }
  ): void;
  stopNarrationTrack(opts?: { fade?: number }): void;
  setMusicContext(ctx: { season: MusicSeason; zone: MusicZone; tension: MusicTension; active: boolean }): void;
}

export interface NarrationSurfaceOptions {
  readonly root: HTMLElement;
  readonly reducedMotion: boolean;
  readonly audio: NarrationSurfaceAudio;
  /** manifest AssetId → 运行时 URL。缺失时结局 CG 退化为水墨氛围占位。 */
  readonly assetUrlForId: (assetId: string) => string | undefined;
  /** 玩家触发「返回标题」（dispatch return-title-from-narration）。 */
  readonly onReturnToTitle: () => void;
  /**
   * 自定义起始场景 id（默认 NARRATION_SCENES[0]）。Wave 3 真实四幕入场时可覆写。
   * 找不到时回退到 NARRATION_SCENES[0]。
   */
  readonly startSceneId?: string;
}

export interface NarrationSurfaceController {
  /** 挂载舞台 + 进入首场景 + 设 BGM。 */
  start(): void;
  /** 拆舞台 + 清 BGM 交还（交还后由 main.ts 帧循环恢复世界 BGM）。 */
  destroy(): void;
}

/** 结局 → manifest CG AssetId（docs/22 §7 八结局，均挂 cg.first-person.ending.<id>-v2 正图）。 */
function endingCgAssetId(ending: EndingId): string {
  return `cg.first-person.ending.${ending}-v2`;
}

/**
 * 道心氛围层 CG AssetId（第二批 -v2，docs/23 §5 z 序：bg → 道心氛围 → 对话框）。
 * V1 gap 填补：原 resolveSceneCg 只取 layerKeys.bg 单层，deriveLayerKeys/bucket 仅为
 * unit test 消费；本映射把纯函数输出接入运行时，按 defiance/bond 分桶 + 路由点规则选图。
 *
 * 映射规则（清晰可复盘）：
 *  1. defiance bucket 'high'（≥66）→ ambience.defiance-v2（朱砂逆天，违心累积）
 *  2. 否则 bond bucket 'high'（≥66）→ ambience.bond-v2（金光红尘，本心羁绊）
 *  3. 否则若 scene 在空灵根吞吐显著路由点 → ambience.void-root-v2（气青漩涡）
 *  4. 否则 undefined（仅 bg 层，无氛围叠层）
 *
 * 「显著路由点」= 空灵根吞吐灵气/劫的瞬间（非被动持续）：储物戒开光身世闪回、首次引劫
 * 入骨、神农洞府根脉顶门。这些场景在 defiance/bond 均未到 high 时，仍需「空灵根在场」的
 * 视觉暗示，故单独触发 void-root 氛围层。
 */
const VOID_ROOT_WAYPOINTS = new Set<string>([
  // 储物戒开光·身世闪回帧（空灵根首次被动显形，简体字残影）。
  'act1.ring.flash',
  // 阶段一·认劫：漏掉的劫没散，按主角意思重新路由到骨（空灵根首次主动显形）。
  'act2.temper.stage1',
  // 神农洞府·根脉顶门：灵田底下走了一百万年的根顶开洞府门 + 洞内四子场景。
  'act3.entry',
  'act3.cave.entrance',
  'act3.cave.lab',
  'act3.cave.faceless',
  'act3.cave.light'
]);

/** 道心氛围层 AssetId 派生（V1 gap 填补核心）。 */
function deriveAmbienceAssetId(scene: NarrationScene, narrationState: NarrationState): string | undefined {
  // 优先级 1：defiance high（≥66）→ 朱砂逆天氛围。
  if (bucket(narrationState.defiance) === 'high') return 'cg.first-person.ambience.defiance-v2';
  // 优先级 2：bond high（≥66）→ 金光红尘氛围。
  if (bucket(narrationState.bond) === 'high') return 'cg.first-person.ambience.bond-v2';
  // 优先级 3：空灵根吞吐路由点 → 气青漩涡氛围（与 bg 层叠，docs/23 §5 z 序）。
  if (VOID_ROOT_WAYPOINTS.has(scene.id)) return 'cg.first-person.ambience.void-root-v2';
  return undefined;
}

/** 由走火值 / 渡劫把握派生 BGM 张力（docs/22 §12）。 */
function deriveTension(state: NarrationState): MusicTension {
  // 走火高 or 渡劫失利 → tense；否则 calm。
  if (state.madness >= 50) return 'tense';
  if (state.tribGrip < 0) return 'tense';
  return 'calm';
}

/**
 * 场景 → narration 茎 AssetId 映射（docs/22 §12 + 音频调研第二刀）。
 * bed 茎：prologue/village/road/combat/tribulation/finale（v2 优先 Eno/Reich）。
 * stem：真实录音叠层（dizi/erhu），缺失时单 bed 回退。
 * 语义对齐 narrationScenes.ts 四幕结构；act 变化触发 ui-chapter SFX（showScene 内）。
 */
interface NarrationTrackPlan {
  readonly trackId: string;
  readonly bedId: string;
  readonly stemId?: string;
}

function sceneNarrationPlan(scene: NarrationScene): NarrationTrackPlan {
  if (scene.act === 'prologue') {
    // 第二刀：Eno 不可公约循环茎（prologue-v2）；guqin 下载失败时无 stem。
    return { trackId: 'bgm.narration.prologue-v2', bedId: 'bgm.narration.prologue-v2' };
  }
  if (scene.act === 1) {
    // act1.battle（含 sky/cellar/stare 三子）= 两修士斗法打斗 → combat；其余 = 山谷揭示 → village+dizi。
    if (scene.id === 'act1.battle' || scene.id.startsWith('act1.battle.')) {
      return { trackId: 'bgm.narration.combat', bedId: 'bgm.narration.combat' };
    }
    return {
      trackId: 'bgm.narration.village',
      bedId: 'bgm.narration.village',
      stemId: 'stem.village.dizi'
    };
  }
  if (scene.act === 2) {
    // 修炼/hub/采风/偶遇修士（山道） → road（修仙路沉思）
    if (
      scene.id === 'act2.train' ||
      scene.id === 'act2.train.lore-hub' ||
      scene.id.startsWith('act2.temper') ||
      scene.id === 'act2.alchemy' ||
      scene.id === 'act2.peek' ||
      scene.id === 'act2.farm-lore' ||
      scene.id === 'act2.relic-lore' ||
      scene.id === 'act2.annals-lore' ||
      scene.id.startsWith('act2.encounter.')
    ) {
      return { trackId: 'bgm.narration.road', bedId: 'bgm.narration.road' };
    }
    // 萧诛/走火致死 → combat（打斗/反噬紧张）
    if (scene.id === 'act2.xiao-death' || scene.id === 'act2.madness-death') {
      return { trackId: 'bgm.narration.combat', bedId: 'bgm.narration.combat' };
    }
    // 荒村/支线（village/side/famine-death） → village + 笛子 bed
    return {
      trackId: 'bgm.narration.village',
      bedId: 'bgm.narration.village',
      stemId: 'stem.village.dizi'
    };
  }
  // act 3：tribulation = Reich 相位威压茎（v2）；其余 = finale 苍凉 + 二泉映月 erhu
  if (scene.id.startsWith('act3.tribulation')) {
    return { trackId: 'bgm.narration.tribulation-v2', bedId: 'bgm.narration.tribulation-v2' };
  }
  return {
    trackId: 'bgm.narration.finale',
    bedId: 'bgm.narration.finale',
    stemId: 'stem.ending.erquan-yingyue'
  };
}

/** 结局 → narration 茎计划（飞升/牺牲 → 专用茎；寿终 → 江河水 erhu；其余 → null 停茎）。 */
function endingNarrationPlan(ending: EndingId): NarrationTrackPlan | null {
  if (ending === 'ascension') {
    return { trackId: 'bgm.narration.ending-ascension', bedId: 'bgm.narration.ending-ascension' };
  }
  if (ending === 'e6-sacrifice') {
    // sparse 系统音乐烘焙茎（第二刀）
    return { trackId: 'bgm.narration.ending-e6', bedId: 'bgm.narration.ending-e6' };
  }
  if (ending === 'lifespan-death') {
    // 寿终怅惘：程序化 sacrifice bed + 江河水 erhu stem
    return {
      trackId: 'bgm.narration.sacrifice',
      bedId: 'bgm.narration.sacrifice',
      stemId: 'stem.death.jianghe-shui'
    };
  }
  // e7-usurp / e0-mushroom / poison-death / madness / tribulation-death：停茎（E7 走 glitch SFX）
  return null;
}

/** 心魔 speaker 在场 → 触发 whisper SFX（docs/22 §9 心魔差异化）。 */
function sceneHasHeartDemon(scene: NarrationScene): boolean {
  return scene.lines.some(l => l.speaker === 'heart-demon');
}

export function createNarrationSurface(options: NarrationSurfaceOptions): NarrationSurfaceController {
  const { root, audio, assetUrlForId, onReturnToTitle } = options;
  let destroyed = false;
  let vn: NarrationVNController | null = null;
  let state: NarrationState = initialState();
  let currentScene: NarrationScene | null = null;
  /**
   * 上一场景所属 act，用于检测章节切换（act 变化 → ui-chapter SFX）。
   * null = 尚未进入过任何场景（首场景不算"切换"）。
   */
  let previousAct: NarrationScene['act'] | null = null;
  /**
   * 道心脉象浮纹 DOM（dogfood ISSUE-006）：抉择跨越隐变量档位时浮现的叙事反馈层。
   * 挂在 #narration-vn（root）内、舞台之侧，pointer-events:none 不抢焦点；结局路径不显示。
   * heartPulseSr：sr-only + aria-live=polite，把同一短句交屏阅器播报（非视觉可达）。
   */
  let heartPulseEl: HTMLElement | null = null;
  let heartPulseSr: HTMLElement | null = null;
  let heartPulseTimer: ReturnType<typeof setTimeout> | null = null;

  function resolveStartScene(): NarrationScene {
    const requested = options.startSceneId;
    if (requested) {
      const found = NARRATION_SCENES_BY_ID.get(requested);
      if (found) return found;
    }
    const first = NARRATION_SCENES[0];
    if (!first) {
      // 理论不可达：narrationScenes（Wave 3 真实四幕）至少含序章开场 scene。防御性兜底。
      throw new Error('narrationScenes 为空：Wave 3 必须填充四幕场景。');
    }
    return first;
  }

  function showScene(scene: NarrationScene, nextState2: NarrationState, revisiting = false): void {
    currentScene = scene;
    state = nextState2;
    // 叙录界面防剧透分层存储（docs/23 §4）：本周目/跨周目物理分离，仅 localStorage 副作用。
    recordSeenScene(scene.id);
    // —— 第一刀音频接入（docs/22 §12 + 音频调研） ——
    // 章节切换：act 变化触发 ui-chapter SFX（首场景 previousAct=null 不触发）。
    if (previousAct !== null && previousAct !== scene.act) {
      audio.playSfx('ui-chapter');
    }
    previousAct = scene.act;
    // 场景茎：sceneNarrationPlan 映射 → bed(+stem) crossfade 1.6s（AudioEngine.playNarrationTrack 双轨）。
    const plan = sceneNarrationPlan(scene);
    audio.playNarrationTrack(plan.trackId, {
      fade: 1.6,
      bedId: plan.bedId,
      ...(plan.stemId ? { stemId: plan.stemId } : {})
    });
    // 关键节点 SFX（与茎叠播，docs/22 §6/§7）：
    // - 进渡劫 → narration-thunder；破关/答天道 → narration-bell；心魔在场 → narration-whisper。
    if (scene.id === 'act3.tribulation') audio.playSfx('narration-thunder');
    if (scene.id === 'act3.ascend' || scene.id === 'act3.e6') audio.playSfx('narration-bell');
    if (sceneHasHeartDemon(scene)) audio.playSfx('narration-whisper');
    vn?.setCg(resolveSceneCg(scene, nextState2));
    vn?.showScene(scene, nextState2, {
      onChoose: handleChoose,
      onSceneComplete: handleSceneComplete,
      onExit: handleExit
    }, {
      startAtChoices: revisiting && scene.revisitMode === 'choices-only'
    });
  }

  /**
   * 场景多层 CG 解析（V1 gap 填补）：由 deriveLayerKeys 取 bg/npc/tribulation 键，
   * 按 defiance/bond 分桶 + 路由点规则派生 ambience 层（docs/23 §5 z 序）。
   *
   * 返回 URL 形状：{ bg?, ambience? }；ambience 缺失时只渲染 bg 层（与 V1 行为兼容）。
   * 资产缺失时对应层 undefined（narrationVN 的 onCgError 兜底隐藏图层）。
   */
  function resolveSceneCg(scene: NarrationScene, narrationState: NarrationState): { readonly bg?: string; readonly ambience?: string } {
    const layers = deriveLayerKeys(narrationState, scene);
    const bg = layers.bg !== undefined ? assetUrlForId(layers.bg) : undefined;
    const ambienceAssetId = deriveAmbienceAssetId(scene, narrationState);
    const ambience = ambienceAssetId !== undefined ? assetUrlForId(ambienceAssetId) : undefined;
    return { ...(bg !== undefined ? { bg } : {}), ...(ambience !== undefined ? { ambience } : {}) };
  }

  /**
   * 挂载道心脉象浮纹 DOM（dogfood ISSUE-006）。在 createNarrationVN 之后调用——VN 构造会清空
   * root 并追加舞台，故本元素作为舞台的后续兄弟节点挂入，z 序高于对话框。
   */
  function mountHeartPulse(): void {
    heartPulseEl = document.createElement('div');
    heartPulseEl.className = 'narration-heart-pulse';
    heartPulseEl.setAttribute('aria-hidden', 'true');
    heartPulseEl.hidden = true;
    const glyph = document.createElement('span');
    glyph.className = 'narration-heart-pulse-glyph';
    const text = document.createElement('span');
    text.className = 'narration-heart-pulse-text';
    heartPulseEl.append(glyph, text);
    heartPulseSr = document.createElement('p');
    heartPulseSr.className = 'sr-only narration-heart-pulse-sr';
    heartPulseSr.setAttribute('aria-live', 'polite');
    heartPulseSr.setAttribute('aria-atomic', 'true');
    root.append(heartPulseEl, heartPulseSr);
  }

  /**
   * 渲染一次道心脉象（dogfood ISSUE-006）：按 quality/tier 设色 + 笔触字形 + 字体 + 短句，
   * 并按 quality 触发对应 blip（三重冗余之「音」）。短句取自 narration.heartPulse.* 词表，
   * ≤14 字、无专名/数字/因果连接词（docs/23 §4 红线）。reducedMotion 下不做位移动画、缩短停留。
   * 绝不写入或显示任何数值——pulse 由纯函数 deriveHeartPulse 离散化派生，玩家只感不数。
   */
  function renderHeartPulse(pulse: HeartPulse): void {
    if (destroyed || !heartPulseEl || !heartPulseSr) return;
    const copy = t(`narration.heartPulse.${pulse.quality}.${pulse.tier}`);
    heartPulseEl.dataset.quality = pulse.quality;
    heartPulseEl.dataset.tier = pulse.tier;
    const text = heartPulseEl.querySelector<HTMLElement>('.narration-heart-pulse-text');
    if (text) text.textContent = copy;
    // 同一短句交屏阅器（aria-live=polite）——非视觉玩家也收到反馈。
    heartPulseSr.textContent = copy;
    try {
      audio.playBlip(HEART_PULSE_SPEAKER[pulse.quality]);
    } catch {
      /* 音频未就绪 / 隐私：静默降级（脉象仍以色+形+字呈现，三重冗余不全失） */
    }
    heartPulseEl.hidden = false;
    // 重启 bloom 动画：先撤 is-on、强制 reflow、再加回（CSS transition 可靠重放）。
    heartPulseEl.classList.remove('is-on');
    void heartPulseEl.offsetWidth;
    heartPulseEl.classList.add('is-on');
    if (heartPulseTimer) clearTimeout(heartPulseTimer);
    const dwell = options.reducedMotion ? 2200 : 2500;
    heartPulseTimer = setTimeout(() => {
      if (heartPulseEl) heartPulseEl.classList.remove('is-on');
      heartPulseTimer = null;
    }, dwell);
  }

  function handleChoose(choiceId: string): void {
    if (destroyed || !vn || !currentScene) return;
    const stateBefore = state;
    const result = nextState(state, currentScene, choiceId);
    state = result.state;
    // 道心脉象（ISSUE-006）：抉择致隐变量跨越离散档位时浮现叙事反馈，仅非结局路径（不与终局卡争屏）。
    // delta 只来自 choice.effects（已声明副作用，docs/23 §0），无隐式变量改动。
    if (!result.ending) {
      const pulse = deriveHeartPulse(stateBefore, result.state);
      if (pulse) renderHeartPulse(pulse);
    }
    if (result.ending) {
      showEnding(result.ending);
      return;
    }
    if (result.nextSceneId) {
      const next = NARRATION_SCENES_BY_ID.get(result.nextSceneId);
      if (next) {
        const revisiting = state.seenScenes.has(next.id);
        const entered = enterScene(state, next);
        // 失败态优先（docs/22 §7）：onEnter effects 也可能致死（如 act3.tribulation
        // set cult 7 + madness/lifespan 代价，若玩家已濒死则不进 choices 而是直接收束）。
        // 注：此处只判失败态子集；e6/e7/ascension 仍由 act3.tribulation 的 scene.ends 显式触发。
        const enteredFail = judgeFailState(entered);
        if (enteredFail) {
          state = entered;
          showEnding(enteredFail);
          return;
        }
        showScene(next, entered, revisiting);
        return;
      }
      // 下一场景 id 在表中找不到：内容数据 bug，兜底退出（Wave 4 CI 会拒此情形）。
      handleExit();
      return;
    }
    // 叶节点（无 goto/ends 且 judgeEnding 无果）：尝试 judgeEnding 兜底，否则退出。
    // 注：nextState 内部已做失败态判定，此处理论不可达；保留防御兜底防 firstPersonView 改写。
    const judged = judgeEnding(state);
    if (judged) {
      showEnding(judged);
      return;
    }
    handleExit();
  }

  function handleSceneComplete(scene: NarrationScene): void {
    if (destroyed || !vn) return;
    // 叶节点场景读完：优先 scene.ends，其次 judgeEnding 兜底，否则退出回标题（占位场景走此路径）。
    if (scene.ends) {
      showEnding(scene.ends);
      return;
    }
    const judged = judgeEnding(state);
    if (judged) {
      showEnding(judged);
      return;
    }
    // 占位 / 无后续：尊重退出回标题（Wave 3 真实四幕会在 choices.goto 闭环，不走此分支）。
    handleExit();
  }

  function handleExit(): void {
    if (destroyed) return;
    onReturnToTitle();
  }

  function showEnding(ending: EndingId): void {
    if (destroyed || !vn) return;
    // MEDIUM10：所有 ending 触发路径（choice.ends / scene.ends / judgeEnding）统一在此
    // 登记入内存 seenEndings/unlockedEndings，与 narrationCodex localStorage 一致。
    // nextState 内部已对 choice 路径 markEnding 过；scene.ends / handleSceneComplete 兜底
    // 路径（未走 nextState）在此补一次，幂等无副作用。
    state = markEnding(state, ending);
    // 叙录图鉴墙跨周目解锁 + E7 改写标题屏 flag（docs/22 §2.5）。
    recordEnding(ending);
    if (ending === 'e7-usurp') {
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(NARRATION_E7_FLAG_KEY, '1');
      } catch {
        /* 隐私模式/配额：静默降级（标题屏不加诅咒层） */
      }
      // E7 结局 glitch：BitCrusher→Chebyshev→Distortion→30Hz 方波硬切（docs/22 §7 POV 反转）。
      audio.playSfx('e7-glitch');
    }
    // 结局茎：飞升/牺牲/寿终 → 专用床(+stem)；其余死亡结局 → 停茎淡出；E7 走 glitch。
    const endingPlan = endingNarrationPlan(ending);
    if (endingPlan) {
      audio.playNarrationTrack(endingPlan.trackId, {
        fade: 1.6,
        bedId: endingPlan.bedId,
        ...(endingPlan.stemId ? { stemId: endingPlan.stemId } : {})
      });
    } else {
      audio.stopNarrationTrack({ fade: 1.0 });
    }
    const cgUrl = assetUrlForId(endingCgAssetId(ending));
    const name = t(`narration.ending.${ending}.name`);
    const clue = t(`narration.ending.${ending}.clue`);
    vn.showEnding({
      endingId: ending,
      cgUrl,
      name,
      clue,
      onDismiss: () => handleExit()
    });
  }

  function start(): void {
    if (destroyed) return;
    // 新一周目：清空叙录「本周目已历」表（跨周目结局/场景表不动，docs/23 §4）。
    beginNewRun();
    // 第一刀音频接入：narration 改走专用烘焙茎（showScene 内 playNarrationTrack），不再走
    // generative setMusicContext（docs/22 §12 单点原则：narration 活跃时世界 BGM 让位）。
    // previousAct 留 null → 首场景 showScene 不触发 ui-chapter（无"上一章"概念）。
    vn = createNarrationVN({
      root,
      reducedMotion: options.reducedMotion,
      audio: {
        playBlip: speaker => audio.playBlip(speaker),
        playSfx: id => audio.playSfx(id as SfxId)
      }
    });
    // 道心脉象浮纹挂载（ISSUE-006）：必须在 createNarrationVN 之后——前者会清空 root 再追加舞台。
    mountHeartPulse();
    const firstScene = resolveStartScene();
    const entered = enterScene(state, firstScene);
    // 失败态优先：开场 onEnter effects 若致死（理论不可达，序章无 onEnter）也立即收束。
    const enteredFail = judgeFailState(entered);
    if (enteredFail) {
      state = entered;
      showEnding(enteredFail);
      return;
    }
    showScene(firstScene, entered);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (heartPulseTimer) {
      clearTimeout(heartPulseTimer);
      heartPulseTimer = null;
    }
    heartPulseEl = null;
    heartPulseSr = null;
    vn?.destroy();
    vn = null;
    // narration 茎淡出释放（Tone.Player 独立 gain，1.0s 淡出 + dispose）。
    // main.ts 帧循环随后恢复世界 generative BGM（surface 非活跃时不再被 narration 守卫拦）。
    audio.stopNarrationTrack({ fade: 1.0 });
    root.textContent = '';
  }

  return { start, destroy };
}
