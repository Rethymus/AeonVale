/**
 * 程序化音频引擎（docs/10 §10 / docs/13）。
 * Web Audio API 合成 SFX（雷/炸炉/收获/突破/UI）+ BGM 双模式（calm 慢/tense 急）。
 * 慢→急切换服务 Pillar 3 张力曲线。无音频文件依赖（C7 程序化优先）。
 *
 * 安全：无 AudioContext（Node/测试环境）时全部 no-op，不抛错。
 */
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
  | 'ending';
export type BgmMode = 'calm' | 'tense' | 'off';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private bgmMode: BgmMode = 'off';
  private bgmOsc: OscillatorNode[] = [];
  private bgmGain: GainNode | null = null;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;

  /** 首次用户手势后调用（浏览器策略）。无 Web Audio 则 no-op。 */
  init(): void {
    if (this.ctx) return;
    const Ctor = typeof AudioContext !== 'undefined' ? AudioContext : undefined;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.35;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(this.ctx);
  }

  resume(): void {
    this.ctx?.resume().catch(() => {});
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
    switch (id) {
      case 'till':
        this.tone(120, 0.12, 0.3, now, 'sine');
        break;
      case 'sow':
        this.tone(440, 0.1, 0.2, now, 'triangle');
        break;
      case 'water':
        this.noiseBurst(0.15, 0.15, 1200, now);
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

  /** 切换 BGM 模式（calm 慢治愈 / tense 急紧张 / off）。 */
  setBgmMode(mode: BgmMode): void {
    if (mode === this.bgmMode) return;
    this.stopBgm();
    this.bgmMode = mode;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || mode === 'off') return;
    if (mode === 'calm') {
      // 慢 pad：低音 + 五度，轻音量
      const g = ctx.createGain();
      g.gain.value = 0.06;
      g.connect(master);
      for (const f of [110, 165]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g);
        o.start();
        this.bgmOsc.push(o);
      }
      this.bgmGain = g;
    } else {
      // tense：低频脉冲 + 周期雷鸣
      const g = ctx.createGain();
      g.gain.value = 0.08;
      g.connect(master);
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 55;
      o.connect(g);
      o.start();
      this.bgmOsc.push(o);
      this.bgmGain = g;
      this.pulseTimer = setInterval(() => this.playSfx('tribulation'), 1200);
    }
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
