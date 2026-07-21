/*
 * render-bgm.ts —— 程序化 BGM 离线烘焙工具（无 GPU / 零委约 / 避 Suno·Udio）。
 *
 * 流水线：generatePhrase（纯函数，马尔可夫旋律 + 生成式和声文法，四季调色板）
 *   → renderPhraseToFloat32（确定性 PCM 合成，分声部 ADSR，Node 内无需 AudioContext）
 *   → WAV（16-bit PCM）
 *   → ffmpeg（loudnorm 响度归一 + afade 进出 + libvorbis 编码 ogg）
 *   → 写入 assets/audio/bgm/，并产出 provenance 残留（.omc/artifacts/audio-provenance.json）
 *     与可直接粘贴进 assets/manifest.json 的 audio 条目。
 *
 * 游戏内 BGM 走 Tone.js 实时自适应（见 src/io/bgm.ts）；本工具烘焙的是同源乐句数据，
 * 用于作品集试听 / 预告 / 签名主题曲母带，二者共享 generatePhrase 故"同路生成"且可复现。
 *
 * 用法：pnpm exec tsx tools/render-bgm.ts [--update-manifest] [--out=assets/audio/bgm]
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generatePhrase,
  generateSignatureTheme,
  phraseDurationSeconds,
  beatsToSeconds,
  SIGNATURE_THEME_SEED,
  type MusicPhrase,
  type MusicSeason
} from '@io/generativeMusic';
import {
  generateAmbientPhrase,
  midiToFreq,
  type AmbientPhrase,
  type AmbientMode
} from '@io/generativeAmbient';

const SAMPLE_RATE = 44100;

type OscType = 'sine' | 'square' | 'sawtooth' | 'triangle';

interface AdsrCfg {
  readonly a: number;
  readonly d: number;
  readonly s: number;
  readonly r: number;
}

const VOICE_ENV: Readonly<Record<'lead' | 'pad' | 'bass' | 'pluck', AdsrCfg>> = {
  lead: { a: 0.02, d: 0.1, s: 0.5, r: 0.4 },
  pad: { a: 0.6, d: 0.4, s: 0.7, r: 1.6 },
  bass: { a: 0.02, d: 0.2, s: 0.6, r: 0.3 },
  pluck: { a: 0.005, d: 0.15, s: 0.1, r: 0.2 }
};

/** 与 src/io/bgm.ts 的 SEASON_LEAD_OSC 保持一致：四季 lead 音色辨识度。 */
const SEASON_LEAD_OSC: Readonly<Record<MusicSeason, OscType>> = {
  spring: 'triangle',
  summer: 'square',
  autumn: 'triangle',
  winter: 'sine'
};

function osc(type: OscType, phase: number): number {
  const p = phase - Math.floor(phase);
  switch (type) {
    case 'square':
      return p < 0.5 ? 1 : -1;
    case 'sawtooth':
      return 2 * p - 1;
    case 'triangle':
      return 2 * Math.abs(2 * p - 1) - 1;
    case 'sine':
    default:
      return Math.sin(2 * Math.PI * p);
  }
}

function envAt(t: number, dur: number, cfg: AdsrCfg): number {
  const releaseStart = Math.max(cfg.a + cfg.d, dur);
  const totalEnd = dur + cfg.r;
  if (t < cfg.a) return cfg.a > 0 ? t / cfg.a : 1;
  if (t < cfg.a + cfg.d) {
    const k = cfg.d > 0 ? (t - cfg.a) / cfg.d : 1;
    return 1 + (cfg.s - 1) * k;
  }
  if (t < releaseStart) return cfg.s;
  if (t < totalEnd) {
    const k = cfg.r > 0 ? (t - releaseStart) / cfg.r : 1;
    return cfg.s * (1 - k);
  }
  return 0;
}

function voiceOsc(voice: 'lead' | 'pad' | 'bass' | 'pluck', season: MusicSeason): OscType {
  if (voice === 'lead') return SEASON_LEAD_OSC[season];
  if (voice === 'pluck') return 'triangle';
  return 'sine'; // pad / bass
}

