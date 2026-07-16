/**
  * PixiJS v8 渲染层。
  * 只读 sim 状态绘制；不修改 sim。中文 HUD（C8），CJK 字体走系统回退（首版；正式版内置 霞鹜文楷）。
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';
import { MILLI } from '@sim/world/types';
import type { Season } from '@sim/world/types';
import { stageQiCap } from '@sim/progression/progression';
import { DEFAULT_BALANCE } from '@sim/params';
import { t, tList } from '@content/i18n';
import type { CropQuality } from '@sim/farm/quality';
import { storageUsed } from '@sim/storage/storage';
import { shippingLines } from '@sim/economy/shipping';
import { marketDemandForItem } from '@sim/economy/market';
import { getPrimaryStayingWorldGoal, renderStayingWorldGoals } from '@sim/progression/stayingWorldGoals';
import type { SimContext } from '@sim/world/context';
import { bodyFoundationCap, readyToInvokeTribulation, type FacilityKind, type LocationId } from '@sim';
import { guardBeastPreviewAssetId, guardBeastPreviewPlacements } from './guardBeastPreview';
import { farmsteadPropPlacements, locationWorldPreviewPlacements, npcWorldPreviewPlacements } from './npcWorldPreview';
import { arrayWorldPreviewPlacements } from './arrayPreview';
import { tileReadinessState, tileVisualState } from './tileVisuals';
import { inventoryIconStripEntries } from './inventoryIconStrip';
import { tileAssetId } from './tileAsset';
import { hasActiveArrayCoverage } from '@sim/tribulation/arrays';
import { itemIconAssetId } from '@app/itemIcons';

/** CJK 字体栈（首版用系统 CJK 回退；正式版应 FontFace 预加载 霞鹜文楷） */
export const CJK_FONT = "'LXGW WenKai','Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif";

export const TILE = 42;
const OX = 32;
const OY = 70;
const SCREEN_W = 960; // 对齐 main.ts app.init 尺寸
const SCREEN_H = 540;
const BRIEFING_BOX = { x: SCREEN_W - 244, y: 8, width: 232, minHeight: 70, radius: 7, paddingY: 8 } as const;
const PANEL_PREVIEW_BOX = { x: 688, y: 286, width: 248, minHeight: 112, radius: 8, paddingY: 18 } as const;
const LOCATION_PREVIEW_BOX = { x: 648, y: 70, width: 288, minHeight: 206, maxHeight: 370, radius: 8, paddingY: 16 } as const;
export const DIALOGUE_LAYOUT_LIMITS = {
 x: 40,
 width: 600,
 safeTop: 70,
 bottom: 434,
 bottomUiTop: SCREEN_H - 90,
 minHeight: 138,
 radius: 8,
 paddingX: 18,
 paddingY: 18,
 portraitSize: 96,
 portraitTextOffset: 112,
 lineHeight: 22,
} as const;

export const DIALOGUE_CONTINUE_PROMPT = '　　…空格 / 回车键 继续…';

/** 季节环境色调（T5 / B-gap #2）：全屏低透明叠色，让四季有视觉差异。 */
const SEASON_TINT: Record<Season, { color: number; alpha: number }> = {
 spring: { color: 0x335533, alpha: 0.05 }, // 春·青绿
 summer: { color: 0x664422, alpha: 0.06 }, // 夏·暖黄
 autumn: { color: 0x663322, alpha: 0.07 }, // 秋·金橙
 winter: { color: 0x223366, alpha: 0.09 }, // 冬·冷蓝（略强，肃杀感）
};

const SOIL_COLOR: Record<string, number> = {
 loam: 0x6b4f2a,
 'wet-loam': 0x4a3520,
 'dry-sand': 0x9b7b3f,
 insulated: 0x4a4a52,
 scorched: 0x2a1a0a,
 'spirit-loam': 0x4a6a2a,
 rock: 0x3a3a3a,
 water: 0x2a4a6b,
 'metal-ore': 0x5a5a6a,
};

const STAGE_COLOR: Record<string, number> = {
 seed: 0x3a2a10,
 sprout: 0x7ac050,
 growing: 0x4a9a30,
 mature: 0xffe066,
 withered: 0x6a4a20,
};

const FACILITY_COLOR: Record<string, number> = {
 'drying-rack': 0xd2a85a,
 'sealing-cabinet': 0x7aa6c2,
 'talisman-furnace': 0xc46a3a,
};

type GuardBeastSpecialtyMarker = 'field-ward' | 'array-warden' | 'courier';

const GUARD_BEAST_SPECIALTY_MARKER: Record<GuardBeastSpecialtyMarker, { color: number; accent: number }> = {
 'field-ward': { color: 0x7fe38b, accent: 0xe9ffd9 },
 'array-warden': { color: 0x66ddff, accent: 0xe8f8ff },
 courier: { color: 0xffd36b, accent: 0xfff4bf },
};

export interface RenderLayers {
 tiles: Graphics;
 tileSprites: Container;
 entities: Graphics;
 sceneSprites: Container;
 hotbarIconBg: Graphics;
 hotbarIcon: Sprite;
 panelPreviewBg: Graphics;
 panelPreviewIcon: Sprite;
 panelPreviewText: Text;
 locationPreviewBg: Graphics;
 locationPreviewImage: Sprite;
 locationPreviewNpcPrimary: Sprite;
 locationPreviewNpcSecondary: Sprite;
 locationPreviewText: Text;
 hud: Text;
 briefingBg: Graphics;
 briefingImage: Sprite;
 briefingIcon: Sprite;
 briefing: Text;
 toastIconBg: Graphics;
 toastIcon: Sprite;
 toast: Text;
 help: Text;
 ending: Text;
 endingImage: Sprite;
 inv: Text;
 invIcons: Container;
 cultivation: Text;
 hotbar: Text;
 bars: Graphics;
 barLabels: Text[];
 showInv: boolean;
 furnaceHeat: number; // 玩家炉温 0..100（app 设置，HUD 显示）
 tribFlash: Graphics; // 天劫全屏闪光（T3b）
 tribFlashTtl: number; // 闪光剩余帧（0=无）
 dialogueBg: Graphics; // 叙事对话盒背景（T4）
 dialoguePortrait: Sprite; // 对话立绘（P0 资产接入）
 dialogue: Text; // 叙事对白文本
 seasonTint: Graphics; // 季节环境色调（T5）
 particles: Graphics; // 程序化粒子（T9）
 particleList: Particle[]; // 活跃粒子（渲染层非确定性，sim 不受影响）
}

export interface RuntimeRenderAssets {
 player?: Texture;
 guardBeast?: Texture;
 guardBeastVariants?: Partial<Record<string, Texture>>;
 cropHerbs: Partial<Record<string, Texture>>;
 cropSeeds: Partial<Record<string, Texture>>;
 facilities: Partial<Record<string, Texture>>;
 endingCg: Partial<Record<string, Texture>>;
 locations: Partial<Record<LocationId, Texture>>;
 logos: Partial<Record<string, Texture>>;
 hotbarIcons: Partial<Record<string, Texture>>;
 itemIcons: Partial<Record<string, Texture>>;
 npcs: Partial<Record<string, Texture>>;
 tiles: Partial<Record<string, Texture>>;
}

/** 程序化粒子（T9）。渲染层自管的瞬态视觉效果，不进 sim、不影响确定性。 */
export interface Particle {
 x: number; y: number; vx: number; vy: number;
 life: number; maxLife: number; color: number; size: number;
}

function panelBoxHeight(textHeight: number, minHeight: number, paddingY: number): number {
 return Math.max(minHeight, Math.ceil(textHeight) + paddingY * 2);
}

export function briefingBoxHeight(textHeight: number): number {
 return panelBoxHeight(textHeight, BRIEFING_BOX.minHeight, BRIEFING_BOX.paddingY);
}

export function itemPreviewBoxHeight(textHeight: number): number {
 return panelBoxHeight(textHeight, PANEL_PREVIEW_BOX.minHeight, PANEL_PREVIEW_BOX.paddingY);
}

export function locationPreviewBoxHeight(textHeight: number): number {
 return Math.min(
 LOCATION_PREVIEW_BOX.maxHeight,
 panelBoxHeight(textHeight, LOCATION_PREVIEW_BOX.minHeight, LOCATION_PREVIEW_BOX.paddingY),
 );
}

export interface DialogueBoxLayout {
 x: number;
 y: number;
 width: number;
 height: number;
 textX: number;
 textY: number;
 textWidth: number;
 portraitX: number;
 portraitY: number;
 portraitSize: number;
}

export function dialogueTextLayoutStyle(hasPortrait: boolean): {
 wordWrap: true;
 breakWords: true;
 wordWrapWidth: number;
 lineHeight: number;
} {
 return {
 wordWrap: true,
 breakWords: true,
 wordWrapWidth: hasPortrait
 ? DIALOGUE_LAYOUT_LIMITS.width - DIALOGUE_LAYOUT_LIMITS.paddingX * 2 - DIALOGUE_LAYOUT_LIMITS.portraitTextOffset
 : DIALOGUE_LAYOUT_LIMITS.width - DIALOGUE_LAYOUT_LIMITS.paddingX * 2,
 lineHeight: DIALOGUE_LAYOUT_LIMITS.lineHeight,
 };
}

