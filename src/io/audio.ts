/**
 * 程序化音频引擎。
 * Web Audio API 合成 SFX（雷/炸炉/收获/突破/UI）+ BGM 双模式（calm 慢/tense 急）。
 * 慢→急切换服务 Pillar 3 张力曲线。无音频文件依赖（C7 程序化优先）。
 *
 * 安全：无 AudioContext（Node/测试环境）时全部 no-op，不抛错。
 *
 * BGM 升级：calm/tense 现由 {@link GenerativeBgm}（Tone.js 程序化自适应，四季调色板 +
 * 马尔可夫/生成式文法）驱动；setMusicContext 提供季节/分区/张力富 context。
 */
import { GenerativeBgm } from './bgm';
import type { MusicSeason, MusicZone, MusicTension } from './generativeMusic';

export type SfxId =
  | 'till'
  | 'sow'
  | 'water'
  | 'harvest'
  | 'brew'
  | 'explosion'
  | 'tribulation'
  | 'breakthrough'
  | 'eat-pill'
  | 'ui'
  | 'ending'
  | 'warn'
  | 'hurt'
  | 'beast-spawn'
  | 'season'
  | 'coin'
  | 'spirit-stone'
  | 'cultivate'
  | 'array-place';
export type BgmMode = 'calm' | 'tense' | 'off';

/**
 * jsfxr/bfxr 风格的程序化 SFX 参数（DrPetr sfxr 算法的实时化精简版，公有领域）。
 * 由 {@link AudioEngine.renderSfxrBuffer} 离线渲染为 AudioBuffer，再以 BufferSource 回放，
 * 每次回放可叠加微量 playbackRate 抖动以"避单调"。SFX 走数据驱动，便于后续扩声。
 */
export interface SfxrParams {
  readonly wave: 'square' | 'sawtooth' | 'sine' | 'noise';
  /** 包络：attack/sustain/decay 占总时长的比例（0..1，三者之和≈1）。 */
  readonly attack: number;
  readonly sustain: number;
  readonly decay: number;
  /** sustain 起点的力度凹陷（0..1），模拟 sfxr 的 punch。 */
  readonly punch: number;
  /** 起始频率 Hz。 */
  readonly startFreq: number;
  /** 滑音目标频率 Hz（最小频率）。 */
  readonly minFreq: number;
  /** 频率指数滑移速率（>0 向下滑，<0 向上滑）；0 则不滑。 */
  readonly slide: number;
  readonly vibratoDepth: number;
  readonly vibratoSpeed: number;
  /** 方波占空比 0..1（仅 wave=square 生效）。 */
  readonly duty: number;
  /** 峰值增益 0..1。 */
  readonly gain: number;
  /** 总时长（秒）。 */
  readonly duration: number;
}

/** 数据驱动的 SFX 预设：新增音效只需在此登记参数，无需写合成代码。 */
export const SFX_PRESETS: Readonly<Partial<Record<SfxId, SfxrParams>>> = Object.freeze({
  // 灵石/出货入账：方波短促上行，明亮"叮"。
  coin: {
    wave: 'square',
    attack: 0.02,
    sustain: 0.5,
    decay: 0.48,
    punch: 0.2,
    startFreq: 880,
    minFreq: 1320,
    slide: -0.6,
    vibratoDepth: 0,
    vibratoSpeed: 0,
    duty: 0.5,
    gain: 0.18,
    duration: 0.18
  },
  // 获得灵石：正弦滑下，带轻微闪烁。
  'spirit-stone': {
    wave: 'sine',
    attack: 0.04,
    sustain: 0.5,
    decay: 0.46,
    punch: 0.1,
    startFreq: 660,
    minFreq: 440,
    slide: 0.8,
    vibratoDepth: 6,
    vibratoSpeed: 24,
    duty: 0.5,
    gain: 0.2,
    duration: 0.32
  },
  // 修行/打坐：低频正弦慢呼吸 + 颤音，安定。
  cultivate: {
    wave: 'sine',
    attack: 0.25,
    sustain: 0.55,
    decay: 0.2,
    punch: 0,
    startFreq: 220,
    minFreq: 196,
    slide: 0.4,
    vibratoDepth: 4,
    vibratoSpeed: 5,
    duty: 0.5,
    gain: 0.16,
    duration: 1.2
  },
  // 布阵：锯齿短促落位 + 噪点，仪式感。
  'array-place': {
    wave: 'sawtooth',
    attack: 0.02,
    sustain: 0.4,
    decay: 0.58,
    punch: 0.3,
    startFreq: 330,
    minFreq: 247,
    slide: 0.5,
    vibratoDepth: 0,
    vibratoSpeed: 0,
    duty: 0.5,
    gain: 0.18,
    duration: 0.26
  }
});

