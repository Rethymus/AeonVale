#!/usr/bin/env node
/**
 * 结局 CG 生成。
 *
 * 用法：
 * CG_API_KEY=sk-... node tools/gen-cg.mjs
 * # 可选：CG_API_BASE=https://.../v1 覆盖端点
 *
 * 安全：密钥只从环境变量读，绝不写死、不入库（CONTRIBUTING 禁止提交密钥）。
 * 模型 gpt-image-2；实测该中转站对 body 里带 size/n 会 500，故用最小 body。
 * 产出 PNG 写 assets/cg/，并打印 sha256 供 assets/manifest.json 登记。
 *
 * 重跑幂等：覆盖同名文件；manifest 需按新 sha256 更新。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const KEY = process.env.CG_API_KEY;
const BASE = process.env.CG_API_BASE ?? 'https://fast.qianxing.us.ci/v1';
const MODEL = process.env.CG_MODEL ?? 'gpt-image-2';
if (!KEY) {
  console.error('请设置 CG_API_KEY（密钥不入库，仅环境变量）');
  process.exit(1);
}

const OUT = process.env.CG_OUT ? resolve(process.env.CG_OUT) : resolve(import.meta.dirname, '..', 'assets', 'cg');
mkdirSync(OUT, { recursive: true });

const STYLE = 'Authentic traditional Chinese sumi-e ink wash painting (水墨画/文人画), hand-painted with ' + 'visible brush strokes and ink gradation, rough xuan (rice) paper grain texture, vast empty ' + 'negative space (计白当黑/留白), monochrome ink tones with only sparse cinnabar-red and pale gold ' + 'accents, calligraphic spontaneous brushwork, matte flat finish, crude amateur literati painter, ' + 'no smooth gradient, no bloom, no glow, no sheen, no plastic, no digital painting, no airbrush, ' + 'no cinematic lighting, no volumetric light, no 3D render, no photorealism, no over-detail, ' + 'no text, no signature, no watermark';

/** 与代码 ending 对齐：src 中 'ascension' / 'lifespan-death' / 'poison-death'。 */
const CGS = [
  {
    id: 'cg.act1.duel-v1',
    prompt:
      `Two distant cultivators fighting above a humble mountain-valley farm, lightning and sword-light tearing the sky while an ordinary young farmer stands tiny and powerless in the field below, the first shock that breaks his mortal life. ${STYLE}`
  },
  {
    id: 'cg.act1.relic-v1',
    prompt:
      `After an immortal duel, an ordinary young farmer kneels in a ruined field and discovers a blackened storage ring and broken jade token among grey tribulation ash, grief turning into dangerous hope. ${STYLE}`
  },
  {
    id: 'cg.act1.scroll-v1',
    prompt:
      `Inside a half-ruined mountain hut at night, an ordinary young farmer holds a blackened cultivation scroll glowing with contained lightning, fear becoming resolve as he chooses to draw thunder into his body to repair the empty spirit root that cannot retain qi. ${STYLE}`
  },
  {
    id: 'cg.ending-ascension',
    prompt: `A lone cultivator in flowing white robes ascending upward through swirling celestial clouds, beams of warm golden light breaking through, transcendent and serene. ${STYLE}`
  },
  {
    id: 'cg.ending-lifespan-death',
    prompt: `An aged mortal farmer sitting alone in a withered autumn field at dusk, fallen leaves, a low setting sun, quiet melancholy of a lifespan spent. ${STYLE}`
  },
  {
    id: 'cg.ending-poison-death',
    prompt: `A shattered alchemy furnace leaking dark toxic smoke, a fallen figure, cracked pills scattering, ominous and tragic, dynamic ink splashes. ${STYLE}`
  }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function genOne(prompt) {
  const body = JSON.stringify({ model: MODEL, prompt });
  for (let attempt = 1; attempt <= 4; attempt++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 180000);
    try {
      const r = await fetch(`${BASE}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal
      });
      const j = await r.json().catch(() => ({}));
      clearTimeout(to);
      if (!r.ok) {
        console.error(` 尝试 ${attempt} HTTP ${r.status}: ${(j?.error?.message ?? JSON.stringify(j)).slice(0, 140)}`);
        await sleep(4000 * attempt);
        continue;
      }
      const item = j?.data?.[0];
      // 中转站格式不稳：有时 data[0].url=data:image/png;base64,...，有时 url="" 而图在 b64_json。
      // 优先取非空 b64_json，否则解析 data: URL。
      const b64Json = typeof item?.b64_json === 'string' && item.b64_json ? item.b64_json : null;
      const dataUrl = typeof item?.url === 'string' && item.url.startsWith('data:') ? item.url : null;
      const b64 = b64Json ?? (dataUrl ? dataUrl.split(',', 2)[1] : null);
      if (!b64) {
        console.error(` 尝试 ${attempt}: 响应无图像数据`);
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

const ONLY = process.argv[2];
const LIST = ONLY ? CGS.filter(c => c.id === ONLY) : CGS;
if (ONLY && !LIST.length) {
  console.error('未知 cg id：' + CGS.map(c => c.id).join(', '));
  process.exit(1);
}
const results = [];
for (const cg of LIST) {
  console.log(`生成 ${cg.id} ...`);
  const buf = await genOne(cg.prompt);
  if (!buf) {
    console.error(` 失败：${cg.id}`);
    results.push({ ...cg, ok: false });
    continue;
  }
  const file = resolve(OUT, `${cg.id}.png`);
  writeFileSync(file, buf);
  const sha = createHash('sha256').update(buf).digest('hex');
  console.log(` OK ${(buf.length / 1024).toFixed(0)}KB sha256=${sha}`);
  results.push({ ...cg, ok: true, file: `assets/cg/${cg.id}.png`, sha, kb: Math.round(buf.length / 1024) });
}

console.log('\n=== 汇总（粘贴进 manifest 的 sprites/cg 条目）===');
for (const r of results) {
  if (r.ok) {
    console.log(JSON.stringify({ id: r.id, path: r.file.replace(/^assets\//, ''), type: 'png', checksum: r.sha, license: 'AI-Generated', source: `gpt-image-2 via relay; prompt: ${r.prompt.slice(0, 60)}…` }, null, 0));
  }
}
const failed = results.filter(r => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} 个失败：${failed.map(r => r.id).join(', ')}`);
  process.exit(2);
}