function voiceAmp(voice: 'lead' | 'pad' | 'bass' | 'pluck'): number {
  switch (voice) {
    case 'pad':
      return 0.45;
    case 'bass':
      return 0.8;
    case 'pluck':
      return 0.4;
    default:
      return 0.6;
  }
}

/** 把一段乐句确定性合成为单声道 PCM（Float32）。 */
export function renderPhraseToFloat32(phrase: MusicPhrase, sr = SAMPLE_RATE): Float32Array {
  const totalSec = phraseDurationSeconds(phrase) + 1.0;
  const n = Math.ceil(totalSec * sr);
  const buf = new Float32Array(n);
  for (const note of phrase.notes) {
    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
    const startSec = beatsToSeconds(phrase.bpm, note.startBeat);
    const durSec = beatsToSeconds(phrase.bpm, note.durationBeats);
    const type = voiceOsc(note.voice, phrase.season);
    const cfg = VOICE_ENV[note.voice];
    const amp = note.velocity * voiceAmp(note.voice);
    const start = Math.floor(startSec * sr);
    const noteSamples = Math.floor((durSec + cfg.r) * sr);
    let phase = Math.random() * 0; // 固定 0 起点，保证确定性
    const phaseInc = freq / sr;
    for (let i = 0; i < noteSamples; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= n) {
        phase += phaseInc;
        continue;
      }
      const e = envAt(i / sr, durSec, cfg);
      if (e > 0) buf[idx] = (buf[idx] ?? 0) + amp * e * osc(type, phase);
      phase += phaseInc;
    }
  }
  // 峰值归一 + 软削波，避免 PCM 削顶失真（loudnorm 再做响度归一）。
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) {
    const scale = 0.9 / peak;
    for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i]! * scale);
  }
  return buf;
}

