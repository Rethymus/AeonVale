/**
  * 项目 Logo 徽记生成：符号与文字分层，文字使用真实字体叠加。
  * 用法: CG_API_KEY=sk-... node node_modules/tsx/dist/cli.mjs tools/gen-logo.mjs
  * 复用 gen-cg.mjs 的 /images/generations 最小 body 契约（中转站 size/n 会 500）。
  * 产出 /tmp/logo-emblem-raw.png（1024，待去背景+裁切；文字由 PIL + 真字体另行叠加）。
  * 密钥只走环境变量，不入库。
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const KEY = process.env.CG_API_KEY;
const BASE = process.env.CG_API_BASE ?? 'https://fast.qianxing.us.ci/v1';
const MODEL = process.env.CG_MODEL ?? 'gpt-image-2';
if (!KEY) { console.error('请设置 CG_API_KEY'); process.exit(1); }

// 主题：种灵草→引天劫→淬体（核心循环）。双色调（墨黑 + 灵金），64px 可读，无文字。
const PROMPT =
 'Emblem logo for an indie xianxia cultivation game, circular talisman composition. ' +
 'Center subject: a single luminous spirit-herb sprouting from tilled furrowed soil, ' +
 'a jagged vertical lightning bolt descending from above to strike the herb\'s tip — ' +
 'capturing "farm spirit herbs, invoke heavenly lightning, temper the mortal body". ' +
 'Style: traditional Chinese sumi-e ink brush textures on the critical curves (soil, bolt, ring) ' +
 'fused with crisp 16-bit pixel-art clusters elsewhere; matte flat finish; ' +
 'strict two-color palette only: deep ink-black (#1A1028) and spirit-gold (#E8D5A3) on empty void; ' +
 'a rough hand-painted circular ink ring frames the emblem; vast negative space (留白); ' +
 'strong high-contrast silhouette fully readable at 64x64 pixels; centered, symmetric, iconic, ' +
 'no text, no letters, no watermark, no signature, no border frame, transparent background.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gen {
 const body = JSON.stringify({ model: MODEL, prompt: PROMPT });
 for (let attempt = 1; attempt <= 4; attempt++) {
 const ctrl = new AbortController();
 const to = setTimeout(() => ctrl.abort, 180000);
 try {
 const r = await fetch(`${BASE}/images/generations`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
 body, signal: ctrl.signal,
 });
 const j = await r.json.catch(() => ({}));
 clearTimeout(to);
 if (!r.ok) {
 const msg = j?.error?.message ?? JSON.stringify(j);
 const retryable = /^(408|429|500|502|503|504)/.test(String(r.status));
 console.error(`尝试 ${attempt} HTTP ${r.status}: ${String(msg).slice(0,160)} (retryable=${retryable})`);
 if (!retryable) { console.error('不可重试错误，终止以省 token'); return null; }
 await sleep(4000 * attempt); continue;
 }
 const item = j?.data?.[0];
 const b64 = typeof item?.b64_json === 'string' && item.b64_json ? item.b64_json
 : (typeof item?.url === 'string' && item.url.startsWith('data:') ? item.url.split(',', 2)[1] : null);
 if (!b64) { console.error(`尝试 ${attempt}: 无图像数据`); await sleep(3000); continue; }
 return Buffer.from(b64, 'base64');
 } catch (e) {
 clearTimeout(to); console.error(`尝试 ${attempt} 异常: ${e.message}`); await sleep(4000 * attempt);
 }
 }
 return null;
}

const out = await gen;
if (!out) { console.error('FAIL: logo emblem 未产出'); process.exit(2); }
mkdirSync('assets/logo', { recursive: true });
writeFileSync('/tmp/logo-emblem-raw.png', out);
console.log(`OK 写出 /tmp/logo-emblem-raw.png (${(out.length / 1024).toFixed(0)}KB)`);
