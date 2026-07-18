/**
 * Tone.js 程序化自适应 BGM 驱动（Pillar：仿星露谷四季 + 分区/分时 + calm/tense 张力）。
 *
 * 设计：
 * - 乐句来源：纯函数 {@link generatePhrase}（马尔可夫旋律 + 生成式和声文法，四季调色板）。
 * - 回放：Tone.js Transport + 分声部 Synth（lead/pad/bass/pluck），按 phrase 的 note 事件
 *   以 Tone.Part 循环；季节决定音色与 BPM，zone/tension 决定密度与张力。
 * - 自适应：context（season×zone×tension）变化时 duck 重建并淡入新乐句，平滑过渡。
 * - 懒加载：仅在首次激活时动态 import('tone')，避免进入首屏 bundle / Node 单测。
 * - 安全：无 window/AudioContext（Node、测试、无头）时全部 no-op，绝不抛错。
 *
 * 类型：用 typeof import('tone') 的实例类型（InstanceType）做编译期校验，这是纯类型引用、
 * 会被 TS 擦除，不产生运行时打包；运行时值仍走动态 import。
 *
 * 注意：此层属 app/io，不进 src/sim；实时回放使用 Tone 时钟（非确定性），但乐句本身
 * 经 generatePhrase 由项目 Rng 保证可复现——离线烘焙（render-bgm 工具）走 Tone.Offline。
 */
import {
  generatePhrase,
  phraseDurationSeconds,
  beatsToSeconds,
  SIGNATURE_THEME_SEED,
  type MusicPhrase,
  type MusicSeason,
  type MusicZone,
  type MusicTension
} from '@io/generativeMusic';

type ToneModule = typeof import('tone');
type TGain = InstanceType<ToneModule['Gain']>;
type TReverb = InstanceType<ToneModule['Reverb']>;
type TSynth = InstanceType<ToneModule['Synth']>;
type TPoly = InstanceType<ToneModule['PolySynth']>;
type TPart = InstanceType<ToneModule['Part']>;
type TTransport = ReturnType<ToneModule['getTransport']>;

export interface MusicContext {
  readonly season: MusicSeason;
  readonly zone: MusicZone;
  readonly tension: MusicTension;
  /** false=停止（游戏结束/胜利收尾）。 */
  readonly active: boolean;
}

/** 分声部音色映射：季节决定 lead 振荡器类型，强化四季辨识度。 */
const SEASON_LEAD_OSC: Readonly<Record<MusicSeason, OscillatorType>> = {
  spring: 'triangle',
  summer: 'square',
  autumn: 'triangle',
  winter: 'sine'
};

interface VoiceSlot {
  synth: TSynth | TPoly;
  part: TPart | null;
}
interface VoiceSet {
  lead: VoiceSlot;
  pad: VoiceSlot;
  bass: VoiceSlot;
  pluck: VoiceSlot;
}

export class GenerativeBgm {
  private tone: ToneModule | null = null;
  private loading: Promise<ToneModule | null> | null = null;
  private masterGain: TGain | null = null;
  private reverb: TReverb | null = null;
  private voices: VoiceSet | null = null;
  private current: MusicContext | null = null;
  private masterVolume = 35;
  /** 是否真正在发声（仅 Tone 已加载并启动后为真；Node/无头环境恒为 false）。 */
  private playing = false;
  /** 固定种子的签名主题曲；可独立播放（标题屏/结局）。 */
  private signaturePlaying = false;

