#!/usr/bin/env node
/**
 * 角色精灵 AI 生成（docs/13 §1.1「手绘」类，经用户授权用 AI + 多重审核放行）。
 *
 * 用法：
 *   CG_API_KEY=sk-... node tools/gen-sprite.mjs <sprite-id>
 *
 * 经济原则（用户指令：prompt 精准、付费 API 杜绝浪费）：
 * - 单次只生成一个 id，便于先测后批量。
 * - prompt 采用调研结论的模板：16-bit 游戏精灵、单角色、透明背景、16 色限定、
 *   扁平 cel 阴影、清晰深色轮廓，并把所有"避免项"正向内嵌（gpt-image-2 无负面词字段）。
 * - 1024×1024 原生生成，再由 tools/review-ai-art.py quantize 降采样+量化（LANCZOS+Lab，不抖动）。
 *
 * 密钥只从 CG_API_KEY 读，不入库。产出 1024 图到 /tmp/sprite-<id>.png（不入库；入库的是量化后小图）。
 */
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const KEY = process.env.CG_API_KEY;
const BASE = process.env.CG_API_BASE ?? 'https://fast.qianxing.us.ci/v1';
const MODEL = process.env.CG_MODEL ?? 'gpt-image-2';
if (!KEY) {
  console.error('请设置 CG_API_KEY');
  process.exit(1);
}

const TAIL =
  ', full-body centered, single character, 16-color limited palette, flat cel shading, ' +
  'clean dark outline, no anti-aliasing, no gradient, no blur, no photorealistic, ' +
  'no cast shadow, no ground shadow, no background scenery, no mixels, ' +
  'transparent background, 16-bit RPG game sprite style, simple clean shapes, minimal detail';

const SPRITES = {
  player: 'Pixel art game sprite, a young Chinese mortal body-cultivator (体修) in simple coarse hemp robes, ' +
    'determined calm expression, lean toned build, standing facing forward, fists at sides' + TAIL,
  'npc.wandering-cultivator': 'Pixel art game sprite, a wandering Daoist cultivator in flowing dark travel robes ' +
    'with a bamboo hat, short beard, holding a wooden walking staff' + TAIL,
  'npc.herb-gatherer': 'Pixel art game sprite, a young Chinese village herb-gatherer girl in a simple green tunic, ' +
    'braided hair, carrying a woven basket of herbs on her back' + TAIL,
  'npc.array-smith': 'Pixel art game sprite, a stocky old craftsman array-smith in a leather apron, ' +
    'gray beard, goggles on forehead, holding a rune-inscribed bronze compass' + TAIL,
  'guard-beast': 'Pixel art game sprite, a small sturdy guardian beast, a hybrid of boar and badger ' +
    'with jade-green crystal spikes along its back, quadruped side view facing right' + TAIL,
};

const id = process.argv[2];
const prompt = SPRITES[id];
if (!prompt) {
  console.error('未知 sprite id。可选：' + Object.keys(SPRITES).join(', '));
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen(prompt) {
  const body = JSON.stringify({ model: MODEL, prompt });
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 180000);
    try {
      const r = await fetch(`${BASE}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body, signal: ctrl.signal,
      });
      const j = await r.json().catch(() => ({}));
      clearTimeout(to);
      if (!r.ok) {
        console.error(`尝试 ${attempt} HTTP ${r.status}: ${(j?.error?.message ?? JSON.stringify(j)).slice(0, 140)}`);
        await sleep(4000 * attempt); continue;
      }
      const item = j?.data?.[0];
      const b64Json = typeof item?.b64_json === 'string' && item.b64_json ? item.b64_json : null;
      const dataUrl = typeof item?.url === 'string' && item.url.startsWith('data:') ? item.url : null;
      const b64 = b64Json ?? (dataUrl ? dataUrl.split(',', 2)[1] : null);
      if (!b64) { console.error(`尝试 ${attempt}: 无图像数据`); await sleep(3000); continue; }
      return Buffer.from(b64, 'base64');
    } catch (e) {
      clearTimeout(to); console.error(`尝试 ${attempt} 异常: ${e.message}`); await sleep(4000 * attempt);
    }
  }
  return null;
}

const buf = await gen(prompt);
if (!buf) { console.error(`生成失败：${id}`); process.exit(2); }
const out = `/tmp/sprite-${id.replace(/[.]/g, '-')}.png`;
writeFileSync(out, buf);
console.log(JSON.stringify({ id, out, kb: Math.round(buf.length / 1024), sha256: createHash('sha256').update(buf).digest('hex') }));
