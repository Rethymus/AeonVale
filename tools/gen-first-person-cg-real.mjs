#!/usr/bin/env node
// 灵韵叙录第一人称 CG 离线生成器（gpt-image-2 via fast.qianxing.us.ci 中转）
// 红线：key 只从 env 读（FAST_KEY_IMG / FAST_BASE），绝不硬编码（CONTRIBUTING: 不提交 secrets）。
// 运行时不调用——仅开发期离线产线（docs/23 §6）。升 -v2，禁原地覆盖。
// 用法： FAST_KEY_IMG=sk-... node tools/gen-first-person-cg-real.mjs [--dry-run] [--only=id1,id2] [--size=1024x1024]
// 可恢复：已存在的图跳过。输出 manifest 条目到 .omc/artwork/first-person-cg-v2.json（不自动改 manifest.json，下一步再合并）。

import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.FAST_BASE || 'https://fast.qianxing.us.ci';
const KEY = process.env.FAST_KEY_IMG;
if (!KEY) {
  console.error('missing FAST_KEY_IMG env (set it in your shell, never commit it)');
  process.exit(2);
}

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = path.join(ROOT, 'assets/cg/first-person');
const MODEL = 'gpt-image-2';

const args = process.argv.slice(2);
const sizeArg = args.find(a => a.startsWith('--size='));
const SIZE = sizeArg ? sizeArg.split('=')[1] : '1024x1024';

// 独立视觉人格：水墨国风第一人称沉浸，区别于主模式俯视像素农场。
// 六色 token 对齐：纸(留白)/墨(主体)/靛/气青/朱砂(点缀)/金(点缀)。
const STYLE =
  'Chinese ink wash painting (水墨) style, 2.5D xianxia cultivation aesthetic, ' +
  'muted earth-tone palette with restrained vermilion (朱砂) and gold (金) accents, ' +
  'indigo (靛) and qi-cyan (气青) highlights, generous paper-white (纸) negative space, ' +
  'cinematic first-person immersion, contemplative restrained composition, painterly brushwork, ' +
  'no text, no watermark, no signature, no logo, no modern objects, no photographic realism';

