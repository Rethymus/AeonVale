/**
 * 生成式环境音引擎（纯函数、确定性、零音频依赖）。
 *
 * 设计参考：Tero Parviainen「JavaScript Systems Music」与 Steve Reich / Brian Eno 的
 * 互质拍长 / 相位漂移 / tape-loop 思路——把这些理念搬到纯数据层，输出与
 * {@link generatePhrase} 同构的事件序列，由 tools/render-bgm.ts 离线烘焙或 Tone.js
 * 实时回放（实时回放使用 Tone 时钟非确定性，但**乐句本身**经项目 Rng 保证字节级可复现）。
 *
 * 四种模式（AmbientMode）：
 * - `eno`：3 条互质拍长（7/8/11 四分音符）Tone.Loop 风格——每条独立循环一段 3-4 音
 *   短动机，叠在 sine pad 之上；LCM=616 拍的「真·汇合点」太长无法烘焙，取收敛窗口
 *   期内的所有事件。
 * - `reich`：两段同序列（piano-phase），其一 `playbackRate:0.9999` 漂移，逐步错相/合相。
 * - `sparse`：8-16s/事件 + 6-10s 反馈延迟（Harold Budd / Stars of the Lid 风格）。
 * - `pendulum`：N 条不同长度 tape loop 触发同一样本（Reich Pendulum Music 风格）。
 *
 * 与 {@link generatePhrase} 平行签名：`generateAmbientPhrase({seed, mode, ...})` → AmbientPhrase。
 * 不触碰 AudioContext/DOM，可在 Node 单测与 Tone.Offline 离线渲染中直接验证。
 *
 * 红线：src/sim 不依赖此层；此处也不反向依赖 app/io，保持可被任意工具 / 单测复用。
 */
import { Rng, hashStr } from '@sim/world/rng';

export type AmbientMode = 'eno' | 'reich' | 'sparse' | 'pendulum';

/** 与 generatePhrase 的 MusicNote 平行：用秒作为时间单位（环境音无固定 BPM 节拍格）。 */
export interface AmbientEvent {
  /** 事件起点，相对乐句起点，秒。 */
  readonly time: number;
  /** 持续时间，秒。 */
  readonly duration: number;
  /** MIDI 音高 0..127（衬底音 pad 可能用低音；主奏动机走中高音区）。 */
  readonly midi: number;
  /** 力度 0..1。 */
  readonly velocity: number;
  /** 声部标签：driving 层用 voice 字段区分（如 'loop-a' / 'pad' / 'echo' / 'pendulum-1'）。 */
  readonly voice: string;
}

export interface AmbientPhrase {
  /** 数值化种子（同 seed + 同 mode + 同 opts ⇒ 字节级相同的事件序列）。 */
  readonly seed: number;
  readonly mode: AmbientMode;
  /** 名义 BPM（Eno/Reich/Pendulum 有；sparse 用 60 仅作元数据）。 */
  readonly bpm: number;
  /** 乐句总时长，秒。 */
  readonly durationSeconds: number;
  /** 根音 MIDI，元数据（驱动层据此刻画 pad/低音）。 */
  readonly rootMidi: number;
  /** 全部事件，按起点排序。 */
  readonly events: readonly AmbientEvent[];
}

export interface GenerateAmbientOptions {
  readonly seed: number | string;
  readonly mode: AmbientMode;
  /** 乐句总时长秒；默认各模式不同（Eno 90s / Reich 80s / Sparse 70s / Pendulum 60s）。 */
  readonly durationSeconds?: number;
  /** 名义 BPM；Eno/Reich/Pendulum 默认 60（足够慢以呈现「环境」感）。 */
  readonly bpm?: number;
  /** 根音 MIDI，默认 60（C4）。 */
  readonly rootMidi?: number;
  /** 互质拍长（Eno）或 tape loop 长度（Pendulum）等模式参数；缺省走模式默认。 */
  readonly params?: AmbientModeParams;
}

/** 可被 caller 覆盖的模式特定参数（缺省各模式自带，全部走 Rng 派生）。 */
export interface AmbientModeParams {
  /** Eno：3 条互质拍长（四分音符数）；默认 [7, 8, 11]。 */
  readonly enoLoopBeats?: readonly [number, number, number];
  /** Reich：漂移乘子（另一序列 playbackRate），默认 0.9999（提示性：实际渲染层用此渲染漂移）。 */
  readonly reichDriftRate?: number;
  /** Sparse：事件间隔区间（秒），默认 [8, 16]。 */
  readonly sparseIntervalRange?: readonly [number, number];
  /** Sparse：反馈延迟区间（秒），默认 [6, 10]。 */
  readonly sparseEchoRange?: readonly [number, number];
  /** Sparse：反馈重复次数，默认 3。 */
  readonly sparseEchoRepeats?: number;
  /** Pendulum：tape loop 长度（秒），默认 [10, 13, 17]。 */
  readonly pendulumLoopSeconds?: readonly number[];
}

