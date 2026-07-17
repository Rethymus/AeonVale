/**
 * 程序化生成式 BGM 引擎（纯函数、确定性、零音频依赖）。
 *
 * 设计要点（C7 程序化优先 + 仿星露谷四季自适应）：
 * - 旋律：一阶马尔可夫链，按季节切换转移矩阵（春昂扬级进、冬疏离大跳）。
 * - 和声：小型生成式文法（CFG）逐小节挑选和弦根音，避免连续重复以推动进行。
 * - 织体：lead（旋律）+ pad（和弦长音）+ bass（根音）+ pluck（点缀），分声部。
 * - 分区/分时：season 四季调色板（音阶/根音/BPM/音色倾向/密度），zone 改密度与活跃度，
 *   tension（calm/tense）改 BPM、不协和度与打击层。
 * - 确定性：同 seed + 同 (season,zone,tension) ⇒ 完全相同的 MusicPhrase（项目 Rng/Mulberry32）。
 *   签名主题曲走同一路径、固定 seed，故"同路生成"且可复现、零委约、避 Suno/Udio。
 *
 * 该模块不触碰 AudioContext/DOM，可在 Node 单测与离线渲染（Tone.Offline）中直接验证。
 */
import { Rng, hashStr } from '@sim/world/rng';

export type MusicSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type MusicZone = 'farm' | 'market' | 'forest' | 'tribulation';
export type MusicTension = 'calm' | 'tense';

export interface MusicNote {
  /** 相对乐句起点的拍数（beatsPerBar=4）。 */
  readonly startBeat: number;
  readonly durationBeats: number;
  /** MIDI 音高 0..127。 */
  readonly midi: number;
  /** 力度 0..1。 */
  readonly velocity: number;
  readonly voice: 'lead' | 'pad' | 'bass' | 'pluck';
}

export interface MusicPhrase {
  readonly seed: number;
  readonly season: MusicSeason;
  readonly zone: MusicZone;
  readonly tension: MusicTension;
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly bars: number;
  /** 使用的音阶（相对根音的半音偏移）。 */
  readonly scale: readonly number[];
  readonly rootMidi: number;
  readonly notes: readonly MusicNote[];
}

export interface GeneratePhraseOptions {
  readonly seed: number | string;
  readonly season: MusicSeason;
  readonly zone: MusicZone;
  readonly tension: MusicTension;
  /** 乐句小节数；默认 4（calm）/ 2（tense）。 */
  readonly bars?: number;
}

/** 签名主题曲固定种子：大道之歌动机由此可复现。 */
export const SIGNATURE_THEME_SEED = 'aeon-vale:dao-song-v1';
/** 签名动机（相对根音的半音偏移序列，作为 lead 第 1 小节锚点）。 */
export const SIGNATURE_MOTIVE_OFFSETS = [0, 7, 9, 12] as const;

interface SeasonProfile {
  readonly scale: readonly number[];
  readonly rootMidi: number;
  readonly bpm: number;
  /** lead 步进粒度（每拍 subdiv，越小越活跃）。 */
  readonly subdivision: number;
  /** 默认密度（一拍出音概率）。 */
  readonly density: number;
  /** lead 倾向音色（仅元数据，驱动层据此刻画合成器）。 */
  readonly leadVoice: 'triangle' | 'square' | 'sine' | 'sawtooth';
  /** 和弦候选（scale 下标），权重相同；越靠前越常用。 */
  readonly chords: readonly number[];
}

const SEASON_PROFILES: Readonly<Record<MusicSeason, SeasonProfile>> = {
  // 春：大调五声，明亮、级进、中速。
  spring: {
    scale: [0, 2, 4, 7, 9],
    rootMidi: 60,
    bpm: 74,
    subdivision: 0.5,
    density: 0.78,
    leadVoice: 'triangle',
    chords: [0, 4, 2, 3]
  },
  // 夏：利底亚，最亮、最活跃、上行倾向。
  summer: {
    scale: [0, 2, 4, 6, 7, 9, 11],
    rootMidi: 62,
    bpm: 98,
    subdivision: 0.25,
    density: 0.85,
    leadVoice: 'square',
    chords: [0, 4, 1, 5]
  },
  // 秋：多利亚，温润、偏低、回旋。
  autumn: {
    scale: [0, 2, 3, 5, 7, 9, 10],
    rootMidi: 57,
    bpm: 66,
    subdivision: 0.5,
    density: 0.7,
    leadVoice: 'triangle',
    chords: [0, 3, 4, 1]
  },
  // 冬：小调五声，疏离、最低速、铃音式。
  winter: {
    scale: [0, 3, 5, 7, 10],
    rootMidi: 55,
    bpm: 58,
    subdivision: 1,
    density: 0.52,
    leadVoice: 'sine',
    chords: [0, 3, 2, 4]
  }
};

