#!/usr/bin/env node
/**
 * 灵草图标 AI 精修（程序化底图 → gpt-image-2 /images/edits img2img → 待重新量化）。
 *
 * 用户策略：烘焙程序化为基底 + AI 精修细化 + AI 审核 + 重新量化，统一风格。
 * 调研结论：gpt-image-2 支持多模态 /images/edits；AI 只加"大尺度结构(bold shading/chunky)"，
 * 细纹理必被后续量化抹掉；精修后必须重新量化到 16 色去 AI 味。
 *
 * 用法：CG_API_KEY=sk-... node tools/refine-herb-icons.mjs
 * 输入：/tmp/herb-bake-256/*.png（烘焙灵草放大 256）
 * 输出：/tmp/herb-refined/*.png（1024 精修稿，待 review-ai-art.py 量化到 32）
 * 密钥只走环境变量，不入库。
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY = process.env.CG_API_KEY;
const BASE = process.env.CG_API_BASE ?? 'https://fast.qianxing.us.ci/v1';
const MODEL = process.env.CG_MODEL ?? 'gpt-image-2';
if (!KEY) {
  console.error('请设置 CG_API_KEY');
  process.exit(1);
}

const IN = process.env.CG_IN ?? '/tmp/herb-bake-256';
const OUT = '/tmp/herb-refined';
mkdirSync(OUT, { recursive: true });

// 调研 §4.5：只加大尺度结构，禁细纹理（细纹理会被量化抹掉）
const PROMPT = 'Enhance this pixel art herb sprite: keep the exact shape and composition, ' + 'add bold cel shading and chunky highlights, refine the leaf and flower forms, ' + '16-color limited palette, hard pixel edges, single top-left light source, ' + 'no anti-aliasing, no gradient, no fine texture, no background scenery, ' + 'transparent background, 16-bit RPG herb item icon, matte hand-drawn aesthetic';

const files = readdirSync(IN).filter(f => f.endsWith('.png'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function refine(file) {
  const buf = readFileSync(resolve(IN, file));
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort, 180000);
    try {
      const fd = new FormData();
      fd.append('model', MODEL);
      fd.append('prompt', PROMPT);
      fd.append('image', new Blob([buf]), file);
      fd.append('size', '1024x1024');
      const r = await fetch(`${BASE}/images/edits`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}` },
        body: fd,
        signal: ctrl.signal
      });
      const j = await r.json.catch(() => ({}));
      clearTimeout(to);
      if (!r.ok) {
        console.error(` 尝试 ${attempt} HTTP ${r.status}: ${(j?.error?.message ?? JSON.stringify(j)).slice(0, 140)}`);
        await sleep(4000 * attempt);
        continue;
      }
      const item = j?.data?.[0];
      const b64Json = typeof item?.b64_json === 'string' && item.b64_json ? item.b64_json : null;
      const dataUrl = typeof item?.url === 'string' && item.url.startsWith('data:') ? item.url : null;
      const b64 = b64Json ?? (dataUrl ? dataUrl.split(',', 2)[1] : null);
      if (!b64) {
        console.error(` 尝试 ${attempt}: 无图像数据`);
        await sleep(3000);
        continue;
      }
      return Buffer.from(b64, 'base64');
    } catch (e) {
      clearTimeout(to);
      console.error(` 尝试 ${attempt} 异常: ${e.message}`);
      await sleep(4000 * attempt);
    }
  }
  return null;
}

let ok = 0;
for (const f of files) {
  console.log(`精修 ${f} ...`);
  const buf = await refine(f);
  if (!buf) {
    console.error(` FAIL ${f}`);
    continue;
  }
  writeFileSync(resolve(OUT, f), buf);
  ok++;
  console.log(` OK ${(buf.length / 1024).toFixed(0)}KB`);
}
console.log(`refined ${ok}/${files.length}`);
