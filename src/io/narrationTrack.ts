/**
 * 灵韵叙录烘焙茎回放（Tone.Player 循环 + 独立 gain crossfade）。
 *
 * 设计：
 * - 茎来源：tools/render-bgm.ts 离线烘焙的 bgm.narration.{scene}.ogg（generatePhrase 同路生成）。
 * - 回放：Tone.Player(loop=true) 异步加载 ogg，连独立 Gain（不共用 GenerativeBgm.masterGain）。
 * - Crossfade：play(newTrackId) 时旧 Player 独立 gain 线性淡出 + dispose，新 Player 独立 gain 淡入。
 *   与 generative BGM 分轨：narrationSurface 单点切换（设了 narration 茎就停世界 BGM）。
 * - 懒加载：仅首次 play 时动态 import('tone')，避免进入首屏 bundle / Node 单测。
 * - 安全：无 window/AudioContext（Node、测试、无头）时全部 no-op，绝不抛错。
 *
 * 与 {@link GenerativeBgm} 同构（Tone 类型用 InstanceType<typeof import('tone')> 纯类型校验，
 * 运行时仍走动态 import；类型擦除后不进 bundle）。
 *
 * 注意：此层属 io，不进 src/sim；运行时 Tone 时钟非确定性，但茎本身由 generatePhrase 确定。
 */
type ToneModule = typeof import('tone');
type TGain = InstanceType<ToneModule['Gain']>;
type TPlayer = InstanceType<ToneModule['Player']>;

interface VoiceLayer {
  readonly kind: 'bed' | 'stem';
  readonly player: TPlayer;
  readonly gain: TGain;
}

interface CurrentVoice {
  /** 全部声部：单声部（旧 play）或 bed+stem 双声部（新 playLayered）。 */
  readonly layers: readonly VoiceLayer[];
  /** 停止/切歌时挂载的 dispose 定时器；新切前应清掉，避免提前 dispose。 */
  disposeTimer: ReturnType<typeof setTimeout> | null;
  /** 当前播放的 trackId，便于幂等（同 id 重放只调量不重建）。 */
  readonly trackId: string;
}

export interface PlayOptions {
  /** 淡入/淡出秒数；默认 1.6（narrationSurface 习惯值）。 */
  readonly fade?: number;
}

/** 双轨叠层参数：bed=程序化茎（generatePhrase/generateAmbientPhrase 烘焙），stem=真实录音。 */
export interface LayeredPlayOptions extends PlayOptions {
  /** 程序化 bed 茎 URL（缺失则只播 stem）。 */
  readonly bedUrl?: string;
  /** 真实录音 stem URL（缺失则只播 bed）。 */
  readonly stemUrl?: string;
  /** bed 相对增益 0..1，默认 0.6（让 stem 略突出）。 */
  readonly bedGain?: number;
  /** stem 相对增益 0..1，默认 1.0。 */
  readonly stemGain?: number;
}

export class NarrationTrackPlayer {
  private tone: ToneModule | null = null;
  private loading: Promise<ToneModule | null> | null = null;
  private current: CurrentVoice | null = null;
  private urlResolver: ((id: string) => string | undefined) | null = null;
  /** 目标 gain（受 setMasterVolume 控制，0..0.5 范围；0.5 与 GenerativeBgm 主gain 量级一致）。 */
  private targetGain = 0.5;
  /** bed 声部相对 stem 的衰减乘子（让真实录音 stem 略突出，bed 作衬底）。 */
  private bedGainScale = 0.6;

  /** 注入 AssetId → URL 解析器；缺失时 play 走 no-op。 */
  setUrlResolver(fn: (id: string) => string | undefined): void {
    this.urlResolver = fn;
  }

  /** 解析 AssetId → URL（供 AudioEngine 双轨叠层取 bed/stem）。 */
  resolveUrl(id: string): string | undefined {
    return this.urlResolver?.(id);
  }

  /** 主音量控制（AudioEngine.setMasterVolume 同步透传）。 */
  setMasterVolume(value: number): void {
    // 与 GenerativeBgm 一致：0..100 → 0..0.5，避免 narration 茎过响盖过 generative BGM。
    this.targetGain = Math.max(0, Math.min(0.5, (value / 100) * 0.5));
    if (this.current) {
      const tone = this.tone;
      if (tone) {
        const now = tone.now();
        for (const layer of this.current.layers) {
          const rel = layer.kind === 'bed' ? this.bedGainScale : 1;
          const target = Math.max(0.0001, this.targetGain * rel);
          layer.gain.gain.cancelScheduledValues(now);
          layer.gain.gain.setValueAtTime(target, now);
        }
      }
    }
  }

  /** 用户手势后解锁 Tone 音频上下文（浏览器策略）。无环境则 no-op。 */
  async resume(): Promise<void> {
    const tone = await this.load();
    if (!tone) return;
    try {
      await tone.start();
    } catch {
      /* 已启动或不可用 */
    }
  }

