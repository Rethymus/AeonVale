#!/usr/bin/env node
/**
 * 主世界角色精灵生成器。
 *
 * 用法：
 *   CG_API_KEY=sk-... node tools/gen-world-character-sprites.mjs map-sprite.player-v1
 *   CG_API_KEY=sk-... node tools/gen-world-character-sprites.mjs --all
 *
 * 设计目标：
 * - 生成现代 HD-2D 水墨修仙像素风的 3/4 俯视全身角色，而不是 32px 旧精灵或地图 token。
 * - 首选 /images/edits，用已有头像/立绘作为身份参考；缺少可用参考时退回 /images/generations。
 * - 密钥只从 CG_API_KEY 读取；脚本输出路径、checksum、prompt，不输出密钥。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const KEY = process.env.CG_API_KEY;
const RAW_BASE = process.env.CG_API_BASE ?? 'https://fast.qianxing.us.ci';
const BASE = RAW_BASE.replace(/\/+$/, '').endsWith('/v1') ? RAW_BASE.replace(/\/+$/, '') : `${RAW_BASE.replace(/\/+$/, '')}/v1`;
const MODEL = process.env.CG_MODEL ?? 'gpt-image-2';
const OUT = process.env.CG_OUT ? resolve(process.env.CG_OUT) : '/tmp/aeon-world-character-raw';
const FORCE_GENERATION = process.env.CG_FORCE_GENERATION === '1';
const CHROMA_KEY = process.env.CG_CHROMA_KEY === '1';

if (!KEY) {
  console.error('请设置 CG_API_KEY（密钥不入库，仅环境变量）');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const STYLE =
  'Create a single full-body game world character sprite for a Chinese xianxia farming RPG. ' +
  'Style: premium HD-2D pixel art with anime readability, hand-pixelled silhouette, crisp dark ink outline, ' +
  'large readable head and clothing clusters, 3/4 front top-down RPG stance, feet visible, centered character, ' +
  'transparent background if supported. Palette: restrained rice-paper neutrals, ink black, moss green, old hemp brown, ' +
  'cinnabar red, muted jade cyan and tiny gilt accents. Mood: mortal struggle, warm valley life, not power fantasy. ' +
  'The sprite must read clearly at 56-72 CSS pixels on a painted farmstead map. ' +
  'No scenery, no floor, no shadow, no text, no UI, no logo, no weapon covering the face, no photorealism, no 3D render, ' +
  'no plastic shine, no huge eyes, no modern clothes, no sci-fi, no chibi mascot token, no circular badge.';

const CHARACTERS = {
  'map-sprite.player-v1': {
    rawName: 'map-sprite.player-v1.png',
    reference: 'assets/portraits/avatar.player-v1.png',
    prompt:
      `${STYLE} Subject: the player protagonist, a young Chinese mortal body-cultivator with no spirit root, ` +
      'thin but resilient build, rough patched hemp robe, worn cloth belt, simple wrist wraps, short travel pack, ' +
      'plain sickle or hoe handle tied behind the waist, tired determined expression. He must look like a frail mortal surviving, not a chosen immortal.'
  },
  'map-sprite.herb-gatherer-v1': {
    rawName: 'map-sprite.herb-gatherer-v1.png',
    reference: 'assets/portraits/avatar.herb-gatherer-v1.png',
    prompt:
      `${STYLE} Subject: a young village herb gatherer woman, practical moss-green tunic, braided dark hair, ` +
      'woven herb basket on her back, small pruning knife at belt, sleeves tied up for field work, gentle alert posture.'
  },
  'map-sprite.array-smith-lu-v1': {
    rawName: 'map-sprite.array-smith-lu-v1.png',
    reference: 'assets/portraits/avatar.array-smith-lu-v1.png',
    prompt:
      `${STYLE} Subject: old array-smith Lu, stocky middle-aged to elderly craftsman, dark work robe and leather apron, ` +
      'gray beard, bronze feng-shui compass in one hand, short rune ruler at belt, grounded artisan posture.'
  },
  'map-sprite.liaochen-v1': {
    rawName: 'map-sprite.liaochen-v1.png',
    reference: 'assets/portraits/avatar.liaochen-v1.png',
    prompt:
      `${STYLE} Subject: Liaochen, a wandering bald cultivator monk-like traveler, plain gray-brown travel robe, ` +
      'wooden staff, cloth pack, calm guarded expression, looks experienced but not divine.'
  },
  'map-sprite.wangyan-elder-v1': {
    rawName: 'map-sprite.wangyan-elder-v1.png',
    reference: 'assets/portraits/avatar.wangyan-elder-v1.png',
    prompt:
      `${STYLE} Subject: elder Wangyan, old valley elder with white beard, dark scholar robe, weathered face, ` +
      'one hand behind back and one hand holding an old bamboo slip, quiet stern posture, mortal village wisdom.'
  },
  'map-sprite.xiao-wuji-v1': {
    rawName: 'map-sprite.xiao-wuji-v1.png',
    reference: 'assets/portraits/avatar.xiao-wuji-v1.png',
    prompt:
      `${STYLE} Subject: Xiao Wuji, elegant rival cultivator in clean pale robes, long black hair, subtle jade ornament, ` +
      'confident composed posture, restrained sect-disciple aura, not flamboyant, not villain armor.'
  },
  'map-sprite.market-merchant-v1': {
    rawName: 'map-sprite.market-merchant-v1.png',
    prompt:
      `${STYLE} Subject: valley market merchant, practical layered robe in muted rust and ochre, small abacus and coin pouch, ` +
      'compact shoulder goods satchel, shrewd friendly posture, visually distinct as a trader at a glance.'
  },
  'map-sprite.tea-shed-elder-v1': {
    rawName: 'map-sprite.tea-shed-elder-v1.png',
    prompt:
      `${STYLE} Subject: roadside tea-shed elder, thin elderly tea keeper, faded blue-gray robe, long white beard, ` +
      'small clay teapot and towel, relaxed hunched posture, warm mortal hospitality.'
  },
  'map-sprite.processing-artisan-v1': {
    rawName: 'map-sprite.processing-artisan-v1.png',
    prompt:
      `${STYLE} Subject: herb processing artisan, sturdy worker in brown apron, rolled sleeves, bundle of dried herbs, ` +
      'cords and sealing papers at belt, direct practical posture, easy to identify as workshop labor.'
  },
  'map-sprite.patrol-guard-v1': {
    rawName: 'map-sprite.patrol-guard-v1.png',
    prompt:
      `${STYLE} Subject: valley patrol guard, dark blue-black cloth armor, bamboo spear upright, small talisman pennant, ` +
      'watchful stance, protective but low-status mortal militia, not imperial soldier.'
  }
};

function usage() {
  console.error(`用法: CG_API_KEY=... node tools/gen-world-character-sprites.mjs <${Object.keys(CHARACTERS).join('|')}> | --all`);
}

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

function retryableStatus(status) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function parseImageResponse(response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message ?? JSON.stringify(json);
    return { ok: false, status: response.status, message: String(message).slice(0, 220) };
  }
  const item = json?.data?.[0];
  const b64Json = typeof item?.b64_json === 'string' && item.b64_json ? item.b64_json : null;
  const dataUrl = typeof item?.url === 'string' && item.url.startsWith('data:') ? item.url : null;
  const b64 = b64Json ?? (dataUrl ? dataUrl.split(',', 2)[1] : null);
  if (!b64) return { ok: false, status: response.status, message: '响应无图像数据' };
  return { ok: true, buffer: Buffer.from(b64, 'base64') };
}

async function generate(character) {
  const referencePath = character.reference ? resolve(character.reference) : null;
  const canEdit = referencePath ? existsSync(referencePath) && !FORCE_GENERATION : false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 180_000);
    try {
      const response = canEdit
        ? await editFromReference(character, referencePath, ctrl.signal)
        : await textToImage(character, ctrl.signal);
      clearTimeout(timeout);
      const parsed = await parseImageResponse(response);
      if (parsed.ok) return { mode: canEdit ? 'edit' : 'generation', buffer: parsed.buffer };
      console.error(`尝试 ${attempt} HTTP ${parsed.status}: ${parsed.message}`);
      if (!retryableStatus(parsed.status)) return null;
      await sleep(3500 * attempt);
    } catch (error) {
      clearTimeout(timeout);
      console.error(`尝试 ${attempt} 异常: ${error.message}`);
      await sleep(3500 * attempt);
    }
  }
  return null;
}

async function editFromReference(character, referencePath, signal) {
  const form = new FormData();
  form.append('model', MODEL);
  form.append('prompt', buildPrompt(`${character.prompt} Use the attached portrait only as identity and costume reference; redraw as a full-body world sprite.`));
  form.append('image', new Blob([readFileSync(referencePath)]), basename(referencePath));
  form.append('size', '1024x1024');
  return fetch(`${BASE}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
    signal
  });
}

async function textToImage(character, signal) {
  return fetch(`${BASE}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: buildPrompt(character.prompt) }),
    signal
  });
}

function buildPrompt(prompt) {
  if (!CHROMA_KEY) return prompt;
  return (
    `${prompt} Put the character on a perfectly flat solid #00ff00 chroma-key background for removal. ` +
    'The background must be one uniform green color with no shadows, gradients, scenery, floor plane, glow, texture, or lighting variation. ' +
    'Do not use #00ff00 anywhere in the character.'
  );
}

const requested = process.argv[2];
const ids = requested === '--all' ? Object.keys(CHARACTERS) : requested && CHARACTERS[requested] ? [requested] : [];
if (!ids.length) {
  usage();
  process.exit(1);
}

const results = [];
for (const id of ids) {
  const character = CHARACTERS[id];
  console.log(`生成 ${id} ...`);
  const result = await generate(character);
  if (!result) {
    console.error(`FAIL ${id}`);
    results.push({ id, ok: false });
    continue;
  }
  const outFile = resolve(OUT, character.rawName);
  writeFileSync(outFile, result.buffer);
  const checksum = createHash('sha256').update(result.buffer).digest('hex');
  console.log(`OK ${id} ${result.mode} ${(result.buffer.length / 1024).toFixed(0)}KB ${outFile} sha256=${checksum}`);
  results.push({ id, ok: true, mode: result.mode, out: outFile, checksum, prompt: character.prompt });
}

console.log(JSON.stringify({ outDir: OUT, model: MODEL, endpoint: BASE, results }, null, 2));
if (results.some(result => !result.ok)) process.exit(2);
