/**
  * 炼丹炉面板。
  * 只读 sim + resolveBrew 预览：实时展示选中丹方的理想火候区间、药性平衡、产出预测。
  * 不修改 sim；纯绘制。中文 HUD（C8）。
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Application, Texture } from 'pixi.js';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry, RecipeDef } from '@content/defs';
import type { BrewResult } from '@sim/alchemy/alchemySystem';
import { CJK_FONT } from './renderer';
import { itemIconAssetId } from '@app/itemIcons';

export interface FurnaceLayer {
 container: Graphics;
 icons: Container;
 lines: Text;
 visible: boolean;
}

export function createFurnaceLayer(app: Application): FurnaceLayer {
 const container = new Graphics();
 app.stage.addChild(container);
 const icons = new Container();
 app.stage.addChild(icons);
 const lines = new Text({ text: '', style: { fontFamily: CJK_FONT, fontSize: 13, fill: 0xeae0c8, lineHeight: 18 } });
 lines.x = 300;
 lines.y = 96;
 app.stage.addChild(lines);
 return { container, icons, lines, visible: false };
}

export interface FurnacePanelIconEntry {
 itemId: string;
 iconId: string;
 count: number;
 slot: 'output' | 'input';
}

export function furnacePanelIconEntries(recipe: RecipeDef, content: ContentRegistry): FurnacePanelIconEntry[] {
 const entries: FurnacePanelIconEntry[] = [];
 const outputIconId = itemIconAssetId(recipe.outputPillId, content);
 if (outputIconId) {
 entries.push({ itemId: recipe.outputPillId, iconId: outputIconId, count: 1, slot: 'output' });
 }
 for (const input of recipe.inputs) {
 const iconId = itemIconAssetId(input.herbId, content);
 if (!iconId) continue;
 entries.push({ itemId: input.herbId, iconId, count: input.qty, slot: 'input' });
 }
 return entries;
}

export interface FurnaceDrawInput {
 recipe: RecipeDef;
 heat: number; // 0..100
 preview: BrewResult; // resolveBrew 预览（不消费材料）
 pillName: string;
 haveInputs: { name: string; have: number; need: number }[];
}

const OUTCOME_CN: Record<BrewResult['outcome'], string> = {
 exploded: '炸炉！丹毒反噬',
 pill: '成丹',
 flawed: '残丹·火候/药性偏离',
 waste: '废丹·不匹配',
};

function bar(g: Graphics, x: number, y: number, w: number, h: number, pct: number, fill: number, zoneLo?: number, zoneHi?: number): void {
 g.rect(x, y, w, h).fill({ color: 0x1a1a22, alpha: 0.95 });
 if (zoneLo !== undefined && zoneHi !== undefined) {
 g.rect(x + Math.max(0, zoneLo) * w, y, Math.min(1, zoneHi) - Math.max(0, zoneLo) * w, h).fill({ color: 0x3a3a2a, alpha: 0.9 });
 }
 const fw = Math.max(0, Math.min(1, pct)) * w;
 if (fw > 0) g.rect(x, y, fw, h).fill(fill);
 g.rect(x, y, w, h).stroke({ width: 1, color: 0x3a3a44 });
}

function applyPanelSprite(sprite: Sprite, texture: Texture, x: number, y: number, size: number): void {
 sprite.texture = texture;
 sprite.x = x;
 sprite.y = y;
 sprite.width = size;
 sprite.height = size;
}

function clearFurnaceIcons(layer: FurnaceLayer): void {
	for (const child of layer.icons.removeChildren()) {
	child.destroy();
 }
 layer.icons.visible = false;
}

/** 绘制丹炉面板：标题 + 火候(含理想区间) + 四轴药性(当前 vs 目标) + 产出预测 + 材料。din=null 或不可见时清屏。 */
export function drawFurnace(
 layer: FurnaceLayer,
 _state: GameState,
 content: ContentRegistry,
 din: FurnaceDrawInput | null,
 textures?: Partial<Record<string, Texture>>,
): void {
 const g = layer.container;
	g.clear();
 if (!layer.visible || !din) {
 layer.lines.visible = false;
 clearFurnaceIcons(layer);
 return;
 }
 // 背景框
 g.rect(286, 84, 388, 312).fill({ color: 0x12121c, alpha: 0.94 });
 g.rect(286, 84, 388, 312).stroke({ width: 1.5, color: 0x6a5a2a });

const { recipe, heat, preview } = din;
 const [lo, hi] = recipe.idealHeatRange;
 // 火候条（0..100 → idealHeatRange 是毫点 0..100000，转 0..1）
 const heatPct = heat / 100;
 const zoneLo = lo / 100_000, zoneHi = hi / 100_000;
 bar(g, 300, 112, 360, 14, heatPct, 0xff8a3a, zoneLo, zoneHi);
 // 火候标记线
 const hx = 300 + heatPct * 360;
 g.moveTo(hx, 108).lineTo(hx, 130).stroke({ width: 2, color: 0xffffff });

// 四轴药性：目标（暗框）+ 当前炉内 furnaceVec（亮条）
 const axes: Array<{ key: keyof typeof recipe.targetProperty; label: string; color: number }> = [
 { key: 'cold', label: '寒', color: 0x66bbff },
 { key: 'hot', label: '热', color: 0xff5a5a },
 { key: 'warm', label: '温', color: 0xffb04a },
 { key: 'neutral', label: '平', color: 0x7ac050 },
 ];
 const maxProp = 12_000; // 药性毫点显示上限
 const ax = 300, ay0 = 150, aw = 150, ah = 12, dy = 26;
 for (let i = 0; i < axes.length; i++) {
 const a = axes[i]!;
 const tgt = recipe.targetProperty[a.key] / maxProp;
 const cur = preview.furnaceVec[a.key] / maxProp;
 const y = ay0 + i * dy;
 // 目标条（窄、半透明）
 bar(g, ax, y, aw, ah, tgt, a.color, undefined, undefined);
 // 当前条（叠加、偏移下方）
 bar(g, ax + aw + 8, y, aw, ah, cur, a.color, undefined, undefined);
 }

// 文字汇总
 const heatInZone = heatPct >= zoneLo && heatPct <= zoneHi;
 const qPct = Math.round(preview.quality * 100);
 const mat = din.haveInputs.map((m) => `${m.name} ${m.have}/${m.need}`).join(' ');

clearFurnaceIcons(layer);
 if (textures) {
 const iconEntries = furnacePanelIconEntries(recipe, content);
 const outputEntry = iconEntries.find((entry) => entry.slot === 'output');
 if (outputEntry) {
 const texture = textures[outputEntry.iconId];
 if (texture) {
 const sprite = new Sprite();
 applyPanelSprite(sprite, texture, 620, 146, 34);
 layer.icons.addChild(sprite);
 }
 }

iconEntries
 .filter((entry) => entry.slot === 'input')
 .slice(0, 4)
 .forEach((entry, index) => {
 const texture = textures[entry.iconId];
 if (!texture) return;
 const col = index % 2;
 const row = Math.floor(index / 2);
 const x = 528 + col * 52;
 const y = 206 + row * 52;
 const sprite = new Sprite();
 applyPanelSprite(sprite, texture, x, y, 28);
 layer.icons.addChild(sprite);
 const qty = new Text({
 text: `x${entry.count}`,
 style: { fontFamily: CJK_FONT, fontSize: 11, fill: 0xeae0c8 },
 });
 qty.x = x + 32;
 qty.y = y + 7;
 layer.icons.addChild(qty);
 });
 layer.icons.visible = layer.icons.children.length > 0;
 }

layer.lines.text =
 `── 炼丹炉 ── Y 切换丹方 · B 炼制 · [/] 调火候 · U 关闭\n` +
 `丹方：${recipe.displayName}（难度 ${recipe.difficulty}）→ ${din.pillName}\n` +
 `火候：${heat} ${heatInZone ? '✓理想区间' : '✗偏离'}\n` +
 `药性：[寒/热/温/平] 左=目标 右=当前炉内\n` +
 `预测：${OUTCOME_CN[preview.outcome]}${preview.outcome === 'pill' || preview.outcome === 'flawed' ? `（品质 ${qPct}%）` : ''}\n` +
 `材料：${mat || '无'}`;
 layer.lines.visible = true;
}