export function dialogueBoxLayout(textHeight: number, hasPortrait: boolean): DialogueBoxLayout {
 if (!Number.isFinite(textHeight) || textHeight < 0) {
 throw new RangeError(`Dialogue text height must be a finite non-negative number, got ${textHeight}.`);
 }

 const contentHeight = Math.max(Math.ceil(textHeight), hasPortrait ? DIALOGUE_LAYOUT_LIMITS.portraitSize : 0);
 const height = Math.max(DIALOGUE_LAYOUT_LIMITS.minHeight, contentHeight + DIALOGUE_LAYOUT_LIMITS.paddingY * 2);
 const y = DIALOGUE_LAYOUT_LIMITS.bottom - height;
 if (y < DIALOGUE_LAYOUT_LIMITS.safeTop) {
 throw new RangeError(
 `Dialogue content requires ${height}px but only ${DIALOGUE_LAYOUT_LIMITS.bottom - DIALOGUE_LAYOUT_LIMITS.safeTop}px is available.`,
 );
 }

 const textOffset = hasPortrait ? DIALOGUE_LAYOUT_LIMITS.portraitTextOffset : 0;
 const textStyle = dialogueTextLayoutStyle(hasPortrait);
 return {
 x: DIALOGUE_LAYOUT_LIMITS.x,
 y,
 width: DIALOGUE_LAYOUT_LIMITS.width,
 height,
 textX: DIALOGUE_LAYOUT_LIMITS.x + DIALOGUE_LAYOUT_LIMITS.paddingX + textOffset,
 textY: y + DIALOGUE_LAYOUT_LIMITS.paddingY,
 textWidth: textStyle.wordWrapWidth,
 portraitX: DIALOGUE_LAYOUT_LIMITS.x + DIALOGUE_LAYOUT_LIMITS.paddingX,
 portraitY: y + DIALOGUE_LAYOUT_LIMITS.paddingY,
 portraitSize: DIALOGUE_LAYOUT_LIMITS.portraitSize,
 };
}

export function createLayers(app: Application): RenderLayers {
 const tiles = new Graphics();
 app.stage.addChild(tiles);
 const tileSprites = new Container();
 app.stage.addChild(tileSprites);
 const entities = new Graphics();
 app.stage.addChild(entities);
 const sceneSprites = new Container();
 app.stage.addChild(sceneSprites);
 const hotbarIconBg = new Graphics();
 app.stage.addChild(hotbarIconBg);
 const hotbarIcon = new Sprite();
 hotbarIcon.visible = false;
 app.stage.addChild(hotbarIcon);
 const panelPreviewBg = new Graphics();
 panelPreviewBg.visible = false;
 app.stage.addChild(panelPreviewBg);
 const panelPreviewIcon = new Sprite();
 panelPreviewIcon.visible = false;
 app.stage.addChild(panelPreviewIcon);
 const panelPreviewText = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 12, fill: 0xeae0c8, wordWrap: true, breakWords: true, wordWrapWidth: 148, lineHeight: 18 },
 });
 panelPreviewText.x = 780;
 panelPreviewText.y = 332;
 panelPreviewText.visible = false;
 app.stage.addChild(panelPreviewText);
 const seasonTint = new Graphics();
 app.stage.addChild(seasonTint);
 const particles = new Graphics();
 app.stage.addChild(particles);
 const locationPreviewBg = new Graphics();
 locationPreviewBg.visible = false;
 app.stage.addChild(locationPreviewBg);
 const locationPreviewImage = new Sprite();
 locationPreviewImage.visible = false;
 app.stage.addChild(locationPreviewImage);
 const locationPreviewNpcPrimary = new Sprite();
 locationPreviewNpcPrimary.visible = false;
 app.stage.addChild(locationPreviewNpcPrimary);
 const locationPreviewNpcSecondary = new Sprite();
 locationPreviewNpcSecondary.visible = false;
 app.stage.addChild(locationPreviewNpcSecondary);
 const locationPreviewText = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 11, fill: 0xeae0c8, wordWrap: true, breakWords: true, wordWrapWidth: 144, lineHeight: 15 },
 });
 locationPreviewText.x = 776;
 locationPreviewText.y = 86;
 locationPreviewText.visible = false;
 app.stage.addChild(locationPreviewText);
 const endingImage = new Sprite();
 endingImage.anchor.set(0.5);
 endingImage.x = app.screen.width / 2;
 endingImage.y = app.screen.height / 2;
 endingImage.visible = false;
 app.stage.addChild(endingImage);
 const hud = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 15, fill: 0xeae0c8 },
 });
 hud.x = 10;
 hud.y = 8;
 app.stage.addChild(hud);
 const briefingBg = new Graphics();
 app.stage.addChild(briefingBg);
 const briefingImage = new Sprite();
 briefingImage.visible = false;
 app.stage.addChild(briefingImage);
 const briefingIcon = new Sprite();
 briefingIcon.visible = false;
 app.stage.addChild(briefingIcon);
 const briefing = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 11, fill: 0xeae0c8, wordWrap: true, breakWords: true, wordWrapWidth: 176, lineHeight: 16 },
 });
 briefing.x = app.screen.width - 198;
 briefing.y = 16;
 app.stage.addChild(briefing);
 const toastIconBg = new Graphics();
 app.stage.addChild(toastIconBg);
 const toastIcon = new Sprite();
 toastIcon.visible = false;
 app.stage.addChild(toastIcon);
 const toast = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 14, fill: 0xffe066, wordWrap: true, breakWords: true, wordWrapWidth: SCREEN_W - 56, lineHeight: 17 },
 });
 toast.x = 10;
 toast.y = app.screen.height - 88;
 app.stage.addChild(toast);
 const help = new Text({
 text: t('ui.help.default'),
 style: { fontFamily: CJK_FONT, fontSize: 10, fill: 0x9090a0 },
 });
 help.x = 10;
 help.y = app.screen.height - 20;
 app.stage.addChild(help);
 const ending = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 52, fill: 0xffe066, align: 'center', stroke: { color: 0x000000, width: 4 } },
 });
 ending.anchor.set(0.5);
 ending.x = app.screen.width / 2;
 ending.y = app.screen.height / 2;
 ending.visible = false;
 app.stage.addChild(ending);
 const inv = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 13, fill: 0xeae0c8 },
 });
 inv.x = app.screen.width - 190;
 inv.y = 70;
 inv.visible = false;
 app.stage.addChild(inv);
 const invIcons = new Container();
 invIcons.visible = false;
 app.stage.addChild(invIcons);
 const cultivation = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 13, fill: 0xeae0c8, lineHeight: 20 },
 });
 cultivation.x = app.screen.width - 286;
 cultivation.y = 70;
 cultivation.visible = false;
 app.stage.addChild(cultivation);
 const hotbar = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 12, fill: 0xd8d0ba },
 });
 hotbar.x = 46;
 hotbar.y = app.screen.height - 42;
 app.stage.addChild(hotbar);
 const bars = new Graphics();
 app.stage.addChild(bars);
 const tribFlash = new Graphics();
 app.stage.addChild(tribFlash);
	const dialogueBg = new Graphics();
	dialogueBg.visible = false;
	app.stage.addChild(dialogueBg);
 const dialoguePortrait = new Sprite();
 dialoguePortrait.visible = false;
 app.stage.addChild(dialoguePortrait);
 const dialogue = new Text({
 text: '',
 style: { fontFamily: CJK_FONT, fontSize: 15, fill: 0xeae0c8, ...dialogueTextLayoutStyle(false) },
 });
 dialogue.x = 58;
 dialogue.y = 314;
 app.stage.addChild(dialogue);
 const barLabels = [t('ui.hud.hp'), t('ui.hud.pillPoison'), t('ui.hud.cultivation'), t('ui.hud.stamina')].map((label, i) => {
 const t = new Text({ text: label, style: { fontFamily: CJK_FONT, fontSize: 11, fill: 0xb0b0c8 } });
 t.x = 12 + i * 152;
 t.y = 26;
 app.stage.addChild(t);
 return t;
 });
 return {
 tiles,
 tileSprites,
 entities,
 sceneSprites,
 hotbarIconBg,
 hotbarIcon,
 panelPreviewBg,
 panelPreviewIcon,
 panelPreviewText,
 locationPreviewBg,
 locationPreviewImage,
 locationPreviewNpcPrimary,
 locationPreviewNpcSecondary,
 locationPreviewText,
 hud,
 briefingBg,
 briefingImage,
 briefingIcon,
 briefing,
 toastIconBg,
 toastIcon,
 toast,
 help,
 ending,
 endingImage,
 inv,
 invIcons,
 cultivation,
 hotbar,
 bars,
 barLabels,
 showInv: false,
 furnaceHeat: 50,
 tribFlash,
 tribFlashTtl: 0,
 dialogueBg,
 dialoguePortrait,
 dialogue,
 seasonTint,
 particles,
 particleList: [],
 };
}

export function screenPointForTile(x: number, y: number): { x: number; y: number } {
 return {
 x: OX + x * TILE + TILE / 2,
 y: OY + y * TILE + TILE / 2,
 };
}

function layoutEndingImage(sprite: Sprite): void {
 const { width, height } = sprite.texture;
 if (width <= 0 || height <= 0) return;
 const scale = Math.max(SCREEN_W / width, SCREEN_H / height);
 sprite.scale.set(scale);
}

function applyWorldSprite(sprite: Sprite, texture: Texture, x: number, y: number, size = TILE): void {
 sprite.texture = texture;
 sprite.anchor.set(0.5);
 sprite.x = x;
 sprite.y = y;
 sprite.width = size;
 sprite.height = size;
}

function cropWorldSpriteSpec(stage: string): { size: number; yOffset: number } {
 switch (stage) {
 case 'seed':
 return { size: 16, yOffset: 7 };
 case 'sprout':
 return { size: 20, yOffset: 6 };
 case 'growing':
 return { size: 28, yOffset: 5 };
 case 'mature':
 return { size: 32, yOffset: 4 };
 default:
 return { size: 24, yOffset: 5 };
 }
}

