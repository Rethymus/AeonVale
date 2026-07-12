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
  ', full-body centered, single character, hand-drawn 32x32 pixel sprite, NES/SNES era, ' +
  '16-color limited palette, matte flat opaque fills, flat cel shading, hard 1px pixel edges, ' +
  'single top-left light source, clean dark outline, no anti-aliasing, no gradient, no blur, ' +
  'no photorealistic, no cast shadow, no ground shadow, no background scenery, no mixels, ' +
  'no bloom, no glow, no soft shading, no volumetric lighting, no 3D render, no CGI, ' +
  'transparent background, crude amateur 16-bit RPG aesthetic, simple clean shapes, minimal detail';

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

const ICON_TAIL =
  ', centered single object, square composition, hand-drawn 32x32 pixel icon, NES/SNES era, ' +
  '16-color limited palette, matte flat opaque fills, flat cel shading, hard 1px pixel edges, ' +
  'single top-left light source, clean dark outline, no anti-aliasing, no gradient, no blur, ' +
  'no photorealistic, no cast shadow, no ground shadow, no background scenery, no mixels, ' +
  'no bloom, no glow, no soft shading, no reflections, no caustics, no studio lighting, no 3D render, ' +
  'transparent background, crude amateur 16-bit RPG item icon aesthetic, simple clean shapes, minimal detail';

// 高频物品/丹药图标（id 对齐 src/content/registry.ts）。经济取舍：只做最常出现在背包/快捷栏的。
const ICONS = {
  'icon.item.spirit-stone': 'Pixel art game item icon, a glowing translucent spirit stone gem, cyan-jade faceted, emitting soft qi light' + ICON_TAIL,
  'icon.item.beast-core': 'Pixel art game item icon, a swirling beast-core orb, dark crimson with golden veins, mystical demonic energy' + ICON_TAIL,
  'icon.item.spirit-compost': 'Pixel art game item icon, a small burlap pouch overflowing with glowing green-tinged spiritual compost soil' + ICON_TAIL,
  'icon.item.rust-hoe': 'Pixel art game item icon, a rusty iron farming hoe with wooden handle, weathered, side view' + ICON_TAIL,
  'icon.item.sickle': 'Pixel art game item icon, a curved steel harvesting sickle with wooden grip, side view' + ICON_TAIL,
  'icon.item.water-pail': 'Pixel art game item icon, a wooden water pail bucket with glowing spiritual water inside, rope handle' + ICON_TAIL,
  'icon.pill.ward-basic': 'Pixel art game item icon, a single round medicinal pill with pale cyan-blue glaze, lightning-ward pill' + ICON_TAIL,
  'icon.pill.ascend': 'Pixel art game item icon, a radiant golden medicinal pill with soft halo light, ornate ascension pill' + ICON_TAIL,
  'icon.pill.iron-bone': 'Pixel art game item icon, a single round medicinal pill, bone-white with golden flecks, iron-bone pill' + ICON_TAIL,
  'icon.pill.temper': 'Pixel art game item icon, a single round medicinal pill, deep crimson glaze, body-tempering pill' + ICON_TAIL,
  'icon.pill.detox': 'Pixel art game item icon, a single round medicinal pill, pale jade-green glaze, detox pill' + ICON_TAIL,
  'icon.item.array-core': 'Pixel art game item icon, a small rune-inscribed octagonal array core stone glowing faint cyan' + ICON_TAIL,
  'icon.item.recipe-fragment': 'Pixel art game item icon, a torn yellowed paper scroll fragment with faded ink runes' + ICON_TAIL,
  'icon.item.broken-talisman': 'Pixel art game item icon, a cracked broken bronze talisman charm fragment with a faint glyph' + ICON_TAIL,
  'icon.pill.bone-basic': 'Pixel art game item icon, a single round medicinal pill, bone-white with a marrow-red core, bone-generating pill' + ICON_TAIL,
  'icon.pill.madness': 'Pixel art game item icon, a single round medicinal pill, dark purple-black swirling, qi-deviation pill' + ICON_TAIL,
  'icon.pill.neutral-pearl': 'Pixel art game item icon, a single round lustrous pearl, pale iridescent white, neutral tai-yi pearl' + ICON_TAIL,
  'icon.pill.ward-greater': 'Pixel art game item icon, a single round medicinal pill, deep blue-violet glaze with bright white highlight rim and dark crackle lines, strong tonal contrast, greater lightning-ward pill' + ICON_TAIL,
  'icon.item.dried-herb': 'Pixel art game item icon, a small bundle of dried herb sprigs tied with twine, desiccated medicinal herbs' + ICON_TAIL,
  'icon.item.sealed-herb': 'Pixel art game item icon, a sealed paper-wrapped packet of preserved spiritual herbs with a talisman stamp' + ICON_TAIL,
  'icon.pill.cold-mud': 'Pixel art game item icon, a single round medicinal pill, pale frost-blue mud-caked surface with dark speckles, cold-mud pill' + ICON_TAIL,
  'icon.pill.deep-detox': 'Pixel art game item icon, a single round medicinal pill, deep emerald green glaze with bright golden veins, deep-detox pill' + ICON_TAIL,
  'icon.pill.temper-supreme': 'Pixel art game item icon, a single round medicinal pill, dark crimson with bright gold crackle lines, supreme tempering pill' + ICON_TAIL,
  'icon.pill.ward-heaven': 'Pixel art game item icon, a single round medicinal pill, deep violet with bright silver lightning crackle, heaven-stealing ward pill' + ICON_TAIL,
};