const ART = [
  { id: 'prologue.valley-v2', prompt: "First-person point of view lying on grass looking up at an alien sky: exotic winged beasts soaring, tiny silhouettes of figures walking on empty air far above, misty mountain valley at dawn. A modern stranger awakening in a strange cultivation world." },
  { id: 'prologue.village-v2', prompt: "A dilapidated lonely border village with a few chimneys trailing smoke at dusk, earthen houses, small fields, distant misty mountains. The Eternal Valley hamlet." },
  { id: 'prologue.sect-v2', prompt: "A grand cultivation sect gate on a mountain, young talents lining up to touch a glowing spirit-testing pillar, robed elders watching from a balcony. The door that rejects the rootless." },
  { id: 'act1.ring-v2', prompt: "A glowing storage ring artifact resting among grey ashes of a cultivator who burned to nothing, scorched farmland aftermath, drifting vermilion embers, a jade pendant nearby. The fallen rival and his legacy." },
  { id: 'act1.script-v2', prompt: "An ancient unrolling cultivation scroll emanating uncanny light, covered in strange cryptic abstract glyphs (illegible, non-textual symbols only, do not render any real writing), beside a broken alchemy furnace and a seed pouch. The Steal-Heaven-Swap-Tribulation manual from another world." },
  { id: 'tribulation.purple-v2', prompt: "A colossal purple lightning tribulation storm descending onto a small farm field, a lone tiny figure standing firm beneath it, spiritual herbs and arrays arranged as defense. Mortal bone forging itself in heavenly fire." },
  { id: 'ending.e0-mushroom-v2', prompt: "A single bright red-capped white-stemmed poisonous mushroom in a misty empty valley, comic-tragic atmosphere, a fallen figure slumped in the distant background. The early bad ending: do not eat strange mushrooms." },
  { id: 'ending.ascension-v2', prompt: "A silhouetted cultivator ascending into a vast sky of soft golden light, looking back down at a small farm field and a weathered faceless stone statue, serene and bittersweet. Ascending yet remembering the dust." },
  { id: 'ending.poison-death-v2', prompt: "A collapsed cultivator beside an alchemy furnace, dark blood from seven orifices, spilled toxic elixirs pooling, grim tragedy. Pill-poison death." },
  { id: 'ending.tribulation-death-v2', prompt: "A scorched human figure dissolving into ash and ember under a final lightning strike, mirroring the fallen rival's end. Struck down by heaven." },
  { id: 'ending.madness-v2', prompt: "A cultivator consumed by inner demons, fragmented distorted hallucinatory vision swirling around a breaking mind, shadowy whispering faces in the ink wash mist. Qi-deviation madness." },
  { id: 'ending.lifespan-death-v2', prompt: "An aged weathered farmer sitting alone in a field at twilight, holding dry dead wheat, far from any homeland, melancholic dignity, empty horizon. A mortal life ends in a foreign land." },
  { id: 'ending.e6-sacrifice-v2', prompt: "A cultivator peacefully dissolving into radiant white-gold light, giving their stolen heaven-stealing power back to heal a broken cracking world, a serene selfless farewell, no more choices. Awakening: sacrifice to save the world." },
  { id: 'ending.e7-usurp-v2', prompt: "A cultivator turning their head to stare directly out of the frame at the viewer with an unsettling knowing smirk, merging with heaven, becoming a new oppressive sky, the fourth wall breaking. Awakening: usurping heaven, expelling the player." },
  // —— 第二批：NPC 立绘 + 场景 + 道心氛围层 + 梗意象（填 V1 氛围层 gap）——
  { id: 'npc.wangyan-v2', prompt: "An elderly hermit with a weathered kind face, simple worn rural robes, holding a rusted hoe, calm eyes that have seen much. The silent old man who hands over a hoe instead of a manual." },
  { id: 'npc.xiao-v2', prompt: "A proud young sword cultivator of extraordinary heavenly talent, cold noble bearing, pristine sect robes, a glowing sword at his side. The rival who walks the heaven-approved path." },
  { id: 'npc.ni-v2', prompt: "A fallen cultivator dissolving into grey ash, beside a jade pendant carved with a single word, a broken furnace and a seed pouch scattered. The mirror of the protagonist's possible end." },
  { id: 'npc.farmer-v2', prompt: "A warm humble mortal peasant family at a doorway offering a bowl of rice to a stranger, rustic kindness, soft lamp light. The mortals who took in a lost traveler." },
  { id: 'npc.heart-demon-v2', prompt: "A shadowy fragmented ink-wash figure of inner demons whispering from within, distorted overlapping faces, vermilion chaos, psychological unease. The voice of obsession." },
  { id: 'scene.village-dawn-v2', prompt: "A quiet border hamlet at dawn, thin mist and chimney smoke, small fields, a lone figure approaching. The Eternal Valley at first light." },
  { id: 'scene.spirit-farm-v2', prompt: "A spiritual herb farm field with glowing plants arranged in precise arrays like a chessboard, a defensive layout at dawn. Farming as fortification." },
  { id: 'scene.market-v2', prompt: "A wandering cultivator roadside market with makeshift stalls, exotic herbs and wares, haggling figures, dust. The fringes of the cultivation world." },
  { id: 'scene.shennong-cave-v2', prompt: "An ancient hidden cave with faded murals depicting a faceless farmer-sage who shaped the heavens with soil and lightning, mysterious and sacred. Where the legend is pieced together." },
  { id: 'scene.faceless-statue-v2', prompt: "A weathered faceless stone statue standing in overgrown grass, its base polished smooth by countless mortal hands over a million years, reverent silence." },
  { id: 'ambience.defiance-v2', prompt: "Abstract ink-wash atmosphere of qi-deviation and rebellion: distorted swirling vermilion chaos, vertigo and unease, no figures. The mood of defiance rising." },
  { id: 'ambience.bond-v2', prompt: "Abstract ink-wash atmosphere of worldly warmth and attachment: soft golden light through a paper window falling on a simple bowl of rice, comfort, no figures. The mood of red-dust bonds." },
  { id: 'ambience.void-root-v2', prompt: "Abstract ink-wash of spiritual qi spiraling into a central void, a qi-cyan vortex of infinite absorption and leakage, no figures. The void spiritual root." },
  { id: 'meme.mushroom-v2', prompt: "A single iconic bright red-capped white-stemmed mushroom close-up on a misty valley floor, a comic-tragic emblem, a tiny fallen silhouette far behind it. The meme of caution." },
  // —— 第三批：场景对照 / NPC 补立绘 / 梗意象（v2 池细化，独立水墨视觉人格）——
  { id: 'scene.battle-duel-v2', prompt: "Two cultivators clashing in mid-air above a scorched farm field: one radiating disciplined indigo sword-light, the other swirling a chaotic violet-black vortex, energies colliding in a deafening shockwave, ink-wash clouds torn apart. A duel of the heaven-approved and the heaven-defying." },
  { id: 'scene.ni-ash-v2', prompt: "A Jade pendant carved with a single illegible glyph resting in a small drift of grey human ash on burned soil, a broken alchemy furnace and seed pouch nearby, faint vermilion embers drifting, melancholic reverence. All that remains of a fallen rival." },
  { id: 'scene.farm-autumn-v2', prompt: "A spiritual herb farm in late autumn, golden harvest on one side and withered stalks on the other, dry wind bending the plants, a lone Farmer's shadow walking the rows, paper-white negative space, restrained melancholy and abundance in one frame." },
  { id: 'scene.sect-gate-v2', prompt: "The outer gate of a grand cultivation sect carved into a mountain cliff, young talents in robes lining up in an orderly queue to enter, robed guards watching, distant floating peaks in mist, the threshold that turns mortals away." },
  { id: 'scene.mortal-montage-v2', prompt: "A single mortal farmer aging in place beside the same rustic field across decades: youth, middle age, and white-haired elder overlaid in soft ink-wash layers, the same rusted hoe in hand across every frame, paper-white void around, the long quiet life of a cultivator who chose not to cultivate." },
  { id: 'scene.purple-sky-v2', prompt: "A vast cosmic sky split open by a colossal purple lightning tribulation, clouds swirling into a great eye, a lone impossibly small figure standing on a field far below facing the heavens, overwhelming vertical scale, ink-wash grandeur and dread." },
  { id: 'npc.wangyan-old-v2', prompt: "An extremely aged hermit with snow-white hair and deep weathered wrinkles, still gripping a rusted hoe with calloused hands, simple patched rural robes, calm eyes that have outlasted generations, dignified rural gravitas. The silent old man in his final years." },
  { id: 'npc.xiao-sword-v2', prompt: "A close-up of a glowing indigo sword blade emanating disciplined qi-cyan sword-light, the hilt held by a proud young sword cultivator with cold noble bearing, sect robes pristine, sharp restrained lethality. The heaven-approved rival's signature edge." },
  { id: 'npc.farmer-wife-v2', prompt: "A warm middle-aged peasant woman in simple rural robes standing in a doorway holding a steaming bowl of rice porridge, soft lamp light behind her, kind weathered face, generous rustic hospitality. The mortal warmth that took in a lost traveler." },
  { id: 'npc.village-child-v2', prompt: "A curious peasant child in patched clothes standing at a village threshold, clapping hands in play about to sing a nursery rhyme, bright innocent eyes, soft morning light, a faint wooden whistle motif on a string around the neck. The carrier of an old rhyme." },
  { id: 'meme.storage-ring-v2', prompt: "A close-up of an ancient storage ring artifact resting on scorched soil, the ring surface covered in strange cryptic abstract glyphs (illegible, non-textual symbols only, do not render any real writing), faint qi-cyan glow pulsing from within, paper-white negative space, mysterious inheritance. The meme of a fallen rival's legacy." },
  { id: 'meme.wooden-whistle-v2', prompt: "A close-up of a small polished wooden whistle on a simple cord, the whistle surface carved with a single cryptic non-textual mark resembling a Shennong-era motif, soft warm light, rustic reverence. The meme of a quiet mortal kindness and its hidden lineage." }
];

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