function applyPanelSprite(sprite: Sprite, texture: Texture, x: number, y: number, size: number): void {
 sprite.texture = texture;
 sprite.x = x;
 sprite.y = y;
 sprite.width = size;
 sprite.height = size;
}

export function isBriefingHeroAsset(assetId?: string): boolean {
 if (!assetId) return false;
 return assetId.startsWith('loc.')
 || assetId.startsWith('sprite.npc.')
 || assetId.startsWith('facility.')
 || assetId === 'tile.scorched'
 || assetId === 'logo.full'
 || assetId === 'logo.emblem';
}

export function facilityWorldBadgeAssetId(outputItemId?: string): string | undefined {
 return outputItemId ? itemIconAssetId(outputItemId) : undefined;
}

function firstNonZeroRecordItem(items: Record<string, number>): string | undefined {
 return Object.entries(items)
 .find(([, count]) => count > 0)?.[0];
}

export function farmsteadPropBadgeAssetId(state: GameState, assetId: 'facility.storage-chest' | 'facility.shipping-bin'): string | undefined {
 if (assetId === 'facility.shipping-bin') {
 const normalItemId = firstNonZeroRecordItem(state.shippingBin);
 if (normalItemId) return itemIconAssetId(normalItemId);

for (const batch of Object.values(state.qualityShippingBin)) {
 const qualityItemId = firstNonZeroRecordItem(batch ?? {});
 if (qualityItemId) return itemIconAssetId(qualityItemId);
 }

return undefined;
 }

const storageItemId = Object.entries(state.storage.inventory)
 .find(([, slot]) => (slot?.count ?? 0) > 0)?.[0];
 if (storageItemId) return itemIconAssetId(storageItemId);

for (const batch of Object.values(state.storage.qualityInventory)) {
 const qualityItemId = firstNonZeroRecordItem(batch ?? {});
 if (qualityItemId) return itemIconAssetId(qualityItemId);
 }

return undefined;
}

export function locationTaskWorldBadgeAssetId(taskAssetId?: string): string | undefined {
 return taskAssetId?.startsWith('icon.') || taskAssetId?.startsWith('facility.') ? taskAssetId : undefined;
}

export function locationServiceWorldBadgeAssetId(serviceAssetId?: string): string | undefined {
 return serviceAssetId?.startsWith('icon.') || serviceAssetId?.startsWith('sprite.npc.')
 ? serviceAssetId
 : undefined;
}

export interface LocationWorldBadgeLayout {
 birthday: { x: number; y: number };
 quest: { x: number; y: number };
 service: { x: number; y: number };
 task: { x: number; y: number };
 crowd: { x: number; y: number };
}

export function locationWorldBadgeLayout(options: {
 hasBirthday: boolean;
 hasQuest: boolean;
 hasService: boolean;
 hasTask: boolean;
 npcCount: number;
}): LocationWorldBadgeLayout {
 const bottomLeft = options.hasService ? { x: 10, y: TILE - 10 } : { x: 9, y: TILE - 9 };
 const bottomRight = options.npcCount > 1 ? { x: TILE - 19, y: TILE - 10 } : { x: TILE - 10, y: TILE - 10 };
 const taskAnchor = options.hasService || options.npcCount > 1 ? bottomRight : bottomLeft;

return {
 birthday: { x: 10, y: 10 },
 quest: { x: TILE - 10, y: 10 },
 service: bottomLeft,
 task: taskAnchor,
 crowd: { x: TILE - 15, y: TILE - 15 },
 };
}

function clearSceneSprites(layers: RenderLayers): void {
	for (const child of layers.sceneSprites.removeChildren()) {
	child.destroy();
 }
}

function clearTileSprites(layers: RenderLayers): void {
	for (const child of layers.tileSprites.removeChildren()) {
	child.destroy();
 }
}

function clearInventoryIcons(layers: RenderLayers): void {
	for (const child of layers.invIcons.removeChildren()) {
	child.destroy();
 }
 layers.invIcons.visible = false;
}

function drawInventoryIconStrip(layers: RenderLayers, state: GameState, content: ContentRegistry, assets?: RuntimeRenderAssets, ctx?: SimContext): void {
 clearInventoryIcons(layers);
 const entries = inventoryIconStripEntries(state, content, ctx)
 .filter((entry) => assets?.itemIcons[entry.iconId])
 .slice(0, 10);
 if (entries.length === 0) return;

const root = layers.invIcons;
 const startX = SCREEN_W - 248;
 const startY = 78;
 const gapY = 34;
 const qualityTint: Record<string, number> = {
 treasure: 0xf4d35e,
 spirit: 0x7ad7f0,
 mortal: 0xb8a98a,
 };

entries.forEach((entry, index) => {
 const texture = assets?.itemIcons[entry.iconId];
 if (!texture) return;
 const y = startY + index * gapY;
 const bg = new Graphics();
 const sectionColor = entry.section === 'inventory'
 ? 0x3e6b3b
 : entry.section === 'storage'
 ? 0x5a4e8a
 : 0x8a5a3a;
 bg.roundRect(startX, y, 28, 28, 6).fill({ color: 0x12121c, alpha: 0.94 });
 bg.roundRect(startX, y, 28, 28, 6).stroke({ width: 1.1, color: sectionColor, alpha: 0.92 });
 root.addChild(bg);

const sprite = new Sprite(texture);
 sprite.anchor.set(0.5);
 sprite.x = startX + 14;
 sprite.y = y + 14;
 const scale = Math.min(20 / texture.width, 20 / texture.height);
 sprite.scale.set(scale);
 root.addChild(sprite);

const countBg = new Graphics();
 countBg.roundRect(startX + 16, y + 16, 16, 12, 4).fill({ color: 0x0d0d14, alpha: 0.92 });
 root.addChild(countBg);

const countText = new Text({
 text: `${entry.count}`,
 style: { fontFamily: CJK_FONT, fontSize: 9, fill: 0xeae0c8, align: 'center' },
 });
 countText.anchor.set(0.5);
 countText.x = startX + 24;
 countText.y = y + 22;
 root.addChild(countText);

if (entry.quality) {
 const quality = new Graphics();
 quality.circle(startX + 4, y + 4, 3).fill({ color: qualityTint[entry.quality] ?? 0xeae0c8, alpha: 0.95 });
 root.addChild(quality);
 }
 });

root.visible = true;
}

/** 触发天劫闪光（T3b）。ttl 帧后自动衰减。 */
export function triggerTribFlash(layers: RenderLayers, frames = 30): void {
 layers.tribFlashTtl = frames;
}

/** 在 (x,y) 迸发 count 个粒子（T9 程序化视效）。渲染层非确定性，不影响 sim。 */
export function spawnBurst(layers: RenderLayers, x: number, y: number, count: number, color: number, speed = 2.5): void {
 // 上限保护：避免长时间堆积拖慢渲染
 if (layers.particleList.length > 320) layers.particleList.splice(0, layers.particleList.length - 320);
 for (let i = 0; i < count; i++) {
	const a = Math.random() * Math.PI * 2;
 const s = Math.random() * speed + 0.4;
 const maxLife = 28 + Math.random() * 22;
 layers.particleList.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: maxLife, maxLife, color, size: 1 + Math.random() * 2.2 });
 }
}

/** 推进并绘制粒子（每帧调用）。重力下坠 + 寿命衰减 + 透明度。 */
export function updateParticles(layers: RenderLayers): void {
 const g = layers.particles;
	g.clear();
 const ps = layers.particleList;
 for (let i = ps.length - 1; i >= 0; i--) {
 const p = ps[i]!;
 p.x += p.vx;
 p.y += p.vy;
 p.vy += 0.06; // 轻微下坠
 p.life -= 1;
 if (p.life <= 0) {
 ps.splice(i, 1);
 continue;
 }
 g.circle(p.x, p.y, p.size).fill({ color: p.color, alpha: Math.max(0, p.life / p.maxLife) });
 }
}

/** 画一根水平条（背景 + 填充 + 描边）。pct 钳到 [0,1]。 */
function drawBar(g: Graphics, x: number, y: number, w: number, h: number, pct: number, fill: number): void {
 g.rect(x, y, w, h).fill({ color: 0x1a1a22, alpha: 0.9 });
 const fw = Math.max(0, Math.min(1, pct)) * (w - 2);
 if (fw > 0) g.rect(x + 1, y + 1, fw, h - 2).fill(fill);
 g.rect(x, y, w, h).stroke({ width: 1, color: 0x3a3a44 });
}

const INV_GROUPS: Array<{ prefix: string; titleKey: string }> = [
 { prefix: 'seed.', titleKey: 'ui.hud.invSeed' },
 { prefix: 'herb.', titleKey: 'ui.hud.invHerb' },
 { prefix: 'pill.', titleKey: 'ui.hud.invPill' },
 { prefix: 'item.', titleKey: 'ui.hud.invMisc' },
];

const QUALITY_LABEL: Record<CropQuality, string> = {
 mortal: '凡品',
 spirit: '灵品',
 treasure: '珍品',
};

const QUALITY_ORDER: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];

