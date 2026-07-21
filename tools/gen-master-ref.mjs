#!/usr/bin/env node
/**
 * Phase 1 master reference 生成器。
 *
 * 用法：
 * CG_API_KEY=sk-... node tools/gen-master-ref.mjs
 * CG_API_BASE=https://.../v1 node tools/gen-master-ref.mjs reference.master.cozy-warm-farm-v1
 *
 * 约束：
 * - 只用最小 /images/generations body，复用当前 relay 契约。
 * - 产出写入 assets/references/，供私有风格锁定与 provenance 留痕。
 * - 密钥只读环境变量，绝不入库。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const KEY = process.env.CG_API_KEY;
const BASE = process.env.CG_API_BASE ?? 'https://fast.qianxing.us.ci/v1';
const MODEL = process.env.CG_MODEL ?? 'gpt-image-2';
if (!KEY) {
  console.error('请设置 CG_API_KEY（密钥不入库，仅环境变量）');
  process.exit(1);
}

const REFERENCES = {
  'reference.master.cozy-warm-farm-v1': {
    filename: 'master-cozy-warm-farm-v1.png',
    prompt:
      'Master style reference concept art for a cozy xianxia farming game. ' +
      'Scene: a tiny spirit-herb field beside a humble timber hut in a mountain valley at late-afternoon golden light, ' +
      'one narrow tilled plot, fresh green herb sprouts, a small bronze alchemy furnace, a paper talisman fluttering from a wooden post, ' +
      'distant rounded hills and a soft ink-brush sky. ' +
      'Mood: warm, gentle, lived-in, inviting, handcrafted, slightly magical, the world feels quietly alive. ' +
      'Style: warm Chinese ink-wash and gouache hybrid, low saturation, soft diffuse light, rounded silhouettes, clean composition, cozy negative space, ' +
      'painterly rice-paper texture, subtle motion cues in grasses and cloth, not cold monochrome scholar painting, not grim wuxia realism, ' +
      'not tactical colony-sim framing, not a hard grid, not isometric, no UI, no text, no logo, no border, no characters staring at camera.'
  }
};

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

async function generateOne(prompt) {
  const body = JSON.stringify({ model: MODEL, prompt });
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 180_000);
    try {
      const response = await fetch(`${BASE}/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body,
        signal: ctrl.signal
      });
      const json = await response.json().catch(() => ({}));
      clearTimeout(timeout);
      if (!response.ok) {
        console.error(`尝试 ${attempt} HTTP ${response.status}: ${(json?.error?.message ?? JSON.stringify(json)).slice(0, 180)}`);
        await sleep(4000 * attempt);
        continue;
      }
      const item = json?.data?.[0];
      const b64Json = typeof item?.b64_json === 'string' && item.b64_json ? item.b64_json : null;
      const dataUrl = typeof item?.url === 'string' && item.url.startsWith('data:') ? item.url : null;
      const b64 = b64Json ?? (dataUrl ? item.url.split(',', 2)[1] : null);
      if (!b64) {
        console.error(`尝试 ${attempt}: 响应无图像数据`);
        await sleep(3000);
        continue;
      }
      return Buffer.from(b64, 'base64');
    } catch (error) {
      clearTimeout(timeout);
      console.error(`尝试 ${attempt} 异常: ${error.message}`);
      await sleep(4000 * attempt);
    }
  }
  return null;
}

const requestedId = process.argv[2] ?? 'reference.master.cozy-warm-farm-v1';
const reference = REFERENCES[requestedId];
if (!reference) {
  console.error(`未知 master reference id: ${requestedId}`);
  process.exit(1);
}

const outputDir = resolve(import.meta.dirname, '..', 'assets', 'references');
mkdirSync(outputDir, { recursive: true });

const buffer = await generateOne(reference.prompt);
if (!buffer) {
  console.error(`生成失败：${requestedId}`);
  process.exit(2);
}

const filePath = resolve(outputDir, reference.filename);
writeFileSync(filePath, buffer);
const checksum = createHash('sha256').update(buffer).digest('hex');
const generatedAt = new Date().toISOString();

console.log(
  JSON.stringify(
    {
      id: requestedId,
      path: `references/${reference.filename}`,
      type: 'png',
      checksum,
      license: 'AI-Generated',
      source: 'gpt-image-2 via relay; Phase 1 cozy warm ink-wash master reference draft; pending human sign-off',
      src: {
        model: MODEL,
        endpoint: BASE,
        prompt: reference.prompt,
        seed: null,
        master_ref: [],
        ref_imgs: [],
        generated_at: generatedAt
      },
      human_edits: [],
      ai_disclosed: true,
      bytes: buffer.length
    },
    null,
    2
  )
);