export const DEFAULT_MASTER_VOLUME = 35;

export function clampMasterVolume(value: number): number {
  if (Number.isNaN(value)) return DEFAULT_MASTER_VOLUME;
  return Math.round(Math.min(100, Math.max(0, value)));
}

/**
 * 离线渲染一段 jsfxr 风格 SFX 为单声道采样（无 AudioContext 依赖，纯函数）。
 * 确定性：相同 sampleRate + 相同 params ⇒ 相同 Float32Array（噪声走内嵌 LCG，非 Math.random）。
 * 用于实时回放（sfxrSynth）与离线烘焙（render-bgm 工具 / 单测）。
 */
export function renderSfxrSamples(sampleRate: number, params: SfxrParams): Float32Array {
  const duration = Math.max(0.01, params.duration);
  const len = Math.max(1, Math.floor(duration * sampleRate));
  const out = new Float32Array(len);
  const ratio = params.minFreq / params.startFreq;
  const aSamp = Math.max(0, Math.floor(params.attack * len));
  const sSamp = Math.max(0, Math.floor(params.sustain * len));
  const dStart = aSamp + sSamp;
  // 内嵌 LCG 噪声，保证渲染确定性。
  let nstate = (Math.abs(Math.floor(params.startFreq)) * 2654435761 + 12345) >>> 0;
  const noiseRand = (): number => {
    nstate = (Math.imul(nstate, 1664525) + 1013904223) >>> 0;
    return nstate / 4294967296;
  };
  let phase = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sampleRate;
    const lin = t / duration;
    const prog = params.slide === 0 ? lin : Math.pow(lin, 1 / (1 + Math.abs(params.slide)));
    const vib = params.vibratoDepth * Math.sin(2 * Math.PI * params.vibratoSpeed * t);
    const freq = params.startFreq * Math.pow(ratio, prog) + vib;
    phase = (phase + freq / sampleRate) % 1;
    let sample: number;
    switch (params.wave) {
      case 'square':
        sample = phase < params.duty ? 1 : -1;
        break;
      case 'sawtooth':
        sample = 2 * phase - 1;
        break;
      case 'sine':
        sample = Math.sin(2 * Math.PI * phase);
        break;
      case 'noise':
      default:
        sample = noiseRand() * 2 - 1;
        break;
    }
    let env: number;
    if (i < aSamp) env = aSamp > 0 ? i / aSamp : 1;
    else if (i < dStart) {
      const into = (i - aSamp) / Math.max(1, sSamp);
      env = 1 - params.punch * (1 - into) * (1 - into);
    } else env = len - dStart > 0 ? Math.max(0, 1 - (i - dStart) / (len - dStart)) : 0;
    out[i] = sample * env * params.gain;
  }
  return out;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private bgmMode: BgmMode = 'off';
  private bgmOsc: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;
  private masterVolume = DEFAULT_MASTER_VOLUME;
  /** Tone.js 自适应 BGM 驱动（懒加载，仅浏览器激活后载入）。 */
  private bgm = new GenerativeBgm();
  private musicSeason: MusicSeason = 'spring';
  private musicZone: MusicZone = 'farm';

  /** 首次用户手势后调用（浏览器策略）。无 Web Audio 则 no-op。 */
  init(): void {
    if (this.ctx) return;
    const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : undefined;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.masterVolume / 100;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(this.ctx);
  }

  resume(): void {
    this.ctx?.resume().catch(() => {});
    void this.bgm.resume();
  }

  setMasterVolume(value: number): void {
    this.masterVolume = clampMasterVolume(value);
    if (this.master) this.master.gain.value = this.masterVolume / 100;
    this.bgm.setMasterVolume(this.masterVolume);
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 1;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** 播放一个 SFX（合成）。 */
  playSfx(id: SfxId): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    // 数据驱动预设优先：新增 SFX 只登记 SFX_PRESETS 即可（bfxr/jsfxr 风格）。
    const preset = SFX_PRESETS[id];
    if (preset) {
      this.sfxrSynth(preset, now);
      return;
    }
    switch (id) {
      case 'till':
        // 翻地：先给低频落锄，再叠一层短促土屑噪声，避免在真实浏览器里过轻。
        this.tone(110, 0.1, 0.24, now, 'sine');
        this.tone(175, 0.08, 0.12, now + 0.02, 'triangle');
        this.noiseBurst(0.08, 0.08, 900, now + 0.01);
        break;
      case 'sow':
        // 播种：轻快种子落土感，用短双音加极轻土噪声保持存在感。
        this.tone(520, 0.06, 0.14, now, 'triangle');
        this.tone(780, 0.08, 0.1, now + 0.025, 'sine');
        this.noiseBurst(0.05, 0.035, 1100, now + 0.01);
        break;
      case 'water':
        // 浇水：以宽一点的水声噪层为主，再补两枚水滴音高，避免“触发了但像没响”。
        this.noiseBurst(0.18, 0.18, 1600, now);
        this.tone(980, 0.05, 0.07, now + 0.015, 'sine');
        this.tone(760, 0.08, 0.06, now + 0.06, 'sine');
        break;
      case 'harvest':
        this.tone(660, 0.1, 0.25, now, 'sine');
        this.tone(880, 0.12, 0.25, now + 0.08, 'sine');
        break;
      case 'brew':
        this.tone(330, 0.2, 0.2, now, 'triangle');
        this.tone(495, 0.25, 0.2, now + 0.1, 'triangle');
        break;
      case 'explosion':
        this.noiseBurst(0.5, 0.5, 400, now);
        this.tone(80, 0.4, 0.5, now, 'sawtooth');
        break;
      case 'tribulation':
        this.noiseBurst(0.3, 0.4, 800, now);
        this.tone(60, 0.3, 0.4, now, 'sawtooth');
        break;
      case 'breakthrough':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 0.3, now + i * 0.1, 'triangle'));
        break;
      case 'eat-pill':
        this.tone(550, 0.15, 0.2, now, 'sine');
        break;
      case 'ending':
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.4, 0.3, now + i * 0.15, 'sine'));
        break;
      case 'warn': {
        // 雷预警：highpass noise 渐强 + WaveShaper 软削波 + exp 频率扫频（FXive 雷模型）
        if (!this.noise) break;
        const ws = ctx.createBufferSource();
        ws.buffer = this.noise;
        ws.loop = true;
        const hpf = ctx.createBiquadFilter();
        hpf.type = 'highpass';
        hpf.frequency.setValueAtTime(2000, now);
        hpf.frequency.exponentialRampToValueAtTime(6000, now + 0.8);
        const shaper = ctx.createWaveShaper();
        const sc = new Float32Array(1024);
        for (let si = 0; si < 1024; si++) sc[si] = Math.tanh(((si / 1023) * 2 - 1) * 2);
        shaper.curve = sc;
        const wg = ctx.createGain();
        wg.gain.setValueAtTime(0.0001, now);
        wg.gain.linearRampToValueAtTime(0.3, now + 0.8);
        wg.gain.linearRampToValueAtTime(0.3, now + 0.95);
        wg.gain.linearRampToValueAtTime(0, now + 1.0);
        ws.connect(hpf);
        hpf.connect(shaper);
        shaper.connect(wg);
        wg.connect(master);
        ws.start(now);
        ws.stop(now + 1.0);
        break;
      }
      case 'hurt': {
        // 玩家受伤：sub thud(sine 65Hz + detune jitter) + 噪声闷层（业界冲击配方）
        const detune = (Math.random() - 0.5) * 60;
        const sub = ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 65;
        sub.detune.value = detune;
        const subEnv = ctx.createGain();
        subEnv.gain.setValueAtTime(0, now);
        subEnv.gain.linearRampToValueAtTime(0.5, now + 0.005);
        subEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        sub.connect(subEnv);
        subEnv.connect(master);
        sub.start(now);
        sub.stop(now + 0.3);
        this.noiseBurst(0.08, 0.3, 200, now);
        break;
      }
      case 'beast-spawn': {
        // 妖兽出现：3 detuned saws + bandpass Q=6 喉腔共振 + LFO 吼叫颤 + ConvolverNode 程序化 IR 洞穴感
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 180;
        bp.Q.value = 6;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 10;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 60;
        lfo.connect(lfoGain);
        lfoGain.connect(bp.frequency);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.22, now + 0.08);
        env.gain.linearRampToValueAtTime(0.22, now + 0.68);
        env.gain.linearRampToValueAtTime(0, now + 1.08);
        for (const det of [-15, 0, 15]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = 80;
          o.detune.value = det;
          o.connect(bp);
          o.start(now);
          o.stop(now + 1.1);
        }
        // 程序化 IR（零文件依赖，指数衰减噪声 → 洞穴感）
        const irLen = Math.floor(ctx.sampleRate * 0.3);
        const irBuf = ctx.createBuffer(1, irLen, ctx.sampleRate);
        const irData = irBuf.getChannelData(0);
        for (let ii = 0; ii < irLen; ii++) irData[ii] = (Math.random() * 2 - 1) * Math.exp((-3 * ii) / irLen);
        const conv = ctx.createConvolver();
        conv.buffer = irBuf;
        bp.connect(conv);
        conv.connect(env);
        env.connect(master);
        lfo.start(now);
        lfo.stop(now + 1.1);
        break;
      }
      case 'season': {
        // 季节变化：bandpass 风声 + LIO 阵风（hexshift wind 模型）
        if (!this.noise) break;
        const ss = ctx.createBufferSource();
        ss.buffer = this.noise;
        ss.loop = true;
        const bpf = ctx.createBiquadFilter();
        bpf.type = 'bandpass';
        bpf.Q.value = 2;
        bpf.frequency.setValueAtTime(500, now);
        bpf.frequency.linearRampToValueAtTime(300, now + 1.0);
        const slfo = ctx.createOscillator();
        slfo.frequency.value = 0.2;
        const slfoG = ctx.createGain();
        slfoG.gain.value = 150;
        slfo.connect(slfoG);
        slfoG.connect(bpf.frequency);
        const sg = ctx.createGain();
        sg.gain.setValueAtTime(0, now);
        sg.gain.linearRampToValueAtTime(0.1, now + 0.5);
        sg.gain.linearRampToValueAtTime(0.1, now + 1.2);
        sg.gain.linearRampToValueAtTime(0, now + 1.5);
        ss.connect(bpf);
        bpf.connect(sg);
        sg.connect(master);
        ss.start(now);
        ss.stop(now + 1.5);
        slfo.start(now);
        slfo.stop(now + 1.5);
        break;
      }
      case 'ui':
      default:
        this.tone(660, 0.05, 0.15, now, 'square');
        break;
    }
  }

  private tone(freq: number, dur: number, gain: number, start: number, type: OscillatorType): void {
    const ctx = this.ctx!;
    const master = this.master!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(master);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  private noiseBurst(dur: number, gain: number, filterFreq: number, start: number): void {
    const ctx = this.ctx!;
    const master = this.master!;
    if (!this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(start);
    src.stop(start + dur);
  }

  /** 回放一段 jsfxr 风格 SFX；每次叠加 ±2% playbackRate 抖动以"避单调"。 */
  private sfxrSynth(params: SfxrParams, start: number): void {
    const ctx = this.ctx!;
    const master = this.master!;
    const samples = renderSfxrSamples(ctx.sampleRate, params);
    const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buf.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.04;
    const g = ctx.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(master);
    src.start(start);
    src.stop(start + params.duration + 0.02);
  }

  /** 切换 BGM 模式（calm/tense/off）；现委托给 Tone.js 自适应驱动。 */
  setBgmMode(mode: BgmMode): void {
    if (mode === this.bgmMode) return;
    this.bgmMode = mode;
    this.stopBgm(); // 清理遗留 osc/pulse
    if (mode === 'off') {
      void this.bgm.setContext({ season: this.musicSeason, zone: this.musicZone, tension: 'calm', active: false });
      return;
    }
    void this.bgm.setContext({ season: this.musicSeason, zone: this.musicZone, tension: mode, active: true });
  }

  /** 富 context：季节/分区/张力 + active，驱动 Tone.js 四季自适应 BGM（仿星露谷）。 */
  setMusicContext(ctx: { season: MusicSeason; zone: MusicZone; tension: MusicTension; active: boolean }): void {
    this.musicSeason = ctx.season;
    this.musicZone = ctx.zone;
    this.bgmMode = ctx.active ? ctx.tension : 'off';
    void this.bgm.setContext(ctx);
  }

  /** 播放/停止签名主题曲（固定种子，同路生成、零委约、避 Suno/Udio）。 */
  playSignatureTheme(active: boolean): void {
    void this.bgm.playSignature(active);
  }

  private stopBgm(): void {
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    for (const o of this.bgmOsc) {
      try {
        o.stop();
      } catch {
        /* 已停止 */
      }
    }
    this.bgmOsc = [];
    this.bgmGain = null;
  }
}