// 五声音阶（与 generatePhrase 春季 profile 一致，营造「中正平和」的环境底色）。
const PENTATONIC = [0, 2, 4, 7, 9] as const;

function clampMidi(m: number): number {
  return Math.max(0, Math.min(127, Math.round(m)));
}

function clampVelocity(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
// 公开 midiToFreq（render-bgm 共享同一映射，避免重复实现）。
export { midiToFreq };

/** 默认时长（秒），与 AmbientMode 一一对应。 */
const DEFAULT_DURATION: Readonly<Record<AmbientMode, number>> = Object.freeze({
  eno: 90,
  reich: 80,
  sparse: 70,
  pendulum: 60
});

/** 默认名义 BPM。sparse 模式实际不用 BPM，仅元数据。 */
const DEFAULT_BPM: Readonly<Record<AmbientMode, number>> = Object.freeze({
  eno: 60,
  reich: 72,
  sparse: 60,
  pendulum: 60
});

interface ModeFullParams {
  enoLoopBeats: readonly [number, number, number];
  reichDriftRate: number;
  sparseIntervalRange: readonly [number, number];
  sparseEchoRange: readonly [number, number];
  sparseEchoRepeats: number;
  pendulumLoopSeconds: readonly number[];
}

function resolveParams(p: AmbientModeParams | undefined): ModeFullParams {
  return {
    enoLoopBeats: p?.enoLoopBeats ?? [7, 8, 11],
    reichDriftRate: p?.reichDriftRate ?? 0.9999,
    sparseIntervalRange: p?.sparseIntervalRange ?? [8, 16],
    sparseEchoRange: p?.sparseEchoRange ?? [6, 10],
    sparseEchoRepeats: p?.sparseEchoRepeats ?? 3,
    pendulumLoopSeconds: p?.pendulumLoopSeconds ?? [10, 13, 17]
  };
}

/**
 * 生成一段环境音事件序列（4 种模式之一）。同 seed + 同 mode + 同 opts ⇒ 字节级相同的 AmbientPhrase。
 *
 * 用法（render-bgm 离线烘焙或单测）：
 * ```ts
 * const phrase = generateAmbientPhrase({ seed: 'narration:prologue', mode: 'eno', durationSeconds: 90 });
 * for (const ev of phrase.events) { /* 合成 ev.time/ev.duration/ev.midi *\/ }
 * ```
 */
export function generateAmbientPhrase(opts: GenerateAmbientOptions): AmbientPhrase {
  const { mode } = opts;
  const params = resolveParams(opts.params);
  const durationSeconds = opts.durationSeconds ?? DEFAULT_DURATION[mode];
  const bpm = opts.bpm ?? DEFAULT_BPM[mode];
  const rootMidi = opts.rootMidi ?? 60;
  const seedNum = typeof opts.seed === 'number' ? opts.seed >>> 0 : hashStr(opts.seed);
  const master = new Rng(seedNum);

  let events: AmbientEvent[];
  switch (mode) {
    case 'eno':
      events = enoEvents(master.fork('eno'), rootMidi, durationSeconds, bpm, params.enoLoopBeats);
      break;
    case 'reich':
      events = reichEvents(master.fork('reich'), rootMidi, durationSeconds, bpm, params.reichDriftRate);
      break;
    case 'sparse':
      events = sparseEvents(master.fork('sparse'), rootMidi, durationSeconds, params);
      break;
    case 'pendulum':
      events = pendulumEvents(master.fork('pendulum'), rootMidi, durationSeconds, params.pendulumLoopSeconds);
      break;
    default:
      events = [];
  }

  events.sort((a, b) => a.time - b.time || a.midi - b.midi);
  return Object.freeze({
    seed: seedNum,
    mode,
    bpm,
    durationSeconds,
    rootMidi,
    events: Object.freeze(events)
  });
}

/**
 * Eno 模式：3 条互质拍长（默认 7/8/11 四分音符）的短动机循环 + sine pad 衬底。
 *
 * 实现：
 * - 每条 loop 取一段 3-4 音的动机（从五声音阶 + 根音偏移 Rng 派生）。
 * - Loop 周期 = beats × (60/bpm) 秒；在 durationSeconds 内每个周期触发动机所有音。
 * - 三条 loop 互质拍长 ⇒ 相位持续漂移、缓慢汇合（LCM 周期内才完全对齐）。
 * - pad：根音 + 五度 + 八度，长延音（整段时长），力度柔。
 *
 * 红线：不依赖 Tone.Loop（这是数据层）；render-bgm 把事件铺到时间轴即可。
 */
function enoEvents(
  rng: Rng,
  rootMidi: number,
  durationSeconds: number,
  bpm: number,
  loopBeats: readonly [number, number, number]
): AmbientEvent[] {
  const events: AmbientEvent[] = [];
  const secPerBeat = 60 / bpm;
  // pad：根音 + 五度 + 八度，整段延音，柔力度（让中频背景存在）。
  const padOffsets = [0, 7, 12];
  for (const off of padOffsets) {
    events.push({
      time: 0,
      duration: durationSeconds,
      midi: clampMidi(rootMidi - 12 + off),
      velocity: 0.08,
      voice: 'pad'
    });
  }
  // 3 条 loop：每条独立动机（3-4 音，五声音阶偏移），按其周期循环。
  for (let li = 0; li < loopBeats.length; li++) {
    const beats = loopBeats[li]!;
    const period = beats * secPerBeat;
    const motiveLen = rng.intRange(3, 5); // 3..4
    const octave = li === 0 ? 0 : li === 1 ? 12 : -12;
    const motive: { midi: number; durBeats: number }[] = [];
    for (let i = 0; i < motiveLen; i++) {
      const degreeOff = PENTATONIC[rng.intRange(0, PENTATONIC.length)]!;
      motive.push({
        midi: clampMidi(rootMidi + octave + degreeOff),
        durBeats: rng.floatRange(0.6, 1.4)
      });
    }
    // 在 durationSeconds 内每个周期触发动机所有音（相对周期起点 0..beats 拍）。
    let cycle = 0;
    while (cycle * period < durationSeconds) {
      for (let i = 0; i < motive.length; i++) {
        const startBeatInCycle = (i / motive.length) * beats;
        const t = cycle * period + startBeatInCycle * secPerBeat;
        if (t < durationSeconds) {
          events.push({
            time: t,
            duration: motive[i]!.durBeats * secPerBeat * 1.6,
            midi: motive[i]!.midi,
            velocity: clampVelocity(0.16 + rng.floatRange(0, 0.06)),
            voice: `eno-loop-${li}`
          });
        }
      }
      cycle++;
    }
  }
  return events;
}

/**
 * Reich 模式：两段同序列（piano-phase 风格），其一 playbackRate 漂移。
 *
 * 实现：
 * - 取一段 N 音（默认 12，参照 Reich「Piano Phase」原作）序列，五声音阶派生。
 * - voice A：按 bpm/原周期触发序列。
 * - voice B：按 bpm × driftRate 的视在周期触发（driftRate<1 ⇒ B 略慢，逐步向后漂移）。
 * - 渲染层（render-bgm / 实时回放）只需在时间轴上铺这两条事件流；漂移体现在 B 的时间映射。
 *
 * 注意：实际 Reich 效果由事件时间错位自然产生——A、B 重复铺同一动机但时间不同步。
 */
function reichEvents(
  rng: Rng,
  rootMidi: number,
  durationSeconds: number,
  bpm: number,
  driftRate: number
): AmbientEvent[] {
  const events: AmbientEvent[] = [];
  const secPerBeat = 60 / bpm;
  const patternLen = 12;
  // 12 音 pattern：五声音阶派生（让和声中正）。
  const pattern: { midi: number; durBeats: number }[] = [];
  for (let i = 0; i < patternLen; i++) {
    const degreeOff = PENTATONIC[rng.intRange(0, PENTATONIC.length)]!;
    pattern.push({
      midi: clampMidi(rootMidi + degreeOff),
      durBeats: 1 // 一拍一音（Piano Phase 骨架）
    });
  }
  // Voice A：bpm 名义速度。
  let tA = 0;
  let idxA = 0;
  while (tA < durationSeconds) {
    const note = pattern[idxA % patternLen]!;
    events.push({
      time: tA,
      duration: note.durBeats * secPerBeat * 0.9,
      midi: note.midi,
      velocity: 0.22,
      voice: 'reich-a'
    });
    tA += note.durBeats * secPerBeat;
    idxA++;
  }
  // Voice B：视在速度 = bpm × driftRate（driftRate<1 ⇒ B 慢，向后漂移）。
  // 时间映射：tB[i] = i × (secPerBeat / driftRate)。
  const secPerBeatB = secPerBeat / driftRate;
  let tB = 0;
  let idxB = 0;
  while (tB < durationSeconds) {
    const note = pattern[idxB % patternLen]!;
    events.push({
      time: tB,
      duration: note.durBeats * secPerBeatB * 0.9,
      midi: note.midi,
      velocity: 0.2,
      voice: 'reich-b'
    });
    tB += note.durBeats * secPerBeatB;
    idxB++;
  }
  return events;
}

/**
 * Sparse 模式：8-16s/事件 + 6-10s 反馈延迟回声（Harold Budd / Stars of the Lid 风格）。
 *
 * 实现：
 * - 主音事件：按 [8,16]s 区间随机间隔触发；五声音阶 + 八度上下，长持续（5-9s），柔力度。
 * - 反馈延迟：每个主音 echo `[6,10]s` 后，衰减重复 `sparseEchoRepeats` 次，每次 ×0.4 gain。
 * - pad 衬底：根音长延音，与 Eno 同。
 */
function sparseEvents(
  rng: Rng,
  rootMidi: number,
  durationSeconds: number,
  params: ModeFullParams
): AmbientEvent[] {
  const events: AmbientEvent[] = [];
  // pad：根音 + 八度，整段延音。
  for (const off of [0, 12]) {
    events.push({
      time: 0,
      duration: durationSeconds,
      midi: clampMidi(rootMidi - 12 + off),
      velocity: 0.06,
      voice: 'pad'
    });
  }
  const [intervalMin, intervalMax] = params.sparseIntervalRange;
  const [echoMin, echoMax] = params.sparseEchoRange;
  const repeats = params.sparseEchoRepeats;
  let t = rng.floatRange(0.5, 2.5);
  while (t < durationSeconds) {
    const degreeOff = PENTATONIC[rng.intRange(0, PENTATONIC.length)]!;
    const octave = rng.chance(0.5) ? 12 : 0;
    const midi = clampMidi(rootMidi + octave + degreeOff);
    const dur = rng.floatRange(5, 9);
    const vel = clampVelocity(0.28 + rng.floatRange(0, 0.08));
    events.push({ time: t, duration: dur, midi, velocity: vel, voice: 'sparse-main' });
    // 反馈回声：[6,10]s 后第一次回声，重复 repeats 次，每次间隔同 echo 间隔，gain ×0.4。
    let echoTime = t + rng.floatRange(echoMin, echoMax);
    let echoVel = vel * 0.4;
    for (let r = 0; r < repeats && echoTime < durationSeconds; r++) {
      events.push({
        time: echoTime,
        duration: dur * 0.8,
        midi,
        velocity: clampVelocity(echoVel),
        voice: `sparse-echo-${r}`
      });
      echoTime += rng.floatRange(echoMin, echoMax);
      echoVel *= 0.4;
    }
    t += rng.floatRange(intervalMin, intervalMax);
  }
  return events;
}

/**
 * Pendulum 模式：N 条不同长度 tape loop 触发同一样本（Reich Pendulum Music 风格）。
 *
 * 实现：
 * - N 条 loop（默认 3 条，长度 [10,13,17] 秒，互质以确保漂移）。
 * - 每条 loop 在自己的周期点触发同一根音样本（短持续 1.5-2.5s），力度微抖动。
 * - 各 loop 周期不同 ⇒ 持续漂移、缓慢汇合（LCM 周期内才完全对齐）。
 */
function pendulumEvents(
  rng: Rng,
  rootMidi: number,
  durationSeconds: number,
  loopSeconds: readonly number[]
): AmbientEvent[] {
  const events: AmbientEvent[] = [];
  for (let li = 0; li < loopSeconds.length; li++) {
    const period = loopSeconds[li]!;
    // 每条 loop 的样本音高（根音 + 微偏移，让 N 条互不堆叠成同一音）。
    const degreeOff = PENTATONIC[li % PENTATONIC.length]!;
    const octave = li === 0 ? 0 : li === 1 ? 12 : -12;
    const midi = clampMidi(rootMidi + octave + degreeOff);
    const dur = rng.floatRange(1.5, 2.5);
    const startOffset = rng.floatRange(0, period); // 起点抖动，避免完全同步
    let cycle = 0;
    while (cycle * period + startOffset < durationSeconds) {
      const t = cycle * period + startOffset;
      if (t >= 0 && t < durationSeconds) {
        events.push({
          time: t,
          duration: dur,
          midi,
          velocity: clampVelocity(0.22 + rng.floatRange(0, 0.06)),
          voice: `pendulum-${li}`
        });
      }
      cycle++;
    }
  }
  return events;
}