/** zone 对密度/活跃度的乘子。 */
const ZONE_DENSITY: Readonly<Record<MusicZone, number>> = {
  farm: 1.0,
  market: 1.18,
  forest: 0.74,
  tribulation: 0.9
};

/** tense 相对 calm 的 BPM 提升。 */
const TENSE_BPM_BOOST = 1.16;
/** tense 促使 lead 出现更大跳进的权重。 */
const TENSE_LEAP_BIAS = 0.35;

/** 一阶马尔可夫转移表：当前 scale 下标 → 候选下标权重。季节无关的骨架，季节再偏置。 */
function melodyStepWeights(current: number, scaleLen: number, season: MusicSeason, tension: MusicTension): { item: number; weight: number }[] {
  const candidates: number[] = [];
  // 级进（±1）、三度（±2）、同音保留（0）、大跳（±3..）
  for (let delta of [-1, 1, -2, 2, 0, -3, 3]) {
    const next = current + delta;
    if (next >= 0 && next < scaleLen) candidates.push(next);
  }
  // 冬季偏好大跳与同音（疏离感），夏季偏好级进上行。
  let baseWeight: (delta: number) => number;
  if (season === 'winter') baseWeight = d => (Math.abs(d) >= 3 ? 3 : Math.abs(d) === 0 ? 2 : 1);
  else if (season === 'summer') baseWeight = d => (d > 0 && d <= 2 ? 3 : d < 0 ? 1 : 2);
  else baseWeight = d => (Math.abs(d) <= 1 ? 3 : Math.abs(d) === 2 ? 2 : 1);
  return candidates.map(c => {
    const delta = c - current;
    let w = baseWeight(delta);
    if (tension === 'tense' && Math.abs(delta) >= 3) w += TENSE_LEAP_BIAS * 4;
    return { item: c, weight: w };
  });
}

/** 由 scale 下标取一个三度叠置和弦（跳过相邻音），返回相对根音的半音偏移（已含八度回绕）。 */
function chordOffsets(rootIndex: number, scale: readonly number[]): number[] {
  const n = scale.length;
  const idx = (k: number) => ((k % n) + n) % n;
  const wrap = (k: number) => (k >= n ? 12 : 0) + (k >= 2 * n ? 12 : 0);
  const r = scale[idx(rootIndex)] ?? 0;
  const third = (scale[idx(rootIndex + 2)] ?? 0) + wrap(rootIndex + 2);
  const fifth = (scale[idx(rootIndex + 4)] ?? 0) + wrap(rootIndex + 4);
  // 去重并排序，保证 pad 织体干净。
  return [r, third, fifth]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a - b);
}

function clampMidi(m: number): number {
  return Math.max(0, Math.min(127, Math.round(m)));
}