/** 背包按类目分组渲染（种子/灵草/丹药/杂物/其他）。 */
export function renderInventory(state: GameState, content: ContentRegistry): string {
 const entries = Object.entries(state.player.inventory).filter(([, s]) => s && s.count > 0);
 const qualityEntries = QUALITY_ORDER.flatMap((quality) => {
 const batch = state.player.qualityInventory?.[quality] ?? {};
 return Object.entries(batch)
 .filter(([, count]) => count > 0)
 .map(([id, count]) => ({ id, count, quality }));
 });
 const used = entries.length + qualityEntries.length;
 const title = `${t('ui.hud.invTitle')} ${used}/${state.player.inventoryCapacity}`;
 if (entries.length === 0 && qualityEntries.length === 0) return `${title}\n${t('ui.hud.invEmpty')}`;
 const lines: string[] = [title];
 const grouped = new Map<string, Array<[string, number]>>();
 const others: Array<[string, number]> = [];
 for (const [id, slot] of entries) {
 const name = content.items.get(id)?.displayName ?? id;
 const grp = INV_GROUPS.find((g) => id.startsWith(g.prefix));
 if (grp) {
 const title = t(grp.titleKey);
 (grouped.get(title) ?? grouped.set(title, []).get(title)!).push([name, slot.count]);
 } else others.push([name, slot.count]);
 }
 if (qualityEntries.length > 0) {
 lines.push('[品质灵草]');
 for (const entry of qualityEntries) {
 const name = content.items.get(entry.id)?.displayName ?? entry.id;
 lines.push(` ${name}·${QUALITY_LABEL[entry.quality]} ×${entry.count}`);
 }
 }
 for (const g of INV_GROUPS) {
 const title = t(g.titleKey);
 const arr = grouped.get(title);
 if (arr) lines.push(`[${title}]`, ...arr.map(([n, c]) => ` ${n} ×${c}`));
 }
 if (others.length) lines.push(`[${t('ui.hud.invOther')}]`, ...others.map(([n, c]) => ` ${n} ×${c}`));
 return lines.join('\n');
}

/** 仓库按普通物品/品质灵草渲染，用于背包面板的农庄箱子视图。 */
export function renderStorage(state: GameState, content: ContentRegistry): string {
 const normalEntries = Object.entries(state.storage.inventory).filter(([, s]) => s && s.count > 0);
 const qualityEntries = QUALITY_ORDER.flatMap((quality) => {
 const batch = state.storage.qualityInventory?.[quality] ?? {};
 return Object.entries(batch)
 .filter(([, count]) => count > 0)
 .map(([id, count]) => ({ id, count, quality }));
 });
 const title = `—— 仓库 —— ${storageUsed(state.storage)}/${state.storage.capacity}`;
 if (normalEntries.length === 0 && qualityEntries.length === 0) return `${title}\n（空）`;
 const lines: string[] = [title];
 if (normalEntries.length > 0) {
 lines.push('[物资]');
 for (const [id, slot] of normalEntries) {
 const name = content.items.get(id)?.displayName ?? id;
 lines.push(` ${name} ×${slot.count}`);
 }
 }
 if (qualityEntries.length > 0) {
 lines.push('[品质灵草]');
 for (const entry of qualityEntries) {
 const name = content.items.get(entry.id)?.displayName ?? entry.id;
 lines.push(` ${name}·${QUALITY_LABEL[entry.quality]} ×${entry.count}`);
 }
 }
 return lines.join('\n');
}

/** 当日出货箱渲染：展示普通与品质批次，日终统一结算。 */
export function renderShippingBin(state: GameState, content: ContentRegistry, ctx: SimContext): string {
 const lines = shippingLines(state, ctx);
 const total = lines.reduce((sum, line) => sum + line.total, 0);
 const title = `—— 出货箱 —— 预计灵石 ${total}`;
 if (lines.length === 0) return `${title}\n（空）`;
 const rows = [title];
 for (const line of lines) {
 const name = content.items.get(line.itemId)?.displayName ?? line.itemId;
 const q = line.quality ? `·${QUALITY_LABEL[line.quality]}` : '';
 const demand = marketDemandForItem(state, line.itemId);
 const demandTag = demand ? ` ${renderDemandTag(demand.source, demand.priceBonus)}` : '';
 rows.push(` ${name}${q} ×${line.count} @${line.unitPrice} = ${line.total}${demandTag}`);
 }
 return rows.join('\n');
}

function renderDemandTag(source: 'commission' | 'special-order', bonus: number): string {
 const label = source === 'special-order' ? '订单热需' : '委托热需';
 return `〔${label}+${bonus}〕`;
}

export function renderPostAscensionGoals(state: GameState): string {
 return renderStayingWorldGoals(state);
}

export function renderCultivationOverview(state: GameState, ctx: SimContext): string {
 const p = state.player;
 const stageNames = tList('ui.hud.stages');
 const stageName = stageNames[p.stage] ?? `${p.stage}`;
 const frozen = state.postAscension.mode === 'stayed-in-world';
 const victoryRecorded = state.postAscension.victoryRecorded;
	const nextCap = p.stage >= 1 && p.stage <= 6 ? bodyFoundationCap(p.stage, ctx.params) : null;
 const foundationText = nextCap == null
 ? `${Math.round(p.bodyFoundation / 1000)}`
 : `${Math.round(p.bodyFoundation / 1000)} / ${Math.round(nextCap / 1000)}`;
 const tribulationState = frozen
 ? '留驻此界后境界已止步'
	: readyToInvokeTribulation(state, ctx.params)
 ? '可主动引劫'
 : state.tribulation.status === 'countdown'
 ? `天劫将至：${state.tribulation.daysRemaining}日`
 : state.tribulation.status === 'due'
 ? '天劫已临门'
 : '尚未满足引劫条件';
 const fateState = frozen
 ? (victoryRecorded ? '已登天门｜留世守境' : '留世守境')
 : `因果债 ${Math.round(p.heavenDebt / 1000)}｜天道注视 ${Math.round(p.daoAttention / 1000)}`;
 const victoryText = frozen && victoryRecorded ? '胜后存档：已完成飞升，可继续留世经营' : null;
 return [
 '—— 功法 / 修炼 ——',
 '《偷天换劫诀》',
 `阶段：${stageName}`,
 `体魄根基：${foundationText}`,
 `耐力：${Math.round(p.endurance / 1000)}｜意志：${Math.round(p.willpower / 1000)}`,
 `寿元：${p.lifespanRemainingDays}日`,
 `命数：${fateState}`,
 `劫势：${tribulationState}`,
 ...(victoryText ? [victoryText] : []),
 '',
 'C / Esc 关闭',
 'T 主动引劫，Shift+1/2/3/0 苦练',
 ].join('\n');
}

export function drawWorld(
 layers: RenderLayers,
 state: GameState,
 content: ContentRegistry,
 ctx?: SimContext,
 assets?: RuntimeRenderAssets,
): void {
 // —— 瓦片 + 作物 ——
 const g = layers.tiles;
	g.clear();
 clearTileSprites(layers);
 clearSceneSprites(layers);
 for (const t of state.tiles) {
 const x = OX + t.x * TILE;
 const y = OY + t.y * TILE;
 const crop = t.cropId != null ? state.crops.get(t.id) : undefined;
 const readiness = tileReadinessState(t, crop);
 const insulationCovered = hasActiveArrayCoverage(state, t.id, 'array.insulation');
 const tileTexture = assets?.tiles[tileAssetId(t, { insulationCovered })];
 if (tileTexture) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, tileTexture, x + TILE / 2, y + TILE / 2, TILE - 1);
 sprite.alpha = 0.96;
 layers.tileSprites.addChild(sprite);
 g.rect(x, y, TILE - 1, TILE - 1).fill({ color: 0x111118, alpha: 0.18 });
 } else {
 g.rect(x, y, TILE - 1, TILE - 1).fill(SOIL_COLOR[t.soilType] ?? 0x6b4f2a);
 }
 if (t.tilled) g.rect(x + 3, y + 3, TILE - 7, TILE - 7).fill(0x4a3318);
 const tileState = tileVisualState(t);
 if (tileState.dampAlpha > 0) {
 g.rect(x + 3, y + 3, TILE - 7, TILE - 7).fill({ color: 0x2f5675, alpha: tileState.dampAlpha });
 }
 if (tileState.qiGlowAlpha > 0) {
 g.rect(x + 6, y + 6, TILE - 13, TILE - 13).stroke({ width: 1.5, color: 0x66ddff, alpha: tileState.qiGlowAlpha });
 }
 if (tileState.showWaterMark) {
 g.circle(x + 11, y + TILE - 11, 3).fill({ color: 0x7ec8ff, alpha: 0.9 });
 g.circle(x + 18, y + TILE - 14, 2).fill({ color: 0xbfe8ff, alpha: 0.82 });
 }
 if (tileState.showChannelMark) {
 g.poly([
 x + TILE - 12, y + 9,
 x + TILE - 8, y + 15,
 x + TILE - 12, y + 21,
 x + TILE - 16, y + 15,
 ]).fill({ color: 0x66ddff, alpha: 0.88 });
 g.poly([
 x + TILE - 12, y + 11,
 x + TILE - 10, y + 15,
 x + TILE - 12, y + 19,
 x + TILE - 14, y + 15,
 ]).fill({ color: 0xe8f8ff, alpha: 0.7 });
 }
 if (readiness.showPlantCue) {
 g.circle(x + TILE / 2, y + TILE / 2 + 1, 4).stroke({ width: 1.5, color: 0x8bd450, alpha: 0.82 });
 g.moveTo(x + TILE / 2, y + 11).lineTo(x + TILE / 2, y + TILE - 11).stroke({ width: 1.2, color: 0xbfe88f, alpha: 0.72 });
 g.moveTo(x + 11, y + TILE / 2).lineTo(x + TILE - 11, y + TILE / 2).stroke({ width: 1.2, color: 0xbfe88f, alpha: 0.72 });
 }
 if (readiness.showTillCue) {
 g.moveTo(x + 10, y + 13).lineTo(x + TILE - 10, y + 13).stroke({ width: 1.1, color: 0xd8b070, alpha: 0.56 });
 g.moveTo(x + 10, y + 21).lineTo(x + TILE - 10, y + 21).stroke({ width: 1.1, color: 0xd8b070, alpha: 0.56 });
 g.moveTo(x + 10, y + 29).lineTo(x + TILE - 10, y + 29).stroke({ width: 1.1, color: 0xd8b070, alpha: 0.56 });
 }
 if (readiness.showBlockedCue) {
 g.moveTo(x + 9, y + 9).lineTo(x + TILE - 9, y + TILE - 9).stroke({ width: 1.35, color: 0x2a1a10, alpha: 0.42 });
 g.moveTo(x + TILE - 9, y + 9).lineTo(x + 9, y + TILE - 9).stroke({ width: 1.35, color: 0x2a1a10, alpha: 0.42 });
 }
 if (crop) {
 const herb = content.herbs.get(crop.defId);
 const cx = x + TILE / 2;
 const cy = y + TILE / 2;
 const metal = (herb?.metalAttract ?? 0) > 1;
 if (crop.stage === 'withered') {
 // 枯萎：棕色 X
 g.moveTo(cx - 6, cy - 6).lineTo(cx + 6, cy + 6).moveTo(cx + 6, cy - 6).lineTo(cx - 6, cy + 6).stroke({ width: 2, color: STAGE_COLOR.withered });
 } else {
 const fallbackRadius = crop.stage === 'seed' ? 3 : crop.stage === 'sprout' ? 6 : crop.stage === 'growing' ? 9 : 12;
 const texture = crop.stage === 'seed'
 ? assets?.cropSeeds[herb?.seedId ?? '']
 : assets?.cropHerbs[crop.defId];
 if (texture) {
 const sprite = new Sprite();
 const spec = cropWorldSpriteSpec(crop.stage);
 applyWorldSprite(sprite, texture, cx, cy + spec.yOffset, spec.size);
 if (metal) sprite.tint = 0xc9d4ea;
 layers.sceneSprites.addChild(sprite);
 } else {
 // 回退路径：保留原始程序化图元，保证无贴图时仍可稳定演示
 const col = metal ? 0xb8b8c8 : STAGE_COLOR[crop.stage] ?? 0x4a9a30;
 if (crop.stage === 'growing' || crop.stage === 'mature') {
 g.moveTo(cx, cy + fallbackRadius).lineTo(cx, y + TILE - 3).stroke({ width: 1.5, color: 0x3a6a28 });
 }
 g.circle(cx, cy, fallbackRadius).fill(col);
 }
 if (readiness.showHarvestHalo) {
 g.circle(cx, cy, fallbackRadius + 3).stroke({ width: 1.5, color: 0xffe066, alpha: 0.75 });
 g.circle(cx, cy, fallbackRadius + 6).stroke({ width: 1, color: 0xfff2a8, alpha: 0.45 });
 }
 }
 }
 }

