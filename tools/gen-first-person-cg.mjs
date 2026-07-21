#!/usr/bin/env node
/**
 * 灵韵叙录 · 第一人称 CG 占位图生成器（docs/22 §12 / docs/23 §6 占位先行）。
 *
 * 用途：为 narration 层生成「纯色水墨风占位 + 内嵌场景名」的 PNG，落 assets/cg/first-person/，
 * 并打印 manifest 条目（含真实 sha256）供 assets/manifest.json 登记。Wave 3 起由
 * tools/ 离线 AI 产线（gen-cg.mjs 范式）替换为人审精修正图；本占位不阻塞代码与 typecheck。
 *
 * 合规红线（docs/23 §0/§6）：
 *  - 纯 Node stdlib（crypto/zlib/fs），离线、无网络、无 AI 模型调用。
 *  - 产出条目走 manifest：license:'AI-Generated'(占位归属该桶，等待正图) + ai_disclosed:true + status:'draft'。
 *  - 真实 sha256：占位字节真实可校验（Wave 4 governance manifest 完整性门禁启用后直接可过）。
 *  - 幂等：重跑覆盖同名文件（占位阶段允许；正图阶段禁原地覆盖，由 gen-cg.mjs 的 -vN 接管）。
 *
 * 用法：node tools/gen-first-person-cg.mjs [--write-manifest-paths]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash, randomUUID } from 'node:crypto';

const OUT_DIR = resolve(import.meta.dirname, '..', 'assets', 'cg', 'first-person');
mkdirSync(OUT_DIR, { recursive: true });

// —— 5x7 位图字体（仅占位可见拉丁标签用；中文场景名走 iTXt 元数据嵌入） ——
// 每个字形 = 7 行 x 5 列，'.' = 空 '#' = 笔画。运行时断言列宽，typo 即失败。
const FONT = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  A: ['.###.', '#...#', '#####', '#...#', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '#####', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '....#', '....#', '....#', '....#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '#....', '####.', '....#', '....#', '####.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.']
};

for (const [glyph, rows] of Object.entries(FONT)) {
  if (rows.length !== 7 || rows.some(row => row.length !== 5)) {
    throw new Error(`字体字形 ${glyph} 非 5x7：${JSON.stringify(rows)}`);
  }
}

// —— 场景定义：manifest id / 文件名 / 可见拉丁标签 / iTXt 中文场景名 / 水墨底色 / 前景字色 ——
const SCENES = [
  { id: 'cg.first-person.prologue.valley-v1', file: 'prologue-valley-v1.png', label: 'PROLOGUE - VALLEY', name: '序章·永恒山谷', bg: [42, 59, 50], fg: [216, 201, 163] },
  { id: 'cg.first-person.prologue.village-v1', file: 'prologue-village-v1.png', label: 'PROLOGUE - VILLAGE', name: '序章·荒村', bg: [74, 64, 54], fg: [232, 220, 192] },
  { id: 'cg.first-person.prologue.sect-v1', file: 'prologue-sect-v1.png', label: 'PROLOGUE - TAIYI SECT', name: '序章·太一宗', bg: [50, 66, 77], fg: [212, 200, 170] },
  { id: 'cg.first-person.act1.storage-ring-v1', file: 'act1-storage-ring-v1.png', label: 'ACT 1 - STORAGE RING', name: '第一幕·储物戒', bg: [58, 53, 48], fg: [207, 196, 168] },
  { id: 'cg.first-person.act1.script-v1', file: 'act1-script-v1.png', label: 'ACT 1 - STEAL HEAVEN SCROLL', name: '第一幕·偷天换劫诀', bg: [43, 42, 38], fg: [184, 163, 106] },
  { id: 'cg.first-person.tribulation.purple-v1', file: 'tribulation-purple-v1.png', label: 'TRIBULATION - PURPLE THUNDER', name: '终局·紫雷劫', bg: [42, 36, 56], fg: [185, 163, 216] },
  { id: 'cg.first-person.ending.e0-mushroom-v1', file: 'ending-e0-mushroom-v1.png', label: 'ENDING - E0 RED MUSHROOM', name: '结局·红伞白杆', bg: [58, 31, 34], fg: [216, 163, 154] },
  { id: 'cg.first-person.ending.ascension-v1', file: 'ending-ascension-v1.png', label: 'ENDING - ASCENSION', name: '结局·飞升', bg: [74, 58, 31], fg: [232, 207, 138] },
  { id: 'cg.first-person.ending.poison-death-v1', file: 'ending-poison-death-v1.png', label: 'ENDING - POISON DEATH', name: '结局·丹毒亡', bg: [45, 58, 31], fg: [194, 216, 138] },
  { id: 'cg.first-person.ending.tribulation-death-v1', file: 'ending-tribulation-death-v1.png', label: 'ENDING - TRIBULATION DEATH', name: '结局·陨于天劫', bg: [31, 36, 56], fg: [163, 174, 216] },
  { id: 'cg.first-person.ending.madness-v1', file: 'ending-madness-v1.png', label: 'ENDING - MADNESS', name: '结局·走火入魔', bg: [58, 31, 56], fg: [216, 163, 207] },
  { id: 'cg.first-person.ending.lifespan-death-v1', file: 'ending-lifespan-death-v1.png', label: 'ENDING - LIFESPAN DEATH', name: '结局·寿终落叶异乡', bg: [61, 44, 28], fg: [216, 184, 138] },
  { id: 'cg.first-person.ending.e6-sacrifice-v1', file: 'ending-e6-sacrifice-v1.png', label: 'ENDING - E6 SACRIFICE', name: '结局·还汝自由', bg: [74, 48, 16], fg: [232, 184, 120] },
  { id: 'cg.first-person.ending.e7-usurp-v1', file: 'ending-e7-usurp-v1.png', label: 'ENDING - E7 USURPATION', name: '结局·新天', bg: [32, 36, 42], fg: [159, 176, 192] }
];

// —— PNG 编码（纯 stdlib：CRC32 + zlib.deflateSync） ——
const WIDTH = 640;
const HEIGHT = 360;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'latin1');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function buildPng(scene) {
  // 像素缓冲：RGB，先填底色。
  const pixels = new Uint8Array(WIDTH * HEIGHT * 3);
  for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
    pixels[i * 3] = scene.bg[0];
    pixels[i * 3 + 1] = scene.bg[1];
    pixels[i * 3 + 2] = scene.bg[2];
  }

  // 可见标签：按 5x7 字形放大 S 倍，水平居中、垂直偏上 1/3。
  const label = scene.label;
  const glyphW = 5;
  const glyphH = 7;
  const advance = 6; // 5 列 + 1 列间隔
  const maxScale = Math.max(1, Math.floor((WIDTH * 0.9) / (label.length * advance)));
  const scale = Math.min(5, Math.max(2, maxScale));
  const totalW = label.length * advance * scale - scale; // 末字无尾随间隔
  const totalH = glyphH * scale;
  const originX = Math.floor((WIDTH - totalW) / 2);
  const originY = Math.floor(HEIGHT * 0.36);
  for (let ci = 0; ci < label.length; ci += 1) {
    const ch = label[ci];
    const rows = FONT[ch] ?? FONT[' '];
    for (let r = 0; r < glyphH; r += 1) {
      for (let c = 0; c < glyphW; c += 1) {
        if (rows[r][c] === '#') {
          // 填充 (scale x scale) 块。
          for (let dy = 0; dy < scale; dy += 1) {
            for (let dx = 0; dx < scale; dx += 1) {
              const px = originX + ci * advance * scale + c * scale + dx;
              const py = originY + r * scale + dy;
              if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) continue;
              const idx = (py * WIDTH + px) * 3;
              pixels[idx] = scene.fg[0];
              pixels[idx + 1] = scene.fg[1];
              pixels[idx + 2] = scene.fg[2];
            }
          }
        }
      }
    }
  }

  // 滤波扫描线：每行前缀 filter=0（None）。
  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    raw[y * (WIDTH * 3 + 1)] = 0;
    pixels.subarray(y * WIDTH * 3, (y + 1) * WIDTH * 3).forEach((b, i) => {
      raw[y * (WIDTH * 3 + 1) + 1 + i] = b;
    });
  }
  const idat = deflateSync(raw);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // iTXt：UTF-8 中文场景名（PNG 规范的国际化文本块，"内嵌场景名文字"）。
  const keyword = Buffer.from('SceneName', 'latin1');
  const text = Buffer.from(scene.name, 'utf8');
  const itxtData = Buffer.concat([
    keyword,
    Buffer.from([0]), // keyword null separator
    Buffer.from([0]), // compression flag (0 = uncompressed)
    Buffer.from([0]), // compression method
    Buffer.from('', 'latin1'), // language tag (empty)
    Buffer.from('', 'utf8'), // translated keyword (empty)
    Buffer.from([0]), // null separator before text
    text
  ]);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('iTXt', itxtData),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

const manifestEntries = [];
for (const scene of SCENES) {
  const png = buildPng(scene);
  const outPath = resolve(OUT_DIR, scene.file);
  writeFileSync(outPath, png);
  const sha256 = createHash('sha256').update(png).digest('hex');
  manifestEntries.push({
    id: scene.id,
    path: `cg/first-person/${scene.file}`,
    type: 'png',
    checksum: sha256,
    license: 'AI-Generated',
    source: `placeholder; 灵韵叙录第一人称 CG 占位（${scene.name}）；pending offline generation via tools/gen-cg.mjs; user-authorized project asset`,
    human_edits: [],
    ai_disclosed: true,
    status: 'draft',
    src: {
      model: 'placeholder',
      endpoint: 'placeholder',
      prompt: 'placeholder',
      seed: null,
      master_ref: [],
      ref_imgs: [],
      generated_at: '2026-07-21T00:00:00.000+08:00'
    }
  });
}

// 美观打印 manifest 条目 + 随附一个 nonce 仅用于人工核对脚本跑通（不入库）。
const nonce = randomUUID();
console.log(JSON.stringify({ generated: manifestEntries.length, nonce, entries: manifestEntries }, null, 2));