  isActive(): boolean {
    return this.playing;
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

  setMasterVolume(value: number): void {
    this.masterVolume = value;
    if (this.masterGain) this.masterGain.gain.value = (value / 100) * 0.5;
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

  /** 主入口：按 context 自适应切换（或停止）BGM。 */
  async setContext(ctx: MusicContext): Promise<void> {
    const prev = this.current;
    this.current = ctx;
    if (this.signaturePlaying) return; // 签名曲优先，忽略普通 context
    if (!ctx.active) {
      this.stopInternals();
      return;
    }
    const tone = await this.load();
    if (!tone) return;
    if (!this.masterGain) this.buildGraph(tone);
    const key = `${ctx.season}:${ctx.zone}:${ctx.tension}`;
    const prevKey = prev ? `${prev.season}:${prev.zone}:${prev.tension}` : null;
    if (!this.voices || key !== prevKey) {
      this.applyPhrase(tone, generatePhrase({ seed: ctx.season, season: ctx.season, zone: ctx.zone, tension: ctx.tension }));
    }
    tone.getTransport().start();
    this.playing = true;
  }

  /** 播放签名主题曲（固定种子，同路生成、零委约）。active=false 停止。 */
  async playSignature(active: boolean): Promise<void> {
    this.signaturePlaying = active;
    const tone = await this.load();
    if (!tone) return;
    if (!active) {
      this.stopInternals();
      return;
    }
    if (!this.masterGain) this.buildGraph(tone);
    this.applyPhrase(tone, generatePhrase({ seed: SIGNATURE_THEME_SEED, season: 'spring', zone: 'farm', tension: 'calm', bars: 8 }));
    tone.getTransport().start();
    this.playing = true;
  }

  private buildGraph(tone: ToneModule): void {
    const master = new tone.Gain((this.masterVolume / 100) * 0.5);
    master.toDestination();
    this.masterGain = master;
    const reverb = new tone.Reverb({ decay: 3.2, wet: 0.28 });
    reverb.connect(master);
    this.reverb = reverb;
  }

  private transport(tone: ToneModule): TTransport {
    return tone.getTransport();
  }

  /** duck 重建：淡出旧乐句 → 重建分声部 Part → 淡入。 */
  private applyPhrase(tone: ToneModule, phrase: MusicPhrase): void {
    if (!this.masterGain || !this.reverb) return;
    const transport = this.transport(tone);
    transport.bpm.value = phrase.bpm;
    const now = tone.now();
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.25);

    window.setTimeout(() => {
      this.disposeVoices();
      const transport = this.transport(tone);
      try {
        // 重建前重置 transport 时间线：循环 Part 用 part.start(0) 排程，若 transport
        // 已连续运行很久（本作每帧 setMusicContext、transport 从不重置），新 Part 会
        // 从过去时刻追赶，一次性触发整段历史的循环事件，撑爆 lead/pad 多音色，
        // 造成控制台刷爆「Max polyphony exceeded. Note dropped」并使 BGM 掉音。
        // stop()+start() 把 position 归零，让新 Part 从当下起播，杜绝追赶爆发。
        transport.stop();
        transport.start();
      } catch {
        /* 无 Tone 或 transport 不可控时忽略，退回原行为 */
      }
      this.voices = this.buildVoices(tone, phrase);
      const target = (this.masterVolume / 100) * 0.5;
      const t2 = tone.now();
      this.masterGain!.gain.setValueAtTime(0.0001, t2);
      this.masterGain!.gain.linearRampToValueAtTime(Math.max(0.0001, target), t2 + 0.8);
    }, 260);
  }

  private buildVoices(tone: ToneModule, phrase: MusicPhrase): VoiceSet {
    const leadOsc = SEASON_LEAD_OSC[phrase.season];
    const master = this.masterGain!;
    const reverb = this.reverb!;

    const leadSynth = new tone.PolySynth(tone.Synth, {
      oscillator: { type: leadOsc },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.4 }
    });
    leadSynth.maxPolyphony = 6;
    leadSynth.connect(master);

    const padSynth = new tone.PolySynth(tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.6 }
    });
    padSynth.maxPolyphony = 8;
    padSynth.connect(reverb);

    const bassSynth = new tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3 }
    });
    bassSynth.connect(master);

    const pluckSynth = new tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.2 }
    });
    pluckSynth.connect(reverb);

    return {
      lead: { synth: leadSynth, part: this.buildPart(tone, leadSynth, phrase, 'lead') },
      pad: { synth: padSynth, part: this.buildPart(tone, padSynth, phrase, 'pad') },
      bass: { synth: bassSynth, part: this.buildPart(tone, bassSynth, phrase, 'bass') },
      pluck: { synth: pluckSynth, part: this.buildPart(tone, pluckSynth, phrase, 'pluck') }
    };
  }

  private buildPart(tone: ToneModule, synth: TSynth | TPoly, phrase: MusicPhrase, voice: 'lead' | 'pad' | 'bass' | 'pluck'): TPart | null {
    const events = phrase.notes
      .filter(n => n.voice === voice)
      .map(n => ({
        time: beatsToSeconds(phrase.bpm, n.startBeat),
        dur: beatsToSeconds(phrase.bpm, n.durationBeats),
        freq: tone.Frequency(n.midi, 'midi').toFrequency(),
        vel: n.velocity
      }));
    if (events.length === 0) return null;
    const part = new tone.Part((time: number, ev: { dur: number; freq: number; vel: number }) => {
      synth.triggerAttackRelease(ev.freq, Math.max(0.05, ev.dur * 0.9), time, ev.vel);
    }, events) as unknown as TPart;
    part.loop = true;
    part.loopEnd = Math.max(0.5, phraseDurationSeconds(phrase) + 0.2);
    part.start(0);
    return part;
  }

  private disposeVoices(): void {
    if (!this.voices) return;
    for (const v of Object.values(this.voices)) {
      v.part?.dispose();
      v.synth.dispose();
    }
    this.voices = null;
  }

  private stopInternals(): void {
    const tone = this.tone;
    this.disposeVoices();
    if (tone) this.transport(tone).pause();
    this.playing = false;
  }

  /** 完全释放（页面卸载/测试清理）。 */
  dispose(): void {
    this.stopInternals();
    this.reverb?.dispose();
    this.masterGain?.dispose();
    this.reverb = null;
    this.masterGain = null;
    this.current = null;
    this.playing = false;
    this.signaturePlaying = false;
  }
}
