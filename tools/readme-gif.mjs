#!/usr/bin/env node
// 将 README 预告用的签名 GIF 从捕获的 PNG 帧序列编码出来。
// 输入：assets/screenshots/_frames/<moment>/frame-0001.png ...（4 位序号、1 起）
// 输出：assets/screenshots/<moment>.gif
// 依赖：PATH 上的 ffmpeg（仓库环境为 /usr/sbin/ffmpeg n8.0.1）。
// 调参（环境变量）：README_GIF_FPS（默认 18）、README_GIF_WIDTH（默认 720）、README_GIF_COLORS（默认 128）。
import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const FRAMES_DIR = join(ROOT, 'assets', 'screenshots', '_frames');
const OUT_DIR = join(ROOT, 'assets', 'screenshots');
const FPS = Number(process.env.README_GIF_FPS ?? 18);
const WIDTH = Number(process.env.README_GIF_WIDTH ?? 720);
const COLORS = Number(process.env.README_GIF_COLORS ?? 128);

function runFfmpeg(args) {
  const result = spawnSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    const tail = (result.stderr?.toString() ?? '').split('\n').slice(-10).join('\n');
    throw new Error(`ffmpeg 退出码 ${result.status}\n${tail}`);
  }
}

async function encodeMoment(dir) {
  const name = basename(dir);
  const files = (await readdir(dir)).filter((f) => /^frame-\d{4}\.png$/.test(f)).sort();
  if (files.length < 2) {
    console.warn(`[readme-gif] 跳过 ${name}：仅 ${files.length} 帧（需 ≥2）`);
    return null;
  }
  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, `${name}.gif`);
  // 先生成专属调色板，再用 paletteuse 抖动贴合，lanczos 缩放保锐度。
  const videoFilter =
    `fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[s0][s1];` +
    `[s0]palettegen=max_colors=${COLORS}[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`;
  runFfmpeg([
    '-y',
    '-framerate',
    String(FPS),
    '-i',
    join(dir, 'frame-%04d.png'),
    '-vf',
    videoFilter,
    '-loop',
    '0',
    outPath
  ]);
  const size = (await stat(outPath)).size;
  console.log(`[readme-gif] ✓ ${name}.gif （${files.length} 帧，${(size / 1024).toFixed(0)} KB）`);
  return outPath;
}

async function main() {
  if (!existsSync(FRAMES_DIR)) {
    console.error(`[readme-gif] 找不到帧目录：${FRAMES_DIR}（先跑 pnpm readme:capture）`);
    process.exit(1);
  }
  const entries = await readdir(FRAMES_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => join(FRAMES_DIR, e.name))
    .sort();
  if (dirs.length === 0) {
    console.error('[readme-gif] _frames/ 下没有时刻子目录');
    process.exit(1);
  }
  const encoded = [];
  for (const dir of dirs) {
    const result = await encodeMoment(dir).catch((error) => {
      console.error(`[readme-gif] ✗ ${basename(dir)} 失败：${error.message}`);
      return null;
    });
    if (result) encoded.push(result);
  }
  console.log(`[readme-gif] 完成 ${encoded.length}/${dirs.length} 个 GIF → ${OUT_DIR}`);
  if (encoded.length === 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
