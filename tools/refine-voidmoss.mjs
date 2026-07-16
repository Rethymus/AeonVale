/**
  * 绝灵苔(herb.voidmoss)AI 精修 —— 单 id、voidmoss 专属 prompt。
  * 复用 refine-herb-icons.mjs 的 /images/edits 契约(与现有 24 张灵草图标同管线=风格一致)。
  * 用法: CG_API_KEY=sk-... node node_modules/tsx/dist/cli.mjs tools/refine-voidmoss.mjs
  * 输入 /tmp/vm-herb-base-256.png → 输出 /tmp/vm-herb-refined.png (1024, 待 quantize)
  * 密钥只走环境变量,不入库。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const KEY = process.env.CG_API_KEY;
const BASE = process.env.CG_API_BASE ?? 'https://fast.qianxing.us.ci/v1';
const MODEL = process.env.CG_MODEL ?? 'gpt-image-2';
if (!KEY) { console.error('请设置 CG_API_KEY'); process.exit(1); }

const IN = '/tmp/vm-herb-base-256.png';
const OUT = '/tmp/vm-herb-refined.png';

// voidmoss 专属:苍白灰白空苔,刻意区别于 voidmantle(极寒霜蓝)。
const PROMPT =
 'Enhance this pixel art herb sprite: keep the EXACT shape, silhouette and composition. ' +
 'Subject: Voidmoss (绝灵苔) — a pale ash-gray lichen growing in a spiritless void; colorless ' +
 'translucent gray-white fronds, desaturated bone-ash tones, cracked pale surface like petrified moss. ' +
 'CRITICAL: must be pale gray/ash/white, NO green, NO blue, NO frost glow, NO flowers, NO berries — ' +
 'it is a plant of emptiness, the visual antithesis of lush qi herbs. ' +
 'Add bold cel shading and chunky highlights in ash-gray tones, refine the lichen form, ' +
 '16-color limited palette, hard pixel edges, single top-left light source, ' +
 'no anti-aliasing, no gradient, no fine texture, no background scenery, ' +
 'transparent background, 16-bit RPG herb item icon, matte hand-drawn aesthetic';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function refine {
 const buf = readFileSync(IN);
 for (let attempt = 1; attempt <= 4; attempt++) {
 const ctrl = new AbortController();
 const to = setTimeout(() => ctrl.abort, 180000);
 try {
 const fd = new FormData();
 fd.append('model', MODEL);
 fd.append('prompt', PROMPT);
 fd.append('image', new Blob([buf]), 'herb.voidmoss.png');
 fd.append('size', '1024x1024');
 const r = await fetch(`${BASE}/images/edits`, {
 method: 'POST',
 headers: { Authorization: `Bearer ${KEY}` },
 body: fd,
 signal: ctrl.signal,
 });
 const j = await r.json.catch(() => ({}));
 clearTimeout(to);
 if (!r.ok) {
 const msg = j?.error?.message ?? JSON.stringify(j);
 const retryable = /^(408|429|500|502|503|504)/.test(String(r.status));
 console.error(` 尝试 ${attempt} HTTP ${r.status}: ${String(msg).slice(0,160)} (retryable=${retryable})`);
 if (!retryable) { console.error(' 不可重试错误,终止以省 token'); return null; }
 await sleep(4000 * attempt); continue;
 }
 const item = j?.data?.[0];
 const b64 = typeof item?.b64_json === 'string' && item.b64_json ? item.b64_json
 : (typeof item?.url === 'string' && item.url.startsWith('data:') ? item.url.split(',', 2)[1] : null);
 if (!b64) { console.error(` 尝试 ${attempt}: 无图像数据`); await sleep(3000); continue; }
 return Buffer.from(b64, 'base64');
 } catch (e) {
 clearTimeout(to); console.error(` 尝试 ${attempt} 异常: ${e.message}`); await sleep(4000 * attempt);
 }
 }
 return null;
}

const out = await refine;
if (!out) { console.error('FAIL: voidmoss refine 未产出'); process.exit(2); }
writeFileSync(OUT, out);
console.log(`OK 写出 ${OUT} (${(out.length / 1024).toFixed(0)}KB)`);