function writeWav(path: string, pcm: Float32Array, sr = SAMPLE_RATE): void {
  const byteRate = sr * 2;
  const blockAlign = 2;
  const dataSize = pcm.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sr, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  writeFileSync(path, buffer);
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

interface Track {
  readonly id: string;
  /** generatePhrase 茎或 generateAmbientPhrase 茎（v2）。 */
  readonly phrase: MusicPhrase | AmbientPhrase;
  readonly seedLabel: string;
  readonly note: string;
}

/**
 * V2 环境音茎（第二刀）：由 generateAmbientPhrase 驱动的 Eno/Reich/Sparse 模式。
 * 与第一刀的 generatePhrase 茎分轨并存：保留原 prologue/tribulation（Markov/grammar 茎）
 * 以维持已有 fixture 与 manifest checksum 稳定，新茎加 -v2 后缀便于主循环合并阶段替换。
 */
interface AmbientTrack {
  readonly id: string;
  readonly phrase: AmbientPhrase;
  readonly seedLabel: string;
  readonly note: string;
}

function buildAmbientV2Tracks(): AmbientTrack[] {
  const tracks: AmbientTrack[] = [
    {
      id: 'bgm.narration.prologue-v2',
      phrase: generateAmbientPhrase({
        seed: 'narration:prologue:v2',
        mode: 'eno',
        durationSeconds: 90,
        bpm: 60,
        rootMidi: 60
      }),
      seedLabel: 'narration:prologue:v2',
      note: '序章 Eno 风格环境茎（互质拍长 7/8/11 + sine pad；Eno「Music for Airports」思路，Tero Parviainen systems-music 范式）。'
    },
    {
      id: 'bgm.narration.tribulation-v2',
      phrase: generateAmbientPhrase({
        seed: 'narration:tribulation:v2',
        mode: 'reich',
        durationSeconds: 80,
        bpm: 72,
        rootMidi: 57
      }),
      seedLabel: 'narration:tribulation:v2',
      note: '渡劫 Reich 风格相位漂移茎（两段同序列，driftRate 0.9999，piano-phase 错相）。'
    },
    {
      id: 'bgm.narration.ending-e6',
      phrase: generateAmbientPhrase({
        seed: 'narration:ending-e6',
        mode: 'sparse',
        durationSeconds: 70,
        rootMidi: 55
      }),
      seedLabel: 'narration:ending-e6',
      note: 'E6 结局 sparse 茎（8-16s 事件 + 6-10s 反馈延迟；Harold Budd / Stars of the Lid 风格）。'
    },
    {
      id: 'bgm.narration.sacrifice',
      phrase: generateAmbientPhrase({
        seed: 'narration:sacrifice',
        mode: 'sparse',
        durationSeconds: 70,
        rootMidi: 50
      }),
      seedLabel: 'narration:sacrifice',
      note: '献祭结局 sparse 茎（更低根音 D3 + sparse 反馈延迟，苍凉收束）。'
    }
  ];
  return tracks;
}

/** 环境音事件 → 单声道 PCM（Float32）。pad 走 sine 慢包络；动机/echo 走 triangle/sine 软包络。 */
export function renderAmbientToFloat32(phrase: AmbientPhrase, sr = SAMPLE_RATE): Float32Array {
  const totalSec = phrase.durationSeconds + 4.0; // 尾部 release
  const n = Math.ceil(totalSec * sr);
  const buf = new Float32Array(n);
  for (const ev of phrase.events) {
    const freq = midiToFreq(ev.midi);
    const startIdx = Math.floor(ev.time * sr);
    const isPad = ev.voice === 'pad';
    const isEcho = ev.voice.startsWith('sparse-echo');
    const isPendulum = ev.voice.startsWith('pendulum');
    const type: OscType = isPad ? 'sine' : isPendulum ? 'triangle' : isEcho ? 'sine' : 'triangle';
    const amp = ev.velocity * (isPad ? 0.55 : isEcho ? 0.45 : 0.5);
    const attack = isPad ? 1.4 : 0.01;
    const release = isPad ? 1.8 : isEcho ? 1.2 : 0.4;
    const noteSamples = Math.floor((ev.duration + release + 0.1) * sr);
    let phase = 0;
    const phaseInc = freq / sr;
    for (let i = 0; i < noteSamples; i++) {
      const idx = startIdx + i;
      if (idx < 0 || idx >= n) {
        phase += phaseInc;
        continue;
      }
      const t = i / sr;
      let env: number;
      if (t < attack) env = attack > 0 ? t / attack : 1;
      else if (t < ev.duration) env = 1;
      else {
        const r = release > 0 ? (t - ev.duration) / release : 1;
        env = Math.max(0, 1 - r);
      }
      if (ev.velocity > 0 && env > 0) buf[idx] = (buf[idx] ?? 0) + amp * env * osc(type, phase);
      phase += phaseInc;
    }
  }
  // 峰值归一 + 软削波（同 renderPhraseToFloat32）。
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) {
    const scale = 0.85 / peak;
    for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i]! * scale);
  }
  return buf;
}

/**
 * 灵韵叙录 7 个 narration 茎（docs/22 §12 + 音频调研 Path B）。
 * 第一刀：复用 generatePhrase 内核（不新建 generativeAmbient）；通过 season/zone/tension/bars
 * 参数刻画各幕语境。zone='market' 借密度乘子 1.18 模拟"古朴升密度"；zone='forest' 借 0.74 稀疏化。
 */