// —— 农庄设施：加工链从菜单入口落到具体地块 ——
 for (const placement of guardBeastPreviewPlacements(state)) {
 const x = OX + placement.x * TILE;
 const y = OY + placement.y * TILE;
 const guardTexture = assets?.guardBeastVariants?.[guardBeastPreviewAssetId(placement.beastId)] ?? assets?.guardBeast;
 if (guardTexture) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, guardTexture, x + TILE / 2, y + TILE / 2 + 2, TILE - 6);
 sprite.alpha = 0.7 + placement.vigorRatio * 0.3;
 layers.sceneSprites.addChild(sprite);
 } else {
 g.circle(x + TILE / 2, y + TILE / 2 + 2, 11).fill({ color: 0x8ac4ff, alpha: 0.82 });
 g.circle(x + TILE / 2, y + TILE / 2 + 2, 11).stroke({ width: 1.5, color: 0x16263a });
 g.circle(x + TILE / 2 - 4, y + TILE / 2 - 1, 2).fill(0x16263a);
 g.circle(x + TILE / 2 + 4, y + TILE / 2 - 1, 2).fill(0x16263a);
 g.rect(x + 13, y + TILE - 10, TILE - 26, 3).fill({ color: 0x1a1a22, alpha: 0.85 });
 g.rect(x + 13, y + TILE - 10, Math.max(3, (TILE - 26) * placement.vigorRatio), 3).fill(0x7ac050);
 }

const specialty = placement.specialty;
 if (specialty) {
 const marker = GUARD_BEAST_SPECIALTY_MARKER[specialty];
 const mx = x + TILE - 11;
 const my = y + 11;
 g.circle(mx, my, 5).fill({ color: marker.color, alpha: 0.94 });
 g.circle(mx, my, 5).stroke({ width: 1, color: 0x1a1a22, alpha: 0.94 });
 if (specialty === 'field-ward') {
 g.moveTo(mx, my - 2).lineTo(mx, my + 2).stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
 g.moveTo(mx - 2, my).lineTo(mx + 2, my).stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
 } else if (specialty === 'array-warden') {
 g.moveTo(mx - 2, my - 2).lineTo(mx + 2, my + 2).stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
 g.moveTo(mx + 2, my - 2).lineTo(mx - 2, my + 2).stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
 } else {
 g.moveTo(mx - 2, my + 2).lineTo(mx + 1, my - 1).stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
 g.moveTo(mx + 1, my - 1).lineTo(mx + 2, my).stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
 }
 }
 }

for (const prop of farmsteadPropPlacements(state)) {
 const x = OX + prop.x * TILE;
 const y = OY + prop.y * TILE;
 const texture = assets?.facilities[prop.assetId.slice('facility.'.length)];
 if (texture) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, texture, x + TILE / 2, y + TILE / 2 + 1, TILE - 8);
 sprite.alpha = 0.9;
 layers.sceneSprites.addChild(sprite);
 } else {
 const color = prop.assetId === 'facility.storage-chest' ? 0x8b6a3f : 0x7a4f2a;
 g.roundRect(x + 9, y + 10, TILE - 18, TILE - 16, 5).fill({ color, alpha: 0.92 });
 g.roundRect(x + 9, y + 10, TILE - 18, TILE - 16, 5).stroke({ width: 1.5, color: 0x2a1a0a });
 g.rect(x + 12, y + 16, TILE - 24, 4).fill({ color: 0xd9c38a, alpha: 0.85 });
 }

if (prop.status === 'ready') {
 const badgeTexture = assets?.itemIcons[farmsteadPropBadgeAssetId(state, prop.assetId) ?? ''];
 if (badgeTexture) {
 g.circle(x + TILE - 10, y + 10, 7).fill({ color: 0x12121c, alpha: 0.9 });
 g.circle(x + TILE - 10, y + 10, 7).stroke({ width: 1.2, color: 0x7fe38b, alpha: 0.94 });
 const badge = new Sprite();
 applyWorldSprite(badge, badgeTexture, x + TILE - 10, y + 10, 12);
 layers.sceneSprites.addChild(badge);
 } else {
 g.circle(x + TILE - 10, y + 10, 5).fill(0x7fe38b);
 g.circle(x + TILE - 10, y + 10, 5).stroke({ width: 1.2, color: 0x1a1a22, alpha: 0.92 });
 }
 }
 }

for (const facility of state.facilities.values()) {
 const tile = state.tiles[facility.tileId];
 if (!tile) continue;
 const x = OX + tile.x * TILE;
 const y = OY + tile.y * TILE;
 const color = FACILITY_COLOR[facility.kind] ?? 0xb0b0b0;
 const facilityTexture = assets?.facilities[facility.kind];
 if (facilityTexture) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, facilityTexture, x + TILE / 2, y + TILE / 2);
 layers.sceneSprites.addChild(sprite);
 } else {
 g.rect(x + 7, y + 9, TILE - 15, TILE - 14).fill({ color, alpha: 0.92 });
 g.rect(x + 7, y + 9, TILE - 15, TILE - 14).stroke({ width: 1.5, color: 0x2a1a0a });
 if (facility.kind === 'drying-rack') {
 g.moveTo(x + 11, y + 17).lineTo(x + TILE - 11, y + 17).stroke({ width: 2, color: 0x6b4f2a });
 g.moveTo(x + 11, y + 25).lineTo(x + TILE - 11, y + 25).stroke({ width: 2, color: 0x6b4f2a });
 } else if (facility.kind === 'sealing-cabinet') {
 g.rect(x + 17, y + 13, 8, TILE - 22).stroke({ width: 1.5, color: 0x1a2a36 });
 g.circle(x + 26, y + TILE / 2, 2).fill(0xeae0c8);
 } else if (facility.kind === 'talisman-furnace') {
 g.circle(x + TILE / 2, y + TILE / 2, 10).stroke({ width: 2, color: 0x3a1610 });
 g.circle(x + TILE / 2, y + TILE / 2, 5).fill(0xffd166);
 g.rect(x + 14, y + TILE - 14, TILE - 28, 4).fill(0x3a1610);
 }
 }
 if (facility.job) {
 const done = facility.job.daysRemaining <= 0;
 const badgeTexture = done
 ? assets?.itemIcons[facilityWorldBadgeAssetId(facility.job.outputItemId) ?? '']
 : undefined;
 if (done && badgeTexture) {
 g.circle(x + TILE - 9, y + 9, 7).fill({ color: 0x12121c, alpha: 0.9 });
 g.circle(x + TILE - 9, y + 9, 7).stroke({ width: 1.2, color: 0xffe066, alpha: 0.94 });
 const badge = new Sprite();
 applyWorldSprite(badge, badgeTexture, x + TILE - 9, y + 9, 12);
 layers.sceneSprites.addChild(badge);
 } else {
 g.circle(x + TILE - 9, y + 9, 5).fill(done ? 0xffe066 : 0x66ddff);
 g.circle(x + TILE - 9, y + 9, 5).stroke({ width: 1.1, color: 0x1a1a22, alpha: 0.92 });
 }
 if (!done) {
 g.rect(x + 9, y + TILE - 10, TILE - 18, 4).fill({ color: 0x1a1a22, alpha: 0.9 });
 g.rect(x + 10, y + TILE - 9, TILE - 20, 2).fill(0x66ddff);
 }
 }
 }