function clampVelocity(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * 生成一段确定性乐句。同 seed + 同 (season,zone,tension,bars) ⇒ 字节级相同的 MusicPhrase。
 */
export function generatePhrase(opts: GeneratePhraseOptions): MusicPhrase {
  const { season, zone, tension } = opts;
  const profile = SEASON_PROFILES[season];
  const bars = opts.bars ?? (tension === 'tense' ? 2 : 4);
  const beatsPerBar = 4;
  const seedNum = typeof opts.seed === 'number' ? opts.seed >>> 0 : hashStr(opts.seed);
  const master = new Rng(seedNum);
  const melodyRng = master.fork('melody');
  const harmonyRng = master.fork('harmony');
  const densityRng = master.fork('density');

  const bpm = Math.round(profile.bpm * (tension === 'tense' ? TENSE_BPM_BOOST : 1));
  const density = Math.min(0.97, profile.density * ZONE_DENSITY[zone]);
  const subdivision = profile.subdivision;

  const isSignature = typeof opts.seed === 'string' && opts.seed === SIGNATURE_THEME_SEED;
  const notes: MusicNote[] = [];
  const scale = profile.scale;
  const scaleLen = scale.length;

  // 逐小节生成：先定和弦（和声文法），再铺 pad/bass，最后 lead 走马尔可夫。
  let prevChordIndex = -1;
  let leadDegree = 0;
  for (let bar = 0; bar < bars; bar++) {
    // —— 和声文法：从季节和弦候选中加权挑选，轻微惩罚重复以推动进行 ——
    const candidates = profile.chords
      .map((deg, idx) => ({ deg, idx }))
      .filter((_, i) => true);
    const chordItems = candidates.map(c => ({
      item: c.deg,
      weight: c.deg === prevChordIndex && bar > 0 ? 1 : 3 + (c.idx === 0 ? 1 : 0)
    }));
    const chordRoot = harmonyRng.weighted(chordItems);
    prevChordIndex = chordRoot;
    const chord = chordOffsets(chordRoot, scale);
    const barStartBeat = bar * beatsPerBar;

    // —— pad：和弦长音，整小节延音，柔力度 ——
    for (const off of chord) {
      notes.push({
        startBeat: barStartBeat,
        durationBeats: beatsPerBar,
        midi: clampMidi(profile.rootMidi + off),
        velocity: clampVelocity(tension === 'tense' ? 0.16 : 0.12),
        voice: 'pad'
      });
    }

    // —— bass：根音低八度，每两拍换一次（轻微行走感）——
    const bassRoot = scale[chordRoot % scaleLen] ?? 0;
    notes.push({
      startBeat: barStartBeat,
      durationBeats: 2,
      midi: clampMidi(profile.rootMidi + bassRoot - 12),
      velocity: clampVelocity(0.22),
      voice: 'bass'
    });
    const secondBassOff = chord[1] ?? bassRoot;
    notes.push({
      startBeat: barStartBeat + 2,
      durationBeats: 2,
      midi: clampMidi(profile.rootMidi + secondBassOff - 12),
      velocity: clampVelocity(0.2),
      voice: 'bass'
    });

    // —— 签名动机：第 1 小节 lead 锚定固定动机（可复现的"人格"）——
    if (isSignature && bar === 0) {
      for (let i = 0; i < SIGNATURE_MOTIVE_OFFSETS.length; i++) {
        const off = SIGNATURE_MOTIVE_OFFSETS[i]!;
        notes.push({
          startBeat: barStartBeat + i,
          durationBeats: 0.9,
          midi: clampMidi(profile.rootMidi + 12 + off),
          velocity: clampVelocity(0.5),
          voice: 'lead'
        });
      }
      leadDegree = (chordRoot + 2) % scaleLen;
      continue;
    }

    // —— lead：按细分拍走马尔可夫，密度控制出音/休止 ——
    const stepsPerBar = beatsPerBar / subdivision;
    for (let s = 0; s < stepsPerBar; s++) {
      const startBeat = barStartBeat + s * subdivision;
      if (!densityRng.chance(density)) continue;
      // 把当前 leadDegree 拉向和弦内音（弱吸附，保证旋律与和声不冲突）。
      if (densityRng.chance(0.45)) {
        const inChord = chord.map(c => {
          const idx = scale.indexOf((c % 12 === c ? c : c % 12));
          return idx >= 0 ? idx : -1;
        }).filter(i => i >= 0);
        if (inChord.length) leadDegree = densityRng.pick(inChord);
      }
      const choices = melodyStepWeights(leadDegree, scaleLen, season, tension);
      leadDegree = melodyRng.weighted(choices);
      const octave = leadDegree < chordRoot - 1 ? 12 : 0;
      const midi = clampMidi(profile.rootMidi + octave + scale[leadDegree]!);
      const dur = subdivision * (tension === 'tense' ? 0.8 : 1.1) * (season === 'summer' ? 0.9 : 1);
      notes.push({
        startBeat,
        durationBeats: Math.max(0.2, dur),
        midi,
        velocity: clampVelocity(0.34 + melodyRng.floatRange(0, 0.14)),
        voice: 'lead'
      });
    }

    // —— 市集/夏季：偶尔点缀 pluck，增强节奏感（非战斗区）——
    if ((zone === 'market' || season === 'summer') && densityRng.chance(0.4)) {
      notes.push({
        startBeat: barStartBeat + (densityRng.intRange(0, 4)),
        durationBeats: 0.3,
        midi: clampMidi(profile.rootMidi + 24 + (scale[densityRng.intRange(0, scaleLen)] ?? 0)),
        velocity: clampVelocity(0.18),
        voice: 'pluck'
      });
    }
  }

  // 按起点排序，便于驱动层线性调度。
  notes.sort((a, b) => (a.startBeat - b.startBeat) || (a.midi - b.midi));

  return Object.freeze({
    seed: seedNum,
    season,
    zone,
    tension,
    bpm,
    beatsPerBar,
    bars,
    scale,
    rootMidi: profile.rootMidi,
    notes: Object.freeze(notes.slice())
  });
}

/** 便捷：生成签名主题曲（固定 seed，默认春 calm farm，可叠加 zone/tension 变体）。 */
export function generateSignatureTheme(
  overrides: Partial<Pick<GeneratePhraseOptions, 'zone' | 'tension' | 'bars'>> = {}
): MusicPhrase {
  return generatePhrase({
    seed: SIGNATURE_THEME_SEED,
    season: 'spring',
    zone: overrides.zone ?? 'farm',
    tension: overrides.tension ?? 'calm',
    bars: overrides.bars ?? 8
  });
}

/** 拍→秒。 */
export function beatsToSeconds(bpm: number, beats: number): number {
  return (beats * 60) / bpm;
}

/** 整段乐句时长（秒），按末音结束计。 */
export function phraseDurationSeconds(phrase: MusicPhrase): number {
  let end = 0;
  for (const n of phrase.notes) end = Math.max(end, n.startBeat + n.durationBeats);
  return beatsToSeconds(phrase.bpm, end);
}