function buildNarrationTracks(): Track[] {
  return [
    {
      id: 'bgm.narration.prologue',
      phrase: generatePhrase({ seed: 'narration:prologue', season: 'spring', zone: 'farm', tension: 'calm', bars: 8 }),
      seedLabel: 'narration:prologue',
      note: '序章迷茫空灵叙事茎（spring/farm/calm/bars:8，复用 generatePhrase）。'
    },
    {
      id: 'bgm.narration.village',
      phrase: generatePhrase({ seed: 'narration:village', season: 'spring', zone: 'market', tension: 'calm', bars: 4 }),
      seedLabel: 'narration:village',
      note: '荒村古朴叙事茎（spring/market/calm/bars:4，借 market 密度乘子 1.18 略升密度）。'
    },
    {
      id: 'bgm.narration.road',
      phrase: generatePhrase({ seed: 'narration:road', season: 'autumn', zone: 'forest', tension: 'calm', bars: 4 }),
      seedLabel: 'narration:road',
      note: '修仙路沉思叙事茎（autumn/forest/calm/bars:4，多利亚调色板 + forest 稀疏）。'
    },
    {
      id: 'bgm.narration.combat',
      phrase: generatePhrase({ seed: 'narration:combat', season: 'autumn', zone: 'tribulation', tension: 'tense', bars: 4 }),
      seedLabel: 'narration:combat',
      note: '打斗紧张叙事茎（autumn/tribulation/tense/bars:4，TENSE_BPM_BOOST 1.16 + leap bias）。'
    },
    {
      id: 'bgm.narration.tribulation',
      phrase: generatePhrase({ seed: 'narration:tribulation', season: 'autumn', zone: 'tribulation', tension: 'tense', bars: 4 }),
      seedLabel: 'narration:tribulation',
      note: '渡劫威压叙事茎（autumn/tribulation/tense/bars:4；运行时叠 narration-thunder SFX，不在茎里烘焙雷）。'
    },
    {
      id: 'bgm.narration.finale',
      phrase: generatePhrase({ seed: 'narration:finale', season: 'autumn', zone: 'forest', tension: 'calm', bars: 4 }),
      seedLabel: 'narration:finale',
      note: '终局苍凉叙事茎（autumn/forest/calm/bars:4，forest 0.74 密度营造稀疏感）。'
    },
    {
      id: 'bgm.narration.ending-ascension',
      phrase: generatePhrase({ seed: 'narration:ending-ascension', season: 'spring', zone: 'forest', tension: 'calm', bars: 8 }),
      seedLabel: 'narration:ending-ascension',
      note: '飞升超脱叙事茎（spring/forest/calm/bars:8，长延迟收尾）。'
    }
  ];
}

function buildTracks(): Track[] {
  const seasons: MusicSeason[] = ['spring', 'summer', 'autumn', 'winter'];
  const tracks: Track[] = [
    {
      id: 'bgm.signature-dao-song',
      phrase: generateSignatureTheme(),
      seedLabel: SIGNATURE_THEME_SEED,
      note: '签名主题曲「大道之歌」：固定种子动机，飞升结局同路生成。'
    }
  ];
  for (const season of seasons) {
    tracks.push({
      id: `bgm.season.${season}`,
      phrase: generatePhrase({ seed: season, season, zone: 'farm', tension: 'calm', bars: 4 }),
      seedLabel: season,
      note: `${season} 季自适应 BGM 烘焙（farm/calm），仿星露谷四季调色板。`
    });
  }
  // 灵韵叙录 7 茎（docs/22 §12）：复用 generatePhrase，不新建 generativeAmbient（第一刀简化）。
  tracks.push(...buildNarrationTracks());
  return tracks;
}