const e = layers.entities;
	e.clear();

for (const placement of locationWorldPreviewPlacements(state)) {
 const x = OX + placement.x * TILE;
 const y = OY + placement.y * TILE;
 const locationTexture = assets?.locations[placement.locationId];
 const badgeLayout = locationWorldBadgeLayout({
 hasBirthday: placement.birthday,
 hasQuest: placement.hasQuest,
 hasService: placement.serviceReady || placement.serviceDone,
 hasTask: placement.taskReady,
 npcCount: placement.npcCount,
 });

if (locationTexture) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, locationTexture, x + TILE / 2, y + TILE / 2, TILE - 4);
 sprite.alpha = 0.24;
 layers.sceneSprites.addChild(sprite);
 } else {
 e.roundRect(x + 3, y + 3, TILE - 7, TILE - 7, 7).fill({ color: 0x181824, alpha: 0.28 });
 e.roundRect(x + 3, y + 3, TILE - 7, TILE - 7, 7).stroke({ width: 1.2, color: 0x5a6a8a, alpha: 0.5 });
 }

if (placement.npcCount > 1) {
 e.roundRect(x + badgeLayout.crowd.x, y + badgeLayout.crowd.y, 11, 11, 4).fill({ color: 0x12121c, alpha: 0.9 });
 e.roundRect(x + badgeLayout.crowd.x, y + badgeLayout.crowd.y, 11, 11, 4).stroke({ width: 1, color: 0x6a5a2a, alpha: 0.85 });
 e.rect(x + badgeLayout.crowd.x + 4, y + badgeLayout.crowd.y + 4, 3, 3).fill({ color: 0xeae0c8, alpha: 0.9 });
 e.rect(x + badgeLayout.crowd.x + 4, y + badgeLayout.crowd.y + 8, 3, 3).fill({ color: 0xeae0c8, alpha: 0.9 });
 e.rect(x + badgeLayout.crowd.x + 8, y + badgeLayout.crowd.y + 4, 3, 3).fill({ color: 0xeae0c8, alpha: 0.9 });
 e.rect(x + badgeLayout.crowd.x + 8, y + badgeLayout.crowd.y + 8, 3, 3).fill({ color: 0xeae0c8, alpha: 0.9 });
 }

if (placement.birthday) {
 e.circle(x + badgeLayout.birthday.x, y + badgeLayout.birthday.y, 4).fill({ color: 0xffb347, alpha: 0.94 });
 e.circle(x + badgeLayout.birthday.x, y + badgeLayout.birthday.y, 4).stroke({ width: 1, color: 0x5a2d0c, alpha: 0.9 });
 }
 if (placement.hasQuest) {
 const color = placement.questReady ? 0xffe066 : 0x66ddff;
 e.rect(x + badgeLayout.quest.x - 4, y + badgeLayout.quest.y - 4, 7, 7).fill({ color, alpha: 0.94 });
 e.rect(x + badgeLayout.quest.x - 4, y + badgeLayout.quest.y - 4, 7, 7).stroke({ width: 1, color: 0x1a1a22, alpha: 0.92 });
 }
 if (placement.serviceReady || placement.serviceDone) {
 const color = placement.serviceReady ? 0x7fe38b : 0x9aa3b2;
 const alpha = placement.serviceReady ? 0.96 : 0.9;
 const serviceBadgeAssetId = locationServiceWorldBadgeAssetId(placement.serviceAssetId);
 const serviceBadgeTexture = serviceBadgeAssetId?.startsWith('sprite.npc.')
 ? assets?.npcs[serviceBadgeAssetId]
 : assets?.itemIcons[serviceBadgeAssetId ?? ''];
 if (serviceBadgeTexture) {
 e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 7).fill({ color: 0x12121c, alpha: 0.9 });
 e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 7).stroke({ width: 1.2, color, alpha: 0.94 });
 const badge = new Sprite();
 applyWorldSprite(badge, serviceBadgeTexture, x + badgeLayout.service.x, y + badgeLayout.service.y, 12);
 layers.sceneSprites.addChild(badge);
 } else {
 e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 4).fill({ color, alpha });
 e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 4).stroke({ width: 1, color: 0x1a1a22, alpha: 0.92 });
 }
 }
 if (placement.taskReady) {
 const taskBadgeAssetId = locationTaskWorldBadgeAssetId(placement.taskAssetId);
 const badgeTexture = taskBadgeAssetId?.startsWith('facility.')
 ? assets?.facilities[taskBadgeAssetId]
 : assets?.itemIcons[taskBadgeAssetId ?? ''];
 if (badgeTexture) {
 e.circle(x + badgeLayout.task.x, y + badgeLayout.task.y, 7).fill({ color: 0x12121c, alpha: 0.9 });
 e.circle(x + badgeLayout.task.x, y + badgeLayout.task.y, 7).stroke({ width: 1.2, color: 0xffd36b, alpha: 0.94 });
 const badge = new Sprite();
 applyWorldSprite(badge, badgeTexture, x + badgeLayout.task.x, y + badgeLayout.task.y, 12);
 layers.sceneSprites.addChild(badge);
 } else {
 e.rect(x + badgeLayout.task.x - 4, y + badgeLayout.task.y - 4, 8, 8).fill({ color: 0xffd36b, alpha: 0.95 });
 e.rect(x + badgeLayout.task.x - 4, y + badgeLayout.task.y - 4, 8, 8).stroke({ width: 1, color: 0x1a1a22, alpha: 0.92 });
 }
 }
 }

for (const placement of npcWorldPreviewPlacements(state)) {
 const x = OX + placement.x * TILE;
 const y = OY + placement.y * TILE;
 const npcTexture = assets?.npcs[placement.assetId];
 if (npcTexture) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, npcTexture, x + TILE / 2, y + TILE / 2 + 1, TILE - 8);
 sprite.alpha = 0.92;
 layers.sceneSprites.addChild(sprite);
 } else {
 const fallback = new Graphics();
 fallback.circle(x + TILE / 2, y + TILE / 2 + 1, 10).fill({ color: 0xd7c3a0, alpha: 0.88 });
 fallback.circle(x + TILE / 2, y + TILE / 2 + 1, 10).stroke({ width: 1.5, color: 0x33261a, alpha: 0.95 });
 layers.sceneSprites.addChild(fallback);
 }

const marker = new Graphics();

if (placement.birthday) {
 marker.circle(x + TILE - 10, y + 10, 4).fill({ color: 0xffb347, alpha: 0.94 });
 marker.circle(x + TILE - 10, y + 10, 4).stroke({ width: 1, color: 0x5a2d0c, alpha: 0.9 });
 }
 if (placement.hasQuest) {
 const color = placement.questReady ? 0xffe066 : 0x66ddff;
 marker.rect(x + 6, y + 6, 7, 7).fill({ color, alpha: 0.94 });
 marker.rect(x + 6, y + 6, 7, 7).stroke({ width: 1, color: 0x1a1a22, alpha: 0.92 });
 }
 if (placement.birthday || placement.hasQuest) layers.sceneSprites.addChild(marker);
 }

// —— 玩家 + 阵眼 + 面前格光标 ——
 // 阵法覆盖区 + 阵眼
 for (const arr of arrayWorldPreviewPlacements(state)) {
 const isRod = arr.assetId === 'facility.array-eye';
 const active = arr.status === 'active';
 const color = isRod ? 0xffe066 : 0x66ddff;
 // 覆盖圈半透明填色，让"种田即布防"的防护范围可见
 for (const tid of arr.coverageTileIds) {
 const ct = state.tiles[tid];
 if (!ct) continue;
 if (active) {
 e.rect(OX + ct.x * TILE, OY + ct.y * TILE, TILE - 1, TILE - 1).fill({ color, alpha: isRod ? 0.14 : 0.12 });
 }
 }
 const core = state.tiles[arr.tileId];
 if (!core) continue;
 const cx = OX + core.x * TILE + TILE / 2;
 const cy = OY + core.y * TILE + TILE / 2;
 const arrayTexture = assets?.facilities[arr.assetId.slice('facility.'.length)];
 if (arrayTexture) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, arrayTexture, cx, cy, TILE - 8);
 sprite.alpha = active ? 0.88 : 0.52;
 layers.sceneSprites.addChild(sprite);
 e.circle(cx, cy, 7).stroke({ width: 1.5, color, alpha: active ? 0.75 : 0.42 });
 } else {
 e.circle(cx, cy, 6).fill({ color, alpha: active ? 0.96 : 0.5 });
 }

