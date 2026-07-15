/**
  * 烘焙程序化灵草图标。
 *
  * 用 **真实的** `src/render/sprites.ts` 生成器（与农场运行时同一函数，零漂移），
  * 对 registry 全部灵草离线生成 32×32 像素 → 输出原始 RGBA 到 /tmp，
  * 再由 Python(PIL) 编码为 PNG（Node 无 PNG 编码器）。
 *
  * 用法：node node_modules/tsx/dist/cli.mjs tools/bake-herb-icons.ts
  * 产物：/tmp/bake-herb.<id>.rgba（每行 stdout: id|tier|elem|path）
  * 再跑：python3 读取这些 rgba → assets/icons/herb.<id>.png（见 README/脚本注释）
 *
  * 这一步是"基底"；AI 精修在后续层叠加（见 gen-sprite/refine 管线）。
  * 许可：CC-BY-NC-4.0（项目原创程序化内容，非 AI）。
 */
import { buildRegistry } from '../src/content/registry';
import { generateHerbSprite, generateSeedSprite, toRgba, SPRITE_SIZE } from '../src/render/sprites';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type Elem = 'cold' | 'hot' | 'warm' | 'neutral';
function dominant(bp: { cold: number; hot: number; warm: number; neutral: number }): Elem {
 const arr: [Elem, number][] = [['cold', bp.cold], ['hot', bp.hot], ['warm', bp.warm], ['neutral', bp.neutral]];
 arr.sort((a, b) => b[1] - a[1]);
 return arr[0]?.[0] ?? 'neutral';
}

const TMP = resolve(import.meta.dirname, '..', '..'); // repo root for /tmp paths
const reg = buildRegistry();
const rows: string[] = [];
for (const [id, h] of reg.herbs) {
 const elem = dominant(h.baseProperty);
 const px = generateHerbSprite({ id, tier: h.tier, element: elem });
 const rgba = toRgba(px); // Uint8ClampedArray 32*32*4
 if (rgba.length !== SPRITE_SIZE * SPRITE_SIZE * 4) {
 throw new Error(`${id} RGBA 长度异常 ${rgba.length}`);
 }
 const path = `/tmp/bake-${id}.rgba`;
 writeFileSync(path, Buffer.from(rgba));
 rows.push(`${id}|${h.tier}|${elem}|${path}`);
 // 同步烘焙种子（seedId），元素沿用灵草主属性；纯程序化（低频，不叠 AI 精修）
 const seedPath = `/tmp/bake-${h.seedId}.rgba`;
 writeFileSync(seedPath, Buffer.from(toRgba(generateSeedSprite({ id: h.seedId, element: elem }))));
 rows.push(`${h.seedId}|${h.tier}|${elem}|${seedPath}`);
}
for (const r of rows) console.log(r);
console.log(`baked ${rows.length} herbs (raw RGBA, ${SPRITE_SIZE}x${SPRITE_SIZE})`);
