#!/usr/bin/env node
/**
 * 字体子集化（docs/13 §5.3）：把完整 CJK 字体裁剪到游戏实际用字 → woff2，压到 ~数百 KB。
 *
 * 用法：
 *   SRC_FONT=/tmp/lxgw-regular.ttf node tools/subset-font.mjs
 *
 * 依赖：pyftsubset（pip install fonttools；本机 miniconda 已带）。
 * 重新生成时机：src 下文本新增字符后重跑，避免缺字（豆腐块）。
 * 完整字体不入库（本脚本默认从环境变量 SRC_FONT 指定的临时路径读取）。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_FONT = process.env.SRC_FONT;
const OUT_DIR = join(ROOT, 'assets/fonts');
const OUT_FILE = join(OUT_DIR, 'lxgw-wenkai-regular.subset.woff2');

if (!SRC_FONT || !existsSync(SRC_FONT)) {
  console.error('请用 SRC_FONT=<完整 ttf 路径> 指定源字体，例如 SRC_FONT=/tmp/lxgw-regular.ttf');
  process.exit(1);
}

// 1) 递归收集 src 下 .ts/.tsx/.json 文本字符（含未提交内容，均已在磁盘）。
function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|json)$/.test(name)) acc.push(p);
  }
  return acc;
}

const files = walk(join(ROOT, 'src'), []);
const text = files.map((f) => readFileSync(f, 'utf-8')).join('');

// 2) 码点集合：游戏文本 + 安全底（ASCII + CJK 标点 + 全角符号）。
const cps = new Set();
const addRange = (a, b) => { for (let c = a; c <= b; c++) cps.add(c); };
addRange(0x20, 0x7e); // ASCII 可见字符
addRange(0x3000, 0x303f); // CJK 符号与标点
addRange(0xff00, 0xffef); // 全角形式
for (const ch of text) cps.add(ch.codePointAt(0));

const unicodes = [...cps]
  .sort((a, b) => a - b)
  .map((n) => `U+${n.toString(16)}`)
  .join(',');

// 3) pyftsubset → woff2。
execFileSync('pyftsubset', [SRC_FONT, `--unicodes=${unicodes}`, '--flavor=woff2', `--output-file=${OUT_FILE}`], {
  stdio: 'inherit',
});

// 4) 报告 sha256（供 assets/manifest.json checksum 用）+ 体积。
const buf = readFileSync(OUT_FILE);
const sha = createHash('sha256').update(buf).digest('hex');
console.log(`\nOK: ${OUT_FILE}`);
console.log(`  size: ${(buf.length / 1024).toFixed(1)} KB`);
console.log(`  sha256: ${sha}`);
console.log(`  glyphs(codepoints): ${cps.size}`);