if (!active) {
 e.rect(cx - 6, cy - 1, 12, 2).fill({ color: 0x1a1a22, alpha: 0.9 });
 e.rect(cx - 6, cy - 1, 12, 2).stroke({ width: 1, color: 0x8a6a52, alpha: 0.8 });
 }
 }
 const p = state.player;
 // 面前格高亮（操作目标）
 const fdx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
 const fdy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
 const fx = p.position.x + fdx;
 const fy = p.position.y + fdy;
 if (fx >= 0 && fy >= 0 && fx < state.width && fy < state.height) {
 const frontTile = state.tiles[fy * state.width + fx];
 const frontCrop = frontTile?.cropId != null ? state.crops.get(frontTile.id) : undefined;
 const frontReadiness = frontTile ? tileReadinessState(frontTile, frontCrop) : null;
 const frontStroke = frontReadiness?.kind === 'harvest-ready'
 ? 0xffe066
 : frontReadiness?.kind === 'plant-ready'
 ? 0x8bd450
 : frontReadiness?.kind === 'till-ready'
 ? 0xd8b070
 : frontReadiness?.kind === 'blocked'
 ? 0x8a6a52
 : 0xffffff;
 const frontAlpha = frontReadiness?.actionable ? 0.92 : 0.7;
 e.rect(OX + fx * TILE, OY + fy * TILE, TILE - 1, TILE - 1).stroke({ width: frontReadiness?.actionable ? 2.5 : 2, color: frontStroke, alpha: frontAlpha });
 }
 const px = OX + p.position.x * TILE + TILE / 2;
 const py = OY + p.position.y * TILE + TILE / 2;
 if (assets?.player) {
 const sprite = new Sprite();
 applyWorldSprite(sprite, assets.player, px, py, TILE);
 layers.sceneSprites.addChild(sprite);
 } else {
 e.circle(px, py, TILE / 3).fill(0xff5a5a);
 }
 // 朝向指示
 e.circle(px + fdx * 10, py + fdy * 10, 4).fill(0xffffff);

// 季节环境色调（T5）：全屏低透明叠色，渲染于 tiles/entities 之上、HUD 之下
 const st = layers.seasonTint;
	st.clear();
 const tint = SEASON_TINT[state.season] ?? SEASON_TINT.spring;
 st.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: tint.color, alpha: tint.alpha });

// —— HUD：状态文字 + 图形条（气血/丹毒/体魄/体力）——
 const bg = layers.bars;
	bg.clear();
 const hpRatio = Math.max(0, p.hp / p.maxHp);
 const hpPct = Math.round(hpRatio * 100);
 const pp = Math.round(p.pillPoison / MILLI);
 const poisonCap = DEFAULT_BALANCE.pillPoison.cap; // 100
 const poisonPct = Math.min(1, p.pillPoison / (poisonCap * MILLI));
 const staCap = DEFAULT_BALANCE.player.staminaCap * MILLI;
 const staPct = Math.max(0, Math.min(1, p.stamina / staCap));
 const stageNames = tList('ui.hud.stages');
 // 体魄进度：当前阶段体魄根基 / 该阶段体魄上限（stage≥7 飞升前夜无后续突破→满条）
 const bodyFoundation = p.bodyFoundation ?? p.cultivation;
 const cultPct = p.stage >= 7 ? 1 : Math.min(1, bodyFoundation / stageQiCap(p.stage, DEFAULT_BALANCE));
 // 控血走钢丝：HP<20% 黄警，<10% 红警（险死区是核心张力）
 const hpColor = hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.2 ? 0xffe066 : 0xff5a5a;
 const poisonColor = poisonPct > 0.7 ? 0xff3030 : poisonPct > 0.4 ? 0xff8a3a : 0x9a7a3a;
 const BAR_W = 120, BAR_H = 11, BAR_X0 = 12, BAR_DX = 152, BAR_Y = 42;
 drawBar(bg, BAR_X0, BAR_Y, BAR_W, BAR_H, hpRatio, hpColor);
 drawBar(bg, BAR_X0 + BAR_DX, BAR_Y, BAR_W, BAR_H, poisonPct, poisonColor);
 drawBar(bg, BAR_X0 + 2 * BAR_DX, BAR_Y, BAR_W, BAR_H, cultPct, 0x66ddff);
 drawBar(bg, BAR_X0 + 3 * BAR_DX, BAR_Y, BAR_W, BAR_H, staPct, 0x7ac050);
 layers.barLabels[0]!.text = `气血 ${hpPct}%`;
 layers.barLabels[1]!.text = `丹毒 ${pp}`;
 layers.barLabels[2]!.text = `体魄 ${Math.round(cultPct * 100)}%`;
 layers.barLabels[3]!.text = `体力 ${Math.round(staPct * 100)}%`;
 const ev = state.activeEvent ? `　【天象·${state.activeEvent.displayName} ${state.activeEvent.daysLeft}日】` : '';
 const surge = state.beastSurge ? `　⚠妖兽潮 ${state.beastSurge.daysLeft}日` : '';
 const stayingGoal = getPrimaryStayingWorldGoal(state);
 const victory = state.postAscension.mode === 'stayed-in-world' && state.postAscension.victoryRecorded ? '　|　胜后留世存档' : '';
 const stayingText = stayingGoal ? `　|　留世目标：${stayingGoal.title}（${stayingGoal.progressLabel}）` : '';
 layers.hud.text =
 `第 ${state.day} 日 · ${t('ui.hud.season.' + state.season)} · 第 ${state.year} 年　|　` +
 `阶段：${stageNames[state.player.stage] ?? state.player.stage}　寿元：${p.lifespanRemainingDays ?? '?'}日　炉温：${layers.furnaceHeat}${ev}${surge}${victory}${stayingText}`;

// —— 结局遮罩 ——
 if (state.gameOver) {
 layers.tiles.visible = false;
 layers.entities.visible = false;
 layers.sceneSprites.visible = false;
 layers.bars.visible = false;
 for (const lbl of layers.barLabels) lbl.visible = false;
 const endingTexture = assets?.endingCg[state.ending ?? ''];
 if (endingTexture) {
 layers.endingImage.texture = endingTexture;
 layoutEndingImage(layers.endingImage);
 layers.endingImage.alpha = 0.82;
 layers.endingImage.visible = true;
 layers.ending.y = SCREEN_H - 96;
 } else {
 layers.endingImage.visible = false;
 layers.ending.y = SCREEN_H / 2;
 }
 layers.ending.text = `${t('ending.' + (state.ending ?? ''))}\n${t('ui.restart')}`;
 layers.ending.visible = true;
 layers.inv.visible = false;
 clearInventoryIcons(layers);
 layers.cultivation.visible = false;
 } else if (state.postAscension.mode === 'choice-pending') {
 layers.tiles.visible = true;
 layers.entities.visible = true;
 layers.sceneSprites.visible = true;
 layers.bars.visible = true;
 for (const lbl of layers.barLabels) lbl.visible = true;
 layers.endingImage.visible = false;
 layers.ending.y = SCREEN_H / 2;
 layers.ending.text = '紫雷尽散，天门已开。\n1 飞升离界\n2 留驻此界';
 layers.ending.visible = true;
 layers.inv.visible = false;
 clearInventoryIcons(layers);
 layers.cultivation.visible = false;
 } else {
 layers.tiles.visible = true;
 layers.entities.visible = true;
 layers.sceneSprites.visible = true;
 layers.bars.visible = true;
 for (const lbl of layers.barLabels) lbl.visible = true;
 layers.endingImage.visible = false;
 layers.ending.y = SCREEN_H / 2;
 layers.ending.visible = false;
 if (layers.showInv) {
 const shipping = ctx ? `\n\n${renderShippingBin(state, content, ctx)}` : '';
 const stayingGoals = state.postAscension.mode === 'stayed-in-world' ? `\n\n${renderPostAscensionGoals(state)}` : '';
 layers.inv.text = `${renderInventory(state, content)}\n\n${renderStorage(state, content)}${shipping}${stayingGoals}`;
 layers.inv.visible = true;
 drawInventoryIconStrip(layers, state, content, assets, ctx);
 } else {
 layers.inv.visible = false;
 clearInventoryIcons(layers);
 }
 if (!layers.cultivation.visible) layers.cultivation.text = '';
 }

// 天劫全屏闪光（衰减，T3b 视听冲击）
 const tf = layers.tribFlash;
	tf.clear();
 if (layers.tribFlashTtl > 0) {
 tf.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: 0xffffff, alpha: (layers.tribFlashTtl / 30) * 0.55 });
 layers.tribFlashTtl -= 1;
 }
}

export function setToast(layers: RenderLayers, msg: string, texture?: Texture): void {
 layers.toast.text = msg;
	layers.toastIconBg.clear();
 if (!texture) {
 layers.toast.x = 10;
 layers.toast.style.wordWrapWidth = SCREEN_W - 20;
 layers.toastIcon.visible = false;
 return;
 }

layers.toast.x = 46;
 layers.toast.style.wordWrapWidth = SCREEN_W - 56;
 layers.toastIconBg.roundRect(10, SCREEN_H - 90, 28, 28, 6).fill({ color: 0x12121c, alpha: 0.96 });
 layers.toastIconBg.roundRect(10, SCREEN_H - 90, 28, 28, 6).stroke({ width: 1.4, color: 0x6a5a2a, alpha: 0.94 });
 applyPanelSprite(layers.toastIcon, texture, 14, SCREEN_H - 86, 20);
 layers.toastIcon.visible = true;
}