  /** 动态加载 Tone；无浏览器音频环境返回 null。 */
  private async load(): Promise<ToneModule | null> {
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
    if (this.tone) return this.tone;
    if (!this.loading) {
      this.loading = (async () => {
        try {
          const mod = await import('tone');
          this.tone = mod;
          return mod;
        } catch {
          this.loading = null;
          return null;
        }
      })();
    }
    return this.loading;
  }

  /**
   * 播放一段 narration 茎。同 trackId 重放视为幂等（不重建，避免 click）。
   * 切歌走 crossfade：旧 gain 线性淡出 + 延迟 dispose；新 gain 从 0 淡入到 targetGain。
   * 单声部：相当于 playLayered 仅 stem。
   */
  async play(trackId: string, opts?: PlayOptions): Promise<void> {
    const url = this.urlResolver?.(trackId);
    if (!url) return;
    await this.playLayered(trackId, { ...opts, stemUrl: url });
  }

  /**
   * 双轨叠层播放：bed（程序化茎，loop）+ stem（真实录音，loop），独立 gain crossfade。
   * 适合把同源生成 bed 与真实录音（guqin/erhu/dizi/taiko）叠成更厚的场景音。
   * 同 trackId 重放幂等；切歌走 crossfade（旧两层一起淡出+延迟 dispose，新两层淡入）。
   * bedUrl/stemUrl 至少给一个；缺失的声部跳过（不影响另一层）。
   */
  async playLayered(trackId: string, opts: LayeredPlayOptions): Promise<void> {
    const tone = await this.load();
    if (!tone) return;
    if (!opts.bedUrl && !opts.stemUrl) return;
    try {
      await tone.start();
    } catch {
      /* 已启动或不可用 */
    }
    // 幂等：同 id 已在播 → 不重建。
    if (this.current && this.current.trackId === trackId) return;

    const fade = Math.max(0.05, opts?.fade ?? 1.6);
    const now = tone.now();
    const bedScale = Math.max(0, Math.min(1, opts.bedGain ?? this.bedGainScale));
    const stemScale = Math.max(0, Math.min(1, opts.stemGain ?? 1));

    const layers: VoiceLayer[] = [];
    if (opts.bedUrl) {
      layers.push(this.buildLayer(tone, opts.bedUrl, 'bed', bedScale, this.targetGain, fade, now));
    }
    if (opts.stemUrl) {
      layers.push(this.buildLayer(tone, opts.stemUrl, 'stem', stemScale, this.targetGain, fade, now));
    }

    // 旧声部：线性淡出 + 延迟 dispose。
    this.scheduleDisposeCurrent(fade);

    this.current = { layers, disposeTimer: null, trackId };
  }

  /** 构造一个 Tone.Player loop + 独立 gain，淡入到 target × relScale。 */
  private buildLayer(
    tone: ToneModule,
    url: string,
    kind: 'bed' | 'stem',
    relScale: number,
    baseGain: number,
    fade: number,
    now: number
  ): VoiceLayer {
    const gain = new tone.Gain(0.0001);
    gain.toDestination();
    const player = new tone.Player({ url, loop: true, autostart: true });
    player.connect(gain);
    const target = Math.max(0.0001, baseGain * relScale);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(target, now + fade);
    return { kind, player, gain };
  }

  /** 停止并释放当前茎（淡出后 dispose）。 */
  async stop(opts?: PlayOptions): Promise<void> {
    const fade = Math.max(0.05, opts?.fade ?? 1.6);
    this.scheduleDisposeCurrent(fade);
    if (!this.tone) {
      // Tone 未加载（Node/无头）：直接清引用，无可释放资源。
      this.current = null;
    }
  }

  /** 完全释放（页面卸载 / 测试清理）。 */
  dispose(): void {
    if (this.current) {
      const voice = this.current;
      this.current = null;
      if (voice.disposeTimer) {
        clearTimeout(voice.disposeTimer);
        voice.disposeTimer = null;
      }
      for (const layer of voice.layers) {
        try {
          layer.player.stop();
        } catch {
          /* 已停止 */
        }
        layer.player.dispose();
        layer.gain.dispose();
      }
    }
  }

  private scheduleDisposeCurrent(fade: number): void {
    const voice = this.current;
    if (!voice) return;
    // 防重入：清掉旧定时器，重排新的。
    if (voice.disposeTimer) {
      clearTimeout(voice.disposeTimer);
      voice.disposeTimer = null;
    }
    const tone = this.tone;
    if (tone) {
      const now = tone.now();
      for (const layer of voice.layers) {
        layer.gain.gain.cancelScheduledValues(now);
        layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
        layer.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
      }
    }
    voice.disposeTimer = setTimeout(() => {
      for (const layer of voice.layers) {
        try {
          layer.player.stop();
        } catch {
          /* 已停止 */
        }
        layer.player.dispose();
        layer.gain.dispose();
      }
      voice.disposeTimer = null;
      if (this.current === voice) this.current = null;
    }, (fade + 0.15) * 1000);
  }
}