async function genOne(item, attempts = 3) {
  const prompt = `${item.prompt}. Style: ${STYLE}`;
  const body = { model: MODEL, prompt, n: 1, size: SIZE };
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${BASE}/v1/images/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 240)}`);
      }
      const json = await res.json();
      const data = json.data?.[0];
      const b64 = data?.b64_json;
      if (!b64) throw new Error('no b64_json in response; data keys=' + Object.keys(data || {}).join(','));
      return Buffer.from(b64, 'base64');
    } catch (e) {
      lastErr = e;
      console.error(`  [attempt ${attempt}/${attempts}] ${item.id}: ${e.message}`);
      if (attempt < attempts) await new Promise(r => setTimeout(r, 6000 * attempt));
    }
  }
  throw lastErr;
}

async function main() {
  const dry = args.includes('--dry-run');
  const onlyArg = args.find(a => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.split('=')[1].split(',') : null;
  const items = only ? ART.filter(a => only.includes(a.id)) : ART;

  await mkdir(OUT_DIR, { recursive: true });
  const results = [];

  for (const item of items) {
    const fileName = item.id.replace(/\./g, '-') + '.png';
    const file = path.join(OUT_DIR, fileName);
    const manifestId = `cg.first-person.${item.id}`;
    const relPath = `cg/first-person/${fileName}`;

    if (existsSync(file)) {
      const buf = await readFile(file);
      results.push({
        id: manifestId, path: relPath, checksum: sha256(buf),
        license: 'AI-Generated', ai_disclosed: true, human_edits: [],
        status: 'approved', bytes: buf.length, note: 'reused-existing',
        src: { model: MODEL, endpoint: BASE, prompt: item.prompt, seed: null },
      });
      console.log(`[skip] ${item.id} exists (${buf.length}b)`);
      continue;
    }
    if (dry) { console.log(`[dry ] would gen ${item.id}`); continue; }

    console.log(`[gen ] ${item.id} (${SIZE}) ...`);
    try {
      const buf = await genOne(item, 3);
      await writeFile(file, buf);
      const sum = sha256(buf);
      results.push({
        id: manifestId, path: relPath, checksum: sum,
        license: 'AI-Generated', ai_disclosed: true, human_edits: [],
        status: 'approved', bytes: buf.length,
        src: { model: MODEL, endpoint: BASE, prompt: item.prompt, seed: null },
      });
      console.log(`[ok  ] ${item.id} ${buf.length}b sha256=${sum.slice(0, 12)}…`);
    } catch (e) {
      results.push({ id: manifestId, status: 'FAILED', error: String(e.message || e) });
      console.error(`[FAIL] ${item.id}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2500)); // rate-limit between calls
  }

  const outDir = path.join(ROOT, '.omc/artwork');
  await mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'first-person-cg-v2.json');
  await writeFile(out, JSON.stringify(results, null, 2));

  const ok = results.filter(r => r.status !== 'FAILED').length;
  const failed = results.filter(r => r.status === 'FAILED');
  console.log(`\n=== ${ok}/${items.length} ok; manifest entries → ${out} ===`);
  if (failed.length) console.log(`FAILED: ${failed.map(f => f.id).join(', ')}`);
}

main().catch(e => { console.error(e); process.exit(1); });