function ffmpegEncode(wavPath: string, oggPath: string, totalSec: number): void {
  const fadeOutStart = Math.max(0.2, totalSec - 1.2).toFixed(2);
  const filter = `loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutStart}:d=1.0`;
  // -fflags/-flags +bitexact 关闭 ogg 随机 serial，令产物字节级可复现（checksum 稳定）。
  execFileSync(
    'ffmpeg',
    ['-y', '-i', wavPath, '-af', filter, '-fflags', '+bitexact', '-flags', '+bitexact', '-c:a', 'libvorbis', '-q:a', '4', oggPath],
    { stdio: ['ignore', 'ignore', 'ignore'] }
  );
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const updateManifest = args.has('--update-manifest');
  const includeV2 = args.has('--v2-stems');
  const outArg = process.argv.find(a => a.startsWith('--out='));
  const outDir = resolve(outArg ? outArg.slice(6) : 'assets/audio/bgm');
  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  mkdirSync(resolve(projectRoot, outDir), { recursive: true });

  const tracks = buildTracks();
  if (includeV2) tracks.push(...buildAmbientV2Tracks());
  const provenance: unknown[] = [];
  const manifestEntries: unknown[] = [];

  for (const track of tracks) {
    const isAmbient = 'mode' in track.phrase && typeof track.phrase.mode === 'string';
    const pcm = isAmbient
      ? renderAmbientToFloat32(track.phrase as AmbientPhrase)
      : renderPhraseToFloat32(track.phrase as MusicPhrase);
    const totalSec = isAmbient
      ? (track.phrase as AmbientPhrase).durationSeconds + 1.0
      : phraseDurationSeconds(track.phrase as MusicPhrase) + 1.0;
    const baseName = track.id;
    const wavPath = resolve(projectRoot, outDir, `${baseName}.wav`);
    const oggPath = resolve(projectRoot, outDir, `${baseName}.ogg`);
    writeWav(wavPath, pcm);
    ffmpegEncode(wavPath, oggPath, totalSec);
    unlinkSync(wavPath); // 删除 WAV 中间产物，仅保留 ogg
    const checksum = sha256(oggPath);
    const cleanRel = `audio/bgm/${baseName}.ogg`;

    provenance.push({
      id: track.id,
      file: cleanRel,
      seed: track.seedLabel,
      mode: isAmbient ? (track.phrase as AmbientPhrase).mode : undefined,
      season: isAmbient ? undefined : (track.phrase as MusicPhrase).season,
      zone: isAmbient ? undefined : (track.phrase as MusicPhrase).zone,
      tension: isAmbient ? undefined : (track.phrase as MusicPhrase).tension,
      bars: isAmbient ? undefined : (track.phrase as MusicPhrase).bars,
      durationSeconds: isAmbient ? (track.phrase as AmbientPhrase).durationSeconds : undefined,
      bpm: (track.phrase as { bpm: number }).bpm,
      checksum,
      license: 'MIT',
      source: track.note,
      generated_by: isAmbient
        ? 'generateAmbientPhrase (Eno/Reich/Sparse systems-music) → renderAmbientToFloat32 → ffmpeg loudnorm/libvorbis'
        : 'generatePhrase (Markov + grammar) → renderPhraseToFloat32 → ffmpeg loudnorm/libvorbis',
      commissioned: false,
      suno_udio: false
    });

    manifestEntries.push({
      id: track.id,
      path: cleanRel,
      type: 'ogg',
      checksum,
      license: 'MIT',
      source: `程序化生成（${track.note} seed=${track.seedLabel}；ffmpeg loudnorm；零委约、避 Suno/Udio）`,
      ai_disclosed: false
    });

    console.log(`✓ ${track.id} → ${cleanRel} (${checksum.slice(0, 12)}…, ${totalSec.toFixed(1)}s)`);
  }

  const artifactsDir = resolve(projectRoot, '.omc/artifacts');
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(resolve(artifactsDir, 'audio-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
  writeFileSync(resolve(artifactsDir, 'audio-manifest-entries.json'), `${JSON.stringify(manifestEntries, null, 2)}\n`);
  console.log(`\nprovenance → .omc/artifacts/audio-provenance.json`);
  console.log(`manifest entries → .omc/artifacts/audio-manifest-entries.json${updateManifest ? '（已写入 assets/manifest.json）' : '（未自动改 manifest，按需粘贴；加 --update-manifest 可自动追加）'}`);
  if (includeV2) console.log(`v2 ambient stems included (--v2-stems): ${buildAmbientV2Tracks().length} additional tracks`);

  if (updateManifest) {
    const manifestPath = resolve(projectRoot, 'assets/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { audio?: { id: string }[] };
    const existingIds = new Set((manifest.audio ?? []).map(e => e.id));
    const merged = [...(manifest.audio ?? []), ...manifestEntries.filter(e => !existingIds.has((e as { id: string }).id))] as { id: string }[];
    manifest.audio = merged;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 1)}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