export function drawTodayBriefing(layers: RenderLayers, title: string, body: string, texture?: Texture, assetId?: string): void {
 const bg = layers.briefingBg;
 const text = layers.briefing;
 const heroAsset = isBriefingHeroAsset(assetId) && texture !== undefined;
 text.style.wordWrapWidth = heroAsset ? 118 : 176;
 text.x = heroAsset ? BRIEFING_BOX.x + 106 : SCREEN_W - 198;
 text.y = 16;
 text.text = `${title}\n${body}`;
 const height = briefingBoxHeight(text.height);
	bg.clear();
 bg.roundRect(BRIEFING_BOX.x, BRIEFING_BOX.y, BRIEFING_BOX.width, height, BRIEFING_BOX.radius).fill({ color: 0x12121c, alpha: 0.9 });
 bg.roundRect(BRIEFING_BOX.x, BRIEFING_BOX.y, BRIEFING_BOX.width, height, BRIEFING_BOX.radius).stroke({ width: 1.2, color: 0x4e4636, alpha: 0.95 });
 if (heroAsset) {
 bg.roundRect(BRIEFING_BOX.x + 10, BRIEFING_BOX.y + 10, 84, 84, 8).fill({ color: 0x171720, alpha: 0.96 });
 bg.roundRect(BRIEFING_BOX.x + 10, BRIEFING_BOX.y + 10, 84, 84, 8).stroke({ width: 1, color: 0x6a5a2a, alpha: 0.92 });
 applyPanelSprite(layers.briefingImage, texture!, BRIEFING_BOX.x + 16, BRIEFING_BOX.y + 16, 72);
 layers.briefingImage.visible = true;
 layers.briefingIcon.visible = false;
 } else {
 layers.briefingImage.visible = false;
 bg.roundRect(BRIEFING_BOX.x + 8, BRIEFING_BOX.y + 8, 28, 28, 6).fill({ color: 0x181824, alpha: 0.92 });
 bg.roundRect(BRIEFING_BOX.x + 8, BRIEFING_BOX.y + 8, 28, 28, 6).stroke({ width: 1, color: 0x6a5a2a, alpha: 0.9 });
 }
 if (!heroAsset && texture) {
 applyPanelSprite(layers.briefingIcon, texture, BRIEFING_BOX.x + 12, BRIEFING_BOX.y + 12, 20);
 layers.briefingIcon.visible = true;
 } else if (!heroAsset) {
 layers.briefingIcon.visible = false;
 }
 text.visible = true;
}

export function hideTodayBriefing(layers: RenderLayers): void {
	layers.briefingBg.clear();
 layers.briefingImage.visible = false;
 layers.briefingIcon.visible = false;
 layers.briefing.text = '';
 layers.briefing.visible = false;
}

export function setHotbar(layers: RenderLayers, msg: string): void {
 layers.hotbar.text = msg;
}

export function drawHotbarIcon(layers: RenderLayers, texture?: Texture): void {
 const bg = layers.hotbarIconBg;
	bg.clear();
 if (!texture) {
 layers.hotbar.x = 10;
 layers.hotbarIcon.visible = false;
 return;
 }

layers.hotbar.x = 46;
 bg.roundRect(10, SCREEN_H - 50, 28, 28, 6).fill({ color: 0x12121c, alpha: 0.96 });
 bg.roundRect(10, SCREEN_H - 50, 28, 28, 6).stroke({ width: 1.5, color: 0x6a5a2a });
 applyPanelSprite(layers.hotbarIcon, texture, 14, SCREEN_H - 46, 20);
 layers.hotbarIcon.visible = true;
}

export function drawPanelItemPreview(
 layers: RenderLayers,
 title: string,
 details: string,
 texture?: Texture,
): void {
 const bg = layers.panelPreviewBg;
 layers.panelPreviewText.text = `${title}\n\n${details}`;
 const height = itemPreviewBoxHeight(layers.panelPreviewText.height);
	bg.clear();
 bg.roundRect(PANEL_PREVIEW_BOX.x, PANEL_PREVIEW_BOX.y, PANEL_PREVIEW_BOX.width, height, PANEL_PREVIEW_BOX.radius).fill({ color: 0x12121c, alpha: 0.94 });
 bg.roundRect(PANEL_PREVIEW_BOX.x, PANEL_PREVIEW_BOX.y, PANEL_PREVIEW_BOX.width, height, PANEL_PREVIEW_BOX.radius).stroke({ width: 1.5, color: 0x5a6a8a });
 bg.roundRect(704, 304, 60, 60, 6).fill({ color: 0x181824, alpha: 0.92 });
 bg.roundRect(704, 304, 60, 60, 6).stroke({ width: 1, color: 0x6a5a2a, alpha: 0.9 });
 bg.visible = true;

if (texture) {
 applyPanelSprite(layers.panelPreviewIcon, texture, 710, 310, 48);
 layers.panelPreviewIcon.visible = true;
 } else {
 layers.panelPreviewIcon.visible = false;
 }

layers.panelPreviewText.visible = true;
}

export function hidePanelItemPreview(layers: RenderLayers): void {
	layers.panelPreviewBg.clear();
 layers.panelPreviewBg.visible = false;
 layers.panelPreviewIcon.visible = false;
 layers.panelPreviewText.text = '';
 layers.panelPreviewText.visible = false;
}

export function drawLocationPreview(
 layers: RenderLayers,
 title: string,
 details: string,
 texture?: Texture,
 npcPrimary?: Texture,
 npcSecondary?: Texture,
): void {
 const bg = layers.locationPreviewBg;
	bg.clear();
 const imageOffset = texture ? 112 : 0;
 layers.locationPreviewText.x = 664 + imageOffset;
 layers.locationPreviewText.y = 86;
 layers.locationPreviewText.style.wordWrapWidth = texture ? 144 : 256;
 layers.locationPreviewText.text = `${title}\n\n${details}`;
 const height = locationPreviewBoxHeight(layers.locationPreviewText.height);
 bg.roundRect(LOCATION_PREVIEW_BOX.x, LOCATION_PREVIEW_BOX.y, LOCATION_PREVIEW_BOX.width, height, LOCATION_PREVIEW_BOX.radius).fill({ color: 0x12121c, alpha: 0.94 });
 bg.roundRect(LOCATION_PREVIEW_BOX.x, LOCATION_PREVIEW_BOX.y, LOCATION_PREVIEW_BOX.width, height, LOCATION_PREVIEW_BOX.radius).stroke({ width: 1.5, color: 0x5a6a8a });
 bg.roundRect(664, 194, 88, 66, 6).fill({ color: 0x181824, alpha: 0.9 });
 bg.roundRect(664, 194, 88, 66, 6).stroke({ width: 1, color: 0x6a5a2a, alpha: 0.9 });
 bg.visible = true;

if (texture) {
 applyPanelSprite(layers.locationPreviewImage, texture, 664, 86, 96);
 layers.locationPreviewImage.visible = true;
 } else {
 layers.locationPreviewImage.visible = false;
 }

if (npcPrimary) {
 applyPanelSprite(layers.locationPreviewNpcPrimary, npcPrimary, 672, 202, 50);
 layers.locationPreviewNpcPrimary.visible = true;
 } else {
 layers.locationPreviewNpcPrimary.visible = false;
 }

if (npcSecondary) {
 applyPanelSprite(layers.locationPreviewNpcSecondary, npcSecondary, 708, 210, 38);
 layers.locationPreviewNpcSecondary.visible = true;
 } else {
 layers.locationPreviewNpcSecondary.visible = false;
 }

 layers.locationPreviewText.visible = true;
}

export function hideLocationPreview(layers: RenderLayers): void {
	layers.locationPreviewBg.clear();
 layers.locationPreviewBg.visible = false;
 layers.locationPreviewImage.visible = false;
 layers.locationPreviewNpcPrimary.visible = false;
 layers.locationPreviewNpcSecondary.visible = false;
 layers.locationPreviewText.text = '';
 layers.locationPreviewText.visible = false;
}

/** 绘制叙事对话盒（T4）。显示全部行 + 继续提示。 */
export function drawDialogue(layers: RenderLayers, lines: string[], texture?: Texture): void {
 const g = layers.dialogueBg;
 const hasPortrait = texture !== undefined;
 const textStyle = dialogueTextLayoutStyle(hasPortrait);
 layers.dialogue.style.wordWrap = textStyle.wordWrap;
 layers.dialogue.style.breakWords = textStyle.breakWords;
 layers.dialogue.style.wordWrapWidth = textStyle.wordWrapWidth;
 layers.dialogue.style.lineHeight = textStyle.lineHeight;
 layers.dialogue.text = `${lines.join('\n')}\n\n${DIALOGUE_CONTINUE_PROMPT}`;
 const layout = dialogueBoxLayout(layers.dialogue.height, hasPortrait);

		g.clear();
 g.roundRect(layout.x, layout.y, layout.width, layout.height, DIALOGUE_LAYOUT_LIMITS.radius).fill({ color: 0x12121c, alpha: 0.96 });
 g.roundRect(layout.x, layout.y, layout.width, layout.height, DIALOGUE_LAYOUT_LIMITS.radius).stroke({ width: 1.5, color: 0x6a5a2a });
		g.visible = true;
 if (texture) {
 applyPanelSprite(layers.dialoguePortrait, texture, layout.portraitX, layout.portraitY, layout.portraitSize);
 layers.dialoguePortrait.visible = true;
 } else {
 layers.dialoguePortrait.visible = false;
 }
 layers.dialogue.x = layout.textX;
 layers.dialogue.y = layout.textY;
 layers.dialogue.visible = true;
}

export function hideDialogue(layers: RenderLayers): void {
	layers.dialogueBg.clear();
	layers.dialogueBg.visible = false;
 layers.dialoguePortrait.visible = false;
 layers.dialogue.visible = false;
}

/** 绘制轻量暂停层，复用底部对话覆盖区承载场景内暂停提示。 */
export function drawPauseOverlay(layers: RenderLayers): void {
	const g = layers.dialogueBg;
		g.clear()
 .roundRect(40, 296, 600, 138, 8)
 .fill({ color: 0x12121c, alpha: 0.96 })
 .roundRect(40, 296, 600, 138, 8)
		.stroke({ width: 1.5, color: 0x5a6a8a });
	g.visible = true;
 layers.dialoguePortrait.visible = false;
 layers.dialogue.x = 58;
 layers.dialogue.y = 314;
 layers.dialogue.style.wordWrapWidth = 560;
 layers.dialogue.text = '已暂停\n\nEsc / P 继续\nTab 背包，Shift+M 农庄操作，Shift+Tab 地点目录';
 layers.dialogue.visible = true;
}