const FAC_TAIL =
  ', front view, centered single structure, orthogonal no perspective, hand-drawn 32x32 pixel sprite, ' +
  'NES/SNES era, 16-color limited palette, matte flat opaque fills, flat cel shading, hard 1px pixel edges, ' +
  'single top-left light source, clean dark outline, no anti-aliasing, no gradient, no blur, ' +
  'no photorealistic, no cast shadow, no ground shadow, no background scenery, no mixels, ' +
  'no bloom, no glow, no soft shading, no atmospheric perspective, no haze, no fog, no 3D render, ' +
  'transparent background, crude amateur 16-bit RPG facility aesthetic, simple clean shapes, minimal detail';

// 设施精灵（对齐 src/sim/world/state.ts FacilityKind，真实存在、renderer 现画简笔）。
const FACILITIES = {
  'facility.drying-rack': 'Pixel art game facility sprite, a rustic wooden herb-drying rack with a few hanging herb bundles' + FAC_TAIL,
  'facility.sealing-cabinet': 'Pixel art game facility sprite, a tall wooden spiritual storage cabinet with a round paper talisman seal on the door' + FAC_TAIL,
  'facility.talisman-furnace': 'Pixel art game facility sprite, a round bronze alchemy furnace with glowing rune fire at the mouth, small pill furnace' + FAC_TAIL,
};

const LOC_TAIL =
  ', single focal structure, simple location scene icon, 16-color limited palette, matte flat opaque fills, ' +
  'flat cel shading, hard 1px pixel edges, single top-left light source, clean dark outline, ' +
  'no anti-aliasing, no gradient, no blur, no photorealistic, no cast shadow, no background scenery, no mixels, ' +
  'no bloom, no glow, no soft shading, no atmospheric perspective, no 3D render, ' +
  'transparent background, crude amateur 16-bit RPG map icon aesthetic, simple clean shapes, minimal detail';

// 地点图标（对齐 src/sim/world/locations.ts，地点目录 UI 用）。
const LOCATIONS = {
  'loc.farmstead': 'Pixel art location icon, a small Chinese rustic farmstead with a wooden hut and a fenced herb plot' + LOC_TAIL,
  'loc.valley-market': 'Pixel art location icon, a small rustic market stall with hanging wares and a cloth awning, mountain valley market' + LOC_TAIL,
  'loc.ruin-gate': 'Pixel art location icon, an ancient crumbling stone gateway arch with old carved runes, ruin entrance' + LOC_TAIL,
  'loc.tea-shed': 'Pixel art location icon, a small roadside tea shed with a thatched roof and a wooden bench, old tea pavilion' + LOC_TAIL,
  'loc.spirit-vein': 'Pixel art location icon, a glowing spirit vein cave entrance with cyan qi mist, spiritual vein' + LOC_TAIL,
  'loc.ore-slope': 'Pixel art location icon, a rocky ore-laden slope with glinting mineral veins, mining slope' + LOC_TAIL,
  'loc.festival-ground': 'Pixel art location icon, a festive fairground with colorful banners and red lanterns strung between posts, festival grounds' + LOC_TAIL,
  'loc.valley-outskirts': 'Pixel art location icon, a wild mountain valley wilderness edge with sparse pine trees and a dirt path' + LOC_TAIL,
  'loc.array-shed': 'Pixel art location icon, a small workshop shed with array-crafting tools and a glowing rune-inscribed core on a bench, array smithy' + LOC_TAIL,
  'loc.greenhouse': 'Pixel art location icon, a small glass-paneled spiritual greenhouse with glowing herb sprouts visible inside' + LOC_TAIL,
};

const id = process.argv[2];
const prompt = SPRITES[id] ?? ICONS[id] ?? FACILITIES[id] ?? LOCATIONS[id];
if (!prompt) {
  console.error('未知 id。sprite/icon/facility/loc 见源码字典');
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
