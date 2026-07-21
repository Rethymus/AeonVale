/**
 * PixiJS v8 渲染层。
 * 只读 sim 状态绘制；不修改 sim。中文 HUD（C8），CJK 字体走系统回退（首版；正式版内置 霞鹜文楷）。
 */
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { GameState, GroundItem } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';
import { MILLI } from '@sim/world/types';
import type { Season } from '@sim/world/types';
import { stageQiCap } from '@sim/progression/progression';
import { DEFAULT_BALANCE } from '@sim/params';
import { t, tList } from '@content/i18n';
import type { CropQuality } from '@sim/farm/quality';
import type { CropInstance } from '@sim/farm/crop';
import type { Tile } from '@sim/farm/tile';
import { storageUsed } from '@sim/storage/storage';
import { shippingLines } from '@sim/economy/shipping';
import { marketDemandForItem } from '@sim/economy/market';
import { renderStayingWorldGoals } from '@sim/progression/stayingWorldGoals';
import type { SimContext } from '@sim/world/context';
import { bodyFoundationCap, readyToInvokeTribulation, type FacilityKind, type LocationId } from '@sim';
import { guardBeastPreviewAssetId, guardBeastPreviewPlacements } from './guardBeastPreview';
import { farmsteadPropPlacements, locationWorldPreviewPlacementAt, locationWorldPreviewPlacements, npcWorldPreviewPlacementAt, npcWorldPreviewPlacements } from './npcWorldPreview';
import { arrayWorldPreviewPlacements } from './arrayPreview';
import { cropGrowthFeedbackState, harvestLiftRadiusBonus, qiFlowVisualState, seedFallbackRadius, tileReadinessState, tileSelectionVisualState, tileSurfaceGrainSample, tileSurfaceVisualState, tileVisualState, TILLED_SOIL_BORDER, TILLED_SOIL_FILL, WATER_SHEEN_COLOR, type QiFlowVisualState } from './tileVisuals';
import { inventoryIconStripEntries } from './inventoryIconStrip';
import { tileAssetId } from './tileAsset';
import { hasActiveArrayCoverage } from '@sim/tribulation/arrays';
import { itemIconAssetId } from '@app/itemIcons';
import { farmsteadSceneLayout, farmsteadSceneObjectAt, farmsteadSceneTileKind, isFarmsteadFarmPlotTile, type FarmsteadSceneObject, type FarmsteadSceneZoneKind } from '@app/farmsteadScene';
import { bodyLeakPresentation } from '@app/bodyLeakPresentation';
import { computeViewportLayout, type ViewportProfile } from './viewportLayout';
import { generateLightningBolt, strokeLightningBolt, type LightningBoltGeometry } from './lightningBolt';
import { tutorialWarningPulse, tutorialWarningZoneTiles } from './tutorialWarningZone';
import { characterWalkCycle, facingIndicatorOffset, facingScaleX, footShadowSpec, npcWorldFallbackPresentation, npcWorldMapSpriteAssetId, playerPresenceOverlay, playerWorldMapSpriteAssetId, qiSparklePhase, shouldDrawQiSparkles, worldCharacterReadabilityHaloSpec, worldCharacterSpriteMetrics, type CharacterWalkCycle, type Facing4 } from './characterPresence';
import { paintWorldDecor, worldDecorPlacements } from './worldDecor';
import { ColorPalette } from './ColorPalette';
import type { GridPoint, PlayerMovementVisual } from '@app/worldMovement';

/** CJK 字体栈（首版用系统 CJK 回退；正式版应 FontFace 预加载 霞鹜文楷） */
export const CJK_FONT = "'LXGW WenKai','Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif";

export const RENDER_ROOT_LABELS = {
  world: 'world-root',
  screenFx: 'screen-fx-root',
  hud: 'hud-root',
  focus: 'focus-root',
  toast: 'toast-root'
} as const;

export function setTextIfChanged(target: { text: string }, nextText: string): boolean {
  if (target.text === nextText) return false;
  target.text = nextText;
  return true;
}

export const TILE = 42;
const SCREEN_W = 960; // 对齐 main.ts app.init 尺寸
const SCREEN_H = 540;
export const FARMSTEAD_PAINTED_BACKDROP_ALPHA = 0.8;
export const FARMSTEAD_PASSIVE_FARM_PLOT_ALPHA = 0.12;
export const FARMSTEAD_PASSIVE_TILE_TEXTURE_ALPHA = 0.11;
export const FARMSTEAD_PASSIVE_AMBIENT_ALPHA = 0.1;
export const PLAYER_MAP_SPRITE_ALPHA = 0.94;
export const TOAST_BOTTOM_UI_TOP = SCREEN_H - 90;
const logicalViewportLayout = computeViewportLayout({ width: SCREEN_W, height: SCREEN_H, touchCapable: false });
if (!logicalViewportLayout.regions) {
  throw new Error('The logical 960×540 renderer viewport must produce landscape regions.');
}
export const LOGICAL_RENDER_REGIONS = {
  content: { ...logicalViewportLayout.regions.content },
  playfield: {
    x: logicalViewportLayout.regions.content.x,
    y: logicalViewportLayout.regions.world.y,
    width: logicalViewportLayout.regions.content.width,
    height: logicalViewportLayout.regions.world.height
  },
  world: { ...logicalViewportLayout.regions.world },
  objectiveRail: { ...logicalViewportLayout.regions.objectiveRail }
} as const;
const DEFAULT_WORLD_COLUMNS = 14;
const OX = Math.round(LOGICAL_RENDER_REGIONS.playfield.x + (LOGICAL_RENDER_REGIONS.playfield.width - DEFAULT_WORLD_COLUMNS * TILE) / 2);
const OY = Math.round(LOGICAL_RENDER_REGIONS.playfield.y);
const EMPTY_QI_FLOW: QiFlowVisualState = {
  lineCount: 0,
  concentration: 0,
  alpha: 0,
  lineWidth: 0,
  speed: 0,
  amplitude: 0,
  phase: 0,
  glowAlpha: 0
};
const BRIEFING_BOX = {
  x: Math.round(LOGICAL_RENDER_REGIONS.objectiveRail.x),
  y: Math.round(LOGICAL_RENDER_REGIONS.objectiveRail.y),
  width: Math.floor(LOGICAL_RENDER_REGIONS.objectiveRail.width),
  minHeight: 70,
  radius: 7,
  paddingY: 8
} as const;
export const PANEL_PREVIEW_BOX = { x: 688, y: 286, width: 248, minHeight: 112, radius: 8, paddingY: 18 } as const;
export const LOCATION_PREVIEW_BOX = { x: 648, y: 70, width: 288, minHeight: 206, maxHeight: 370, radius: 8, paddingY: 16 } as const;
export const LOCATION_PREVIEW_TEXT_LINE_HEIGHT = 15;
export const DIALOGUE_LAYOUT_LIMITS = {
  x: 40,
  width: 600,
  safeTop: 70,
  bottom: 434,
  bottomUiTop: SCREEN_H - 90,
  // 首小时叙事：略压高度，给灵田「现身」留出更多画面（player audit P1）
  minHeight: 110,
  radius: 8,
  paddingX: 18,
  paddingY: 14,
  portraitSize: 96,
  portraitTextOffset: 112,
  lineHeight: 22
} as const;

export const DIALOGUE_CONTINUE_PROMPT = '　　…空格 / 回车键 继续…';

/** 季节环境色调（T5 / B-gap #2）：全屏低透明叠色，让四季有视觉差异。 */
const SEASON_TINT: Record<Season, { color: number; alpha: number }> = {
  spring: { color: ColorPalette.seasonSpring, alpha: 0.05 }, // 春·青绿
  summer: { color: ColorPalette.seasonSummer, alpha: 0.06 }, // 夏·暖黄
  autumn: { color: ColorPalette.seasonAutumn, alpha: 0.07 }, // 秋·金橙
  winter: { color: ColorPalette.seasonWinter, alpha: 0.09 } // 冬·冷蓝（略强，肃杀感）
};

const SOIL_COLOR: Record<string, number> = {
  loam: ColorPalette.soil,
  'wet-loam': ColorPalette.soilWet,
  'dry-sand': ColorPalette.sand,
  insulated: ColorPalette.insulated,
  scorched: ColorPalette.soilShadow,
  'spirit-loam': ColorPalette.soilSpirit,
  rock: ColorPalette.grayDark,
  water: ColorPalette.water,
  'metal-ore': ColorPalette.metalOre
};

const STAGE_COLOR: Record<string, number> = {
  seed: ColorPalette.seedDark,
  sprout: ColorPalette.mossBright,
  growing: ColorPalette.leaf,
  mature: ColorPalette.giltBright,
  withered: ColorPalette.withered
};

const FACILITY_COLOR: Record<string, number> = {
  'drying-rack': ColorPalette.facilityGold,
  'sealing-cabinet': ColorPalette.facilityBlue,
  'talisman-furnace': ColorPalette.cinnabarOrange
};

type GuardBeastSpecialtyMarker = 'field-ward' | 'array-warden' | 'courier';

const GUARD_BEAST_SPECIALTY_MARKER: Record<GuardBeastSpecialtyMarker, { color: number; accent: number }> = {
  'field-ward': { color: ColorPalette.success, accent: ColorPalette.successPaper },
  'array-warden': { color: ColorPalette.qiBright, accent: ColorPalette.qiPaper },
  courier: { color: ColorPalette.warning, accent: ColorPalette.giltPaper }
};

export interface RenderLayers {
  worldRoot: Container;
  screenFxRoot: Container;
  hudRoot: Container;
  focusRoot: Container;
  toastRoot: Container;
  tiles: Graphics;
  tileSprites: Container;
  terrainSemanticOverlay: Graphics;
  qiFlow: Graphics;
  entities: Graphics;
  sceneSprites: Container;
  characterOverlay: Graphics;
  npcMarkers: Container;
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
  tribBoltGeom: LightningBoltGeometry | null; // 当前招牌电光折线（渲染层瞬态）
  tribBoltTtl: number; // 电光剩余帧
  tribBoltMaxTtl: number;
  shakeTtl: number; // 世界层屏震剩余帧（仅渲染）
  shakeMagnitude: number; // 像素振幅
  dialogueBg: Graphics; // 叙事对话盒背景（T4）
  dialoguePortrait: Sprite; // 对话立绘（P0 资产接入）
  dialogue: Text; // 叙事对白文本
  seasonTint: Graphics; // 季节环境色调（T5）
  particles: Graphics; // 程序化粒子（T9）
  particleList: Particle[]; // 活跃粒子（渲染层非确定性，sim 不受影响）
  floatTexts: FloatText[]; // 活跃飘字（渲染层）
  floatTextLayer: Container; // 飘字容器（screenFx）
  ambientTimeMs: number; // 世界层环境动效时间轴（仅渲染层使用）
  reducedMotion: boolean;
}

export interface RuntimeRenderAssets {
  player?: Texture;
  guardBeast?: Texture;
  guardBeastVariants?: Partial<Record<string, Texture>>;
  cropHerbs: Partial<Record<string, Texture>>;
  cropSeeds: Partial<Record<string, Texture>>;
  facilities: Partial<Record<string, Texture>>;
  locations: Partial<Record<LocationId, Texture>>;
  logos: Partial<Record<string, Texture>>;
  hotbarIcons: Partial<Record<string, Texture>>;
  itemIcons: Partial<Record<string, Texture>>;
  npcs: Partial<Record<string, Texture>>;
  portraits?: Partial<Record<string, Texture>>;
  mapSprites?: Partial<Record<string, Texture>>;
  maps?: Partial<Record<string, Texture>>;
  inventoryIcons?: Partial<Record<string, Texture>>;
  tiles: Partial<Record<string, Texture>>;
}

export interface DrawWorldOptions {
  pointerTile?: { x: number; y: number } | null;
  playerMovement?: PlayerMovementVisual | null;
  pendingWorld?: PendingWorldVisual | null;
}

export type ToastLayoutProfile = Exclude<ViewportProfile, 'portrait-blocked'>;

export interface PendingWorldVisual {
  readonly target: GridPoint;
  readonly destination: GridPoint | null;
  readonly path: readonly GridPoint[];
  readonly description: string;
}

/** 程序化粒子（T9）。渲染层自管的瞬态视觉效果，不进 sim、不影响确定性。 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

/** 世界层飘字（juice）。仅渲染层，不进 sim。 */
export interface FloatText {
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: number;
}

function estimateWrappedLineCount(text: string, wordWrapWidth: number, averageGlyphWidth = 12): number {
  const charsPerLine = Math.max(8, Math.floor(wordWrapWidth / averageGlyphWidth));
  return text.split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(Array.from(line).length / charsPerLine)), 0);
}

export function toastBoxHeight(text: string, wordWrapWidth: number): number {
  return Math.max(36, estimateWrappedLineCount(text, wordWrapWidth) * 17 + 16);
}

export interface ToastLayoutMetrics {
  readonly textX: number;
  readonly textY: number;
  readonly textWidth: number;
  readonly bgX: number;
  readonly bgY: number;
  readonly bgWidth: number;
  readonly bgHeight: number;
}

export function toastLayoutForText(msg: string, hasTexture: boolean, profile: ToastLayoutProfile = 'desktop'): ToastLayoutMetrics {
  const baseY = profile === 'compact-landscape' ? SCREEN_H - 252 : SCREEN_H - 124;
  const textX = hasTexture ? 46 : 16;
  const textWidth = profile === 'compact-landscape' ? 248 : 410;
  const bgX = 10;
  const bgHeight = toastBoxHeight(msg, textWidth);
  const bottomReserveTop = profile === 'desktop' ? TOAST_BOTTOM_UI_TOP : SCREEN_H - 104;
  const textY = Math.min(baseY, bottomReserveTop - bgHeight + 8);
  const bgY = textY - 8;
  const bgWidth = textX + textWidth + 12 - bgX;
  return { textX, textY, textWidth, bgX, bgY, bgWidth, bgHeight };
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
  return Math.min(LOCATION_PREVIEW_BOX.maxHeight, panelBoxHeight(textHeight, LOCATION_PREVIEW_BOX.minHeight, LOCATION_PREVIEW_BOX.paddingY));
}

export function locationPreviewMaxTextHeight(): number {
  return LOCATION_PREVIEW_BOX.maxHeight - LOCATION_PREVIEW_BOX.paddingY * 2;
}

export function locationPreviewMaxTextLines(lineHeight = LOCATION_PREVIEW_TEXT_LINE_HEIGHT): number {
  return Math.max(1, Math.floor(locationPreviewMaxTextHeight() / lineHeight));
}

export function locationPreviewEstimatedTextHeight(text: string, wordWrapWidth: number): number {
  return Math.min(locationPreviewMaxTextHeight(), estimateLocationPreviewLineCount(text, wordWrapWidth) * LOCATION_PREVIEW_TEXT_LINE_HEIGHT);
}

function textWrapUnits(char: string): number {
  if (/[\u0009\u0020]/.test(char)) return 0.35;
  if (/[\u0021-\u007e]/.test(char)) return 0.58;
  return 1;
}

export function estimateLocationPreviewLineCount(text: string, wordWrapWidth: number, fontSize = 11): number {
  const maxUnits = Math.max(1, Math.floor(wordWrapWidth / fontSize));
  let lineCount = 1;
  let lineUnits = 0;
  for (const char of text.replace(/\r\n?/g, '\n')) {
    if (char === '\n') {
      lineCount += 1;
      lineUnits = 0;
      continue;
    }
    const units = textWrapUnits(char);
    if (lineUnits > 0 && lineUnits + units > maxUnits) {
      lineCount += 1;
      lineUnits = units;
      continue;
    }
    lineUnits += units;
  }
  return lineCount;
}

function clampTextToEstimatedLines(text: string, maxLines: number, wordWrapWidth: number): string {
  const source = text.trim();
  if (estimateLocationPreviewLineCount(source, wordWrapWidth) <= maxLines) return source;
  let clamped = '';
  for (const char of source) {
    const next = `${clamped}${char}`;
    if (estimateLocationPreviewLineCount(`${next.trimEnd()}…`, wordWrapWidth) > maxLines) break;
    clamped = next;
  }
  return `${clamped.trimEnd()}…`;
}

export function locationPreviewTextContent(title: string, details: string, wordWrapWidth: number, maxLines = locationPreviewMaxTextLines()): string {
  const safeTitle = clampTextToEstimatedLines(title, Math.max(1, maxLines - 2), wordWrapWidth);
  const detailBudget = Math.max(1, maxLines - estimateLocationPreviewLineCount(safeTitle, wordWrapWidth) - 1);
  const safeDetails = clampTextToEstimatedLines(details, detailBudget, wordWrapWidth);
  return `${safeTitle}\n\n${safeDetails}`;
}

function fitMeasuredLocationPreviewText(target: Text, nextText: string): number {
  setTextIfChanged(target, nextText);
  if (target.height <= locationPreviewMaxTextHeight()) return target.height;

  const chars = Array.from(nextText);
  let low = 0;
  let high = chars.length;
  let bestText = '…';
  let bestHeight = LOCATION_PREVIEW_TEXT_LINE_HEIGHT;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${chars.slice(0, mid).join('').trimEnd()}…`;
    setTextIfChanged(target, candidate);
    const candidateHeight = target.height;
    if (candidateHeight <= locationPreviewMaxTextHeight()) {
      bestText = candidate;
      bestHeight = candidateHeight;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  setTextIfChanged(target, bestText);
  return bestHeight;
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
    wordWrapWidth: hasPortrait ? DIALOGUE_LAYOUT_LIMITS.width - DIALOGUE_LAYOUT_LIMITS.paddingX * 2 - DIALOGUE_LAYOUT_LIMITS.portraitTextOffset : DIALOGUE_LAYOUT_LIMITS.width - DIALOGUE_LAYOUT_LIMITS.paddingX * 2,
    lineHeight: DIALOGUE_LAYOUT_LIMITS.lineHeight
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
    throw new RangeError(`Dialogue content requires ${height}px but only ${DIALOGUE_LAYOUT_LIMITS.bottom - DIALOGUE_LAYOUT_LIMITS.safeTop}px is available.`);
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
    portraitSize: DIALOGUE_LAYOUT_LIMITS.portraitSize
  };
}

export function createLayers(app: Application): RenderLayers {
  const worldRoot = new Container({ label: RENDER_ROOT_LABELS.world });
  const screenFxRoot = new Container({ label: RENDER_ROOT_LABELS.screenFx });
  const hudRoot = new Container({ label: RENDER_ROOT_LABELS.hud });
  const focusRoot = new Container({ label: RENDER_ROOT_LABELS.focus });
  const toastRoot = new Container({ label: RENDER_ROOT_LABELS.toast });
  app.stage.addChild(worldRoot, screenFxRoot, hudRoot, focusRoot, toastRoot);

  const tiles = new Graphics();
  worldRoot.addChild(tiles);
  const tileSprites = new Container();
  worldRoot.addChild(tileSprites);
  const terrainSemanticOverlay = new Graphics();
  worldRoot.addChild(terrainSemanticOverlay);
  const qiFlow = new Graphics();
  worldRoot.addChild(qiFlow);
  const entities = new Graphics();
  worldRoot.addChild(entities);
  const sceneSprites = new Container();
  worldRoot.addChild(sceneSprites);
  const characterOverlay = new Graphics();
  worldRoot.addChild(characterOverlay);
  const npcMarkers = new Container();
  worldRoot.addChild(npcMarkers);
  const hotbarIconBg = new Graphics();
  hudRoot.addChild(hotbarIconBg);
  const hotbarIcon = new Sprite();
  hotbarIcon.visible = false;
  hudRoot.addChild(hotbarIcon);
  const panelPreviewBg = new Graphics();
  panelPreviewBg.visible = false;
  focusRoot.addChild(panelPreviewBg);
  const panelPreviewIcon = new Sprite();
  panelPreviewIcon.visible = false;
  focusRoot.addChild(panelPreviewIcon);
  const panelPreviewText = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 12, fill: ColorPalette.paperText, wordWrap: true, breakWords: true, wordWrapWidth: 148, lineHeight: 18 }
  });
  panelPreviewText.x = 780;
  panelPreviewText.y = 332;
  panelPreviewText.visible = false;
  focusRoot.addChild(panelPreviewText);
  const seasonTint = new Graphics();
  screenFxRoot.addChild(seasonTint);
  const particles = new Graphics();
  screenFxRoot.addChild(particles);
  const floatTextLayer = new Container({ label: 'float-text-layer' });
  screenFxRoot.addChild(floatTextLayer);
  const locationPreviewBg = new Graphics();
  locationPreviewBg.visible = false;
  focusRoot.addChild(locationPreviewBg);
  const locationPreviewImage = new Sprite();
  locationPreviewImage.visible = false;
  focusRoot.addChild(locationPreviewImage);
  const locationPreviewNpcPrimary = new Sprite();
  locationPreviewNpcPrimary.visible = false;
  focusRoot.addChild(locationPreviewNpcPrimary);
  const locationPreviewNpcSecondary = new Sprite();
  locationPreviewNpcSecondary.visible = false;
  focusRoot.addChild(locationPreviewNpcSecondary);
  const locationPreviewText = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 11, fill: ColorPalette.paperText, wordWrap: true, breakWords: true, wordWrapWidth: 144, lineHeight: 15 }
  });
  locationPreviewText.x = 776;
  locationPreviewText.y = 86;
  locationPreviewText.visible = false;
  focusRoot.addChild(locationPreviewText);
  const hud = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 15, fill: ColorPalette.paperText }
  });
  hud.x = 10;
  hud.y = 8;
  hudRoot.addChild(hud);
  const briefingBg = new Graphics();
  hudRoot.addChild(briefingBg);
  const briefingImage = new Sprite();
  briefingImage.visible = false;
  hudRoot.addChild(briefingImage);
  const briefingIcon = new Sprite();
  briefingIcon.visible = false;
  hudRoot.addChild(briefingIcon);
  const briefing = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 11, fill: ColorPalette.paperText, wordWrap: true, breakWords: true, wordWrapWidth: 176, lineHeight: 16 }
  });
  briefing.x = BRIEFING_BOX.x + 40;
  briefing.y = BRIEFING_BOX.y + BRIEFING_BOX.paddingY;
  hudRoot.addChild(briefing);
  const toastIconBg = new Graphics();
  toastRoot.addChild(toastIconBg);
  const toastIcon = new Sprite();
  toastIcon.visible = false;
  toastRoot.addChild(toastIcon);
  const toast = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 14, fill: ColorPalette.giltBright, wordWrap: true, breakWords: true, wordWrapWidth: SCREEN_W - 56, lineHeight: 17 }
  });
  toast.x = 10;
  toast.y = app.screen.height - 88;
  toastRoot.addChild(toast);
  const help = new Text({
    text: t('ui.help.default'),
    style: { fontFamily: CJK_FONT, fontSize: 10, fill: ColorPalette.stoneGray }
  });
  help.x = 10;
  help.y = app.screen.height - 20;
  hudRoot.addChild(help);
  const ending = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 52, fill: ColorPalette.giltBright, align: 'center', stroke: { color: ColorPalette.black, width: 4 } }
  });
  ending.anchor.set(0.5);
  ending.x = app.screen.width / 2;
  ending.y = app.screen.height / 2;
  ending.visible = false;
  focusRoot.addChild(ending);
  const inv = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 13, fill: ColorPalette.paperText }
  });
  inv.x = app.screen.width - 190;
  inv.y = 70;
  inv.visible = false;
  focusRoot.addChild(inv);
  const invIcons = new Container();
  invIcons.visible = false;
  focusRoot.addChild(invIcons);
  const cultivation = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 13, fill: ColorPalette.paperText, lineHeight: 20 }
  });
  cultivation.x = app.screen.width - 286;
  cultivation.y = 70;
  cultivation.visible = false;
  focusRoot.addChild(cultivation);
  const hotbar = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 12, fill: ColorPalette.paperMuted }
  });
  hotbar.x = 46;
  hotbar.y = app.screen.height - 42;
  hudRoot.addChild(hotbar);
  const bars = new Graphics();
  hudRoot.addChild(bars);
  const tribFlash = new Graphics();
  screenFxRoot.addChild(tribFlash);
  const dialogueBg = new Graphics();
  dialogueBg.visible = false;
  focusRoot.addChild(dialogueBg);
  const dialoguePortrait = new Sprite();
  dialoguePortrait.visible = false;
  focusRoot.addChild(dialoguePortrait);
  const dialogue = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 15, fill: ColorPalette.paperText, ...dialogueTextLayoutStyle(false) }
  });
  dialogue.x = 58;
  dialogue.y = 314;
  focusRoot.addChild(dialogue);
  const barLabels = [t('ui.hud.hp'), t('ui.hud.pillPoison'), t('ui.hud.cultivation'), t('ui.hud.stamina')].map((label, i) => {
    const t = new Text({ text: label, style: { fontFamily: CJK_FONT, fontSize: 11, fill: ColorPalette.moonGray } });
    t.x = 12 + i * 152;
    t.y = 26;
    hudRoot.addChild(t);
    return t;
  });
  return {
    worldRoot,
    screenFxRoot,
    hudRoot,
    focusRoot,
    toastRoot,
    tiles,
    tileSprites,
    terrainSemanticOverlay,
    qiFlow,
    entities,
    sceneSprites,
    characterOverlay,
    npcMarkers,
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
    tribBoltGeom: null,
    tribBoltTtl: 0,
    tribBoltMaxTtl: 0,
    shakeTtl: 0,
    shakeMagnitude: 0,
    dialogueBg,
    dialoguePortrait,
    dialogue,
    seasonTint,
    particles,
    particleList: [],
    floatTexts: [],
    floatTextLayer,
    ambientTimeMs: 0,
    reducedMotion: false
  };
}

function ambientBobOffset(timeMs: number, key: number, amplitude: number, cycleMs: number): number {
  const phase = key * 0.61803398875;
  return Math.sin((timeMs / cycleMs) * Math.PI * 2 + phase) * amplitude;
}

/** 每格最多 3 条、每条 6 段的轻量正弦流线。 */
function drawQiFlowLines(target: Graphics, tile: Pick<Tile, 'id' | 'x' | 'y'>, x: number, y: number, flow: QiFlowVisualState): void {
  if (flow.lineCount === 0) return;
  const segmentCount = 6;

  for (let lineIndex = 0; lineIndex < flow.lineCount; lineIndex++) {
    const anchor = tileSurfaceGrainSample(tile, 'fine', 80 + lineIndex);
    const direction = (tile.id + lineIndex) % 2 === 0 ? 1 : -1;
    const baseY = y + 8 + ((lineIndex + 1) / (flow.lineCount + 1)) * (TILE - 16) + (anchor.oy - 0.5) * 3;
    const drift = Math.sin(flow.phase * Math.PI * 2) * 2.5 * direction;

    const points: { x: number; y: number }[] = [];
    for (let segment = 0; segment <= segmentCount; segment++) {
      const progress = segment / segmentCount;
      const rawX = x + 7 + progress * (TILE - 14) + drift;
      const pointX = Math.max(x + 4, Math.min(x + TILE - 5, rawX));
      const wave = Math.sin((progress * 1.35 + flow.phase + lineIndex * 0.23) * Math.PI * 2);
      const slope = direction * (progress - 0.5) * 2.2;
      const pointY = baseY + wave * flow.amplitude + slope;
      points.push({ x: pointX, y: pointY });
    }
    const tracePath = (): void => {
      for (const [index, point] of points.entries()) {
        if (index === 0) target.moveTo(point.x, point.y);
        else target.lineTo(point.x, point.y);
      }
    };
    const color = lineIndex % 2 === 0 ? ColorPalette.qiBright : ColorPalette.moonWhite;
    const alpha = lineIndex % 2 === 0 ? flow.alpha : flow.alpha * 0.78;
    tracePath();
    target.stroke({ width: flow.lineWidth + 1.4, color: ColorPalette.qiBright, alpha: 0.12 + flow.concentration * 0.08, cap: 'round', join: 'round' });
    tracePath();
    target.stroke({ width: flow.lineWidth, color, alpha, cap: 'round', join: 'round' });
  }
}

export function screenPointForTile(x: number, y: number): { x: number; y: number } {
  return {
    x: OX + x * TILE + TILE / 2,
    y: OY + y * TILE + TILE / 2
  };
}

export function tileCoordinatesFromScreenPoint(state: Pick<GameState, 'width' | 'height'>, point: { x: number; y: number }): { x: number; y: number } | null {
  const x = Math.floor((point.x - OX) / TILE);
  const y = Math.floor((point.y - OY) / TILE);
  if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
  return { x, y };
}

function farmsteadZoneTone(zone: FarmsteadSceneZoneKind): { color: number; alpha: number } | null {
  switch (zone) {
    case 'legacy-field':
    case 'herb-plot':
      return null;
    case 'homestead':
      return { color: ColorPalette.woodDark, alpha: 0.17 };
    case 'workyard':
      return { color: ColorPalette.mountain, alpha: 0.18 };
    case 'gate':
      return { color: ColorPalette.frostGray, alpha: 0.18 };
    case 'wild':
      return { color: ColorPalette.moss, alpha: 0.13 };
    case 'courtyard':
      return { color: ColorPalette.soilHighlight, alpha: 0.12 };
  }
}

export interface FarmsteadValleyCueState {
  readonly hasValleyCue: boolean;
  readonly stoneAlpha: number;
  readonly pathBandAlpha: number;
  readonly grassAlpha: number;
  readonly mistAlpha: number;
  readonly workyardSparkAlpha: number;
  readonly homesteadFloorAlpha: number;
}

export function farmsteadValleyCueState(zone: FarmsteadSceneZoneKind, tile: Pick<Tile, 'id' | 'x' | 'y'>): FarmsteadValleyCueState {
  const variation = 0.86 + (tile.id % 5) * 0.035;
  switch (zone) {
    case 'wild':
      return { hasValleyCue: true, stoneAlpha: 0, pathBandAlpha: 0, grassAlpha: 0.36 * variation, mistAlpha: tile.y <= 2 ? 0.2 : 0.08, workyardSparkAlpha: 0, homesteadFloorAlpha: 0 };
    case 'courtyard':
      return { hasValleyCue: true, stoneAlpha: 0.3 * variation, pathBandAlpha: 0.18, grassAlpha: 0.06, mistAlpha: 0, workyardSparkAlpha: 0, homesteadFloorAlpha: 0 };
    case 'gate':
      return { hasValleyCue: true, stoneAlpha: 0.34 * variation, pathBandAlpha: 0.22, grassAlpha: 0.1, mistAlpha: 0.1, workyardSparkAlpha: 0, homesteadFloorAlpha: 0 };
    case 'workyard':
      return { hasValleyCue: true, stoneAlpha: 0.26 * variation, pathBandAlpha: 0.11, grassAlpha: 0, mistAlpha: 0.06, workyardSparkAlpha: 0.3 * variation, homesteadFloorAlpha: 0 };
    case 'homestead':
      return { hasValleyCue: true, stoneAlpha: 0.2 * variation, pathBandAlpha: 0.08, grassAlpha: 0.03, mistAlpha: 0, workyardSparkAlpha: 0, homesteadFloorAlpha: 0.2 };
    case 'legacy-field':
    case 'herb-plot':
      return { hasValleyCue: false, stoneAlpha: 0, pathBandAlpha: 0, grassAlpha: 0, mistAlpha: 0, workyardSparkAlpha: 0, homesteadFloorAlpha: 0 };
  }
}

function shouldDrawCultivationSurface(state: GameState, tile: Tile, crop?: CropInstance | null): boolean {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return true;
  return isFarmsteadFarmPlotTile(state, tile.x, tile.y) || crop != null || tile.tilled || tile.arrayId != null || tile.soilType === 'scorched';
}

function isInvestedCultivationTile(tile: Tile, crop?: CropInstance | null): boolean {
  return crop != null || tile.tilled || tile.arrayId != null || tile.soilType === 'scorched' || tile.wateredToday || tile.channeledToday;
}

function hasDirectWorldCue(tile: Pick<Tile, 'x' | 'y'>, options?: DrawWorldOptions, selectionTile?: Pick<Tile, 'id' | 'x' | 'y'>): boolean {
  return sameTilePoint(selectionTile, tile) || sameTilePoint(options?.pointerTile, tile) || sameTilePoint(options?.pendingWorld?.target, tile) || sameTilePoint(options?.pendingWorld?.destination, tile) || pendingPathIndex(options?.pendingWorld?.path, tile) >= 0;
}

export function cultivationSurfaceAlphaScale(state: GameState, tile: Tile, crop: CropInstance | null | undefined, options?: DrawWorldOptions, selectionTile?: Pick<Tile, 'id' | 'x' | 'y'>): number {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return 1;
  if (!isFarmsteadFarmPlotTile(state, tile.x, tile.y)) return 1;
  if (isInvestedCultivationTile(tile, crop)) return 1;
  if (hasDirectWorldCue(tile, options, selectionTile)) return 1;
  return FARMSTEAD_PASSIVE_FARM_PLOT_ALPHA;
}

function farmsteadAmbientTileColor(state: GameState, tile: Tile): number {
  if (!farmsteadSceneLayout(state).enabled) return SOIL_COLOR[tile.soilType] ?? ColorPalette.soil;
  if (tile.soilType === 'water') return ColorPalette.water;
  if (tile.soilType === 'rock' || tile.soilType === 'metal-ore') return ColorPalette.mountain;
  if (tile.soilType === 'scorched') return ColorPalette.scorchedSoil;

  switch (farmsteadSceneTileKind(state, tile.x, tile.y)) {
    case 'homestead':
      return ColorPalette.woodDark;
    case 'workyard':
      return ColorPalette.mountain;
    case 'gate':
      return ColorPalette.frostGray;
    case 'wild':
      return ColorPalette.moss;
    case 'courtyard':
      return ColorPalette.soilFertile;
    case 'legacy-field':
    case 'herb-plot':
      return SOIL_COLOR[tile.soilType] ?? ColorPalette.soil;
  }
}

function drawFarmsteadPaintedBackdrop(layers: RenderLayers, retainedSprites: RetainedWorldSpriteCache, state: GameState, assets?: RuntimeRenderAssets): boolean {
  const texture = assets?.maps?.['map.farmstead-courtyard-v1'];
  if (!texture || !farmsteadSceneLayout(state).enabled) return false;

  const boardW = state.width * TILE;
  const boardH = state.height * TILE;
  const sprite = retainTileSprite(layers, retainedSprites, 'world:farmstead-painted-backdrop');
  sprite.texture = texture;
  sprite.anchor.set(0.5);
  sprite.x = OX + boardW / 2;
  sprite.y = OY + boardH / 2 + 2;
  const imageRatio = 1680 / 900;
  const widthFromHeight = (boardH + 34) * imageRatio;
  const targetWidth = Math.min(LOGICAL_RENDER_REGIONS.playfield.width + 48, Math.max(boardW + 88, widthFromHeight));
  sprite.width = targetWidth;
  sprite.height = targetWidth / imageRatio;
  sprite.alpha = FARMSTEAD_PAINTED_BACKDROP_ALPHA;
  sprite.tint = ColorPalette.trueWhite;
  sprite.visible = true;
  return true;
}

function drawFarmsteadGroundCue(terrain: Graphics, state: GameState, tile: Tile, x: number, y: number): void {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return;

  const zone = farmsteadSceneTileKind(state, tile.x, tile.y);
  const tone = farmsteadZoneTone(zone);
  const cue = farmsteadValleyCueState(zone, tile);
  if (tone) {
    terrain.rect(x + 2, y + 2, TILE - 5, TILE - 5).fill({ color: tone.color, alpha: tone.alpha });
  }

  if (cue.homesteadFloorAlpha > 0) {
    terrain.rect(x + 4, y + TILE - 15, TILE - 8, 8).fill({ color: ColorPalette.paperMuted, alpha: cue.homesteadFloorAlpha });
    terrain.rect(x + 5, y + TILE - 13, TILE - 10, 1).fill({ color: ColorPalette.soilShadow, alpha: cue.homesteadFloorAlpha * 0.7 });
  }

  if (zone === 'courtyard' || zone === 'gate' || zone === 'workyard') {
    const pebbleColor = zone === 'workyard' ? ColorPalette.mountainMuted : ColorPalette.paperMuted;
    const offset = (tile.id % 3) * 3;
    terrain.ellipse(x + TILE / 2, y + TILE / 2 + 4, TILE * 0.38, 5).fill({ color: ColorPalette.paperMuted, alpha: cue.pathBandAlpha });
    terrain.ellipse(x + 11 + offset, y + 26, 4.8, 2.4).fill({ color: pebbleColor, alpha: cue.stoneAlpha });
    terrain.ellipse(x + 28 - offset, y + 15, 3.8, 2).fill({ color: pebbleColor, alpha: cue.stoneAlpha * 0.8 });
    terrain.rect(x + 7, y + TILE / 2 - 2, TILE - 14, 4).fill({ color: ColorPalette.paperMuted, alpha: cue.pathBandAlpha * 0.72 });
  }

  if (cue.mistAlpha > 0) {
    const offset = tile.id % 7;
    terrain
      .moveTo(x + 4, y + 10 + offset)
      .lineTo(x + TILE - 5, y + 7 + offset)
      .stroke({ width: 1.1, color: ColorPalette.frost, alpha: cue.mistAlpha });
    terrain
      .moveTo(x + 12, y + 18 + (offset % 3))
      .lineTo(x + TILE - 9, y + 17 + (offset % 3))
      .stroke({ width: 0.9, color: ColorPalette.moonWhite, alpha: cue.mistAlpha * 0.48 });
  }

  if (zone === 'wild') {
    const bladeOffset = tile.id % 5;
    terrain
      .moveTo(x + 9 + bladeOffset, y + 28)
      .lineTo(x + 12 + bladeOffset, y + 19)
      .stroke({ width: 1.5, color: ColorPalette.mossBright, alpha: cue.grassAlpha });
    terrain
      .moveTo(x + 27 - bladeOffset, y + 31)
      .lineTo(x + 24 - bladeOffset, y + 22)
      .stroke({ width: 1.3, color: ColorPalette.leafDark, alpha: cue.grassAlpha * 0.8 });
    terrain.circle(x + 24 + (bladeOffset % 3), y + 27, 2.4).fill({ color: ColorPalette.mossBright, alpha: cue.grassAlpha * 0.54 });
  }

  if (cue.workyardSparkAlpha > 0) {
    const sparkX = x + 12 + (tile.id % 17);
    const sparkY = y + 13 + (tile.id % 11);
    terrain.circle(sparkX, sparkY, 1.8).fill({ color: ColorPalette.emberBright, alpha: cue.workyardSparkAlpha });
    terrain.rect(x + 10, y + TILE - 12, TILE - 20, 3).fill({ color: ColorPalette.mountainMuted, alpha: cue.stoneAlpha * 0.72 });
  }

  if (isFarmsteadFarmPlotTile(state, tile.x, tile.y)) {
    terrain.rect(x + 2, y + 2, TILE - 5, TILE - 5).stroke({ width: 1, color: ColorPalette.moss, alpha: 0.06 });
  }
}

function drawFarmsteadPlotFrame(terrain: Graphics, state: GameState): void {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return;
  const r = layout.herbPlot;
  const x = OX + r.x * TILE;
  const y = OY + r.y * TILE;
  const w = r.width * TILE;
  const h = r.height * TILE;
  terrain.rect(x + 2, y + 2, w - 5, h - 5).stroke({ width: 2, color: ColorPalette.mossBright, alpha: 0.2 });
  terrain.rect(x + 5, y + 5, w - 11, h - 11).stroke({ width: 1, color: ColorPalette.soilHighlight, alpha: 0.12 });

  for (let px = r.x; px < r.x + r.width; px += 1) {
    const sx = OX + px * TILE;
    terrain.rect(sx + 5, y - 1, 8, 5).fill({ color: ColorPalette.woodDark, alpha: 0.24 });
    terrain.rect(sx + 28, y + h - 5, 8, 5).fill({ color: ColorPalette.woodDark, alpha: 0.22 });
  }
  for (let py = r.y; py < r.y + r.height; py += 1) {
    const sy = OY + py * TILE;
    terrain.rect(x - 1, sy + 7, 5, 8).fill({ color: ColorPalette.woodDark, alpha: 0.22 });
    terrain.rect(x + w - 5, sy + 25, 5, 8).fill({ color: ColorPalette.woodDark, alpha: 0.22 });
  }
}

function drawFarmsteadObjectBase(e: Graphics, object: FarmsteadSceneObject, x: number, y: number): void {
  const accent = object.kind === 'furnace' ? ColorPalette.cinnabarOrange : object.kind === 'array-shed' ? ColorPalette.qiFlow : object.kind === 'map-gate' ? ColorPalette.gilt : ColorPalette.soilHighlight;
  e.ellipse(x + TILE / 2, y + TILE - 8, 16, 4).fill({ color: ColorPalette.inkShadow, alpha: 0.26 });
  e.roundRect(x + 5, y + TILE - 17, TILE - 10, 10, 4).fill({ color: ColorPalette.soilShadow, alpha: 0.28 });
  e.roundRect(x + 7, y + TILE - 18, TILE - 14, 8, 4).stroke({ width: 1, color: accent, alpha: 0.38 });
}

function farmsteadObjectTexture(object: FarmsteadSceneObject, assets?: RuntimeRenderAssets): Texture | undefined {
  if (object.assetId.startsWith('facility.')) {
    return assets?.facilities[object.assetId.slice('facility.'.length)];
  }
  if (object.assetId.startsWith('loc.')) {
    return assets?.locations[object.assetId.slice('loc.'.length) as LocationId];
  }
  if (object.assetId.startsWith('map-sprite.')) {
    return assets?.mapSprites?.[object.assetId];
  }
  return undefined;
}

function drawFarmsteadHouse(e: Graphics, object: FarmsteadSceneObject): void {
  const footprint = object.footprint ?? { x: object.x, y: object.y, width: 1, height: 1 };
  const x = OX + footprint.x * TILE;
  const y = OY + footprint.y * TILE;
  const w = footprint.width * TILE;
  const h = footprint.height * TILE;
  e.ellipse(x + w / 2, y + h - 4, w * 0.36, 7).fill({ color: ColorPalette.inkShadow, alpha: 0.26 });
  e.roundRect(x + 12, y + h - 17, w - 24, 10, 4).fill({ color: ColorPalette.soilShadow, alpha: 0.25 });
  e.poly([x + 4, y + 19, x + w / 2, y + 3, x + w - 4, y + 19]).fill({ color: ColorPalette.cinnabarOrange, alpha: 0.92 });
  e.poly([x + 4, y + 19, x + w / 2, y + 3, x + w - 4, y + 19]).stroke({ width: 1.4, color: ColorPalette.soilShadow, alpha: 0.9 });
  e.roundRect(x + 10, y + 19, w - 20, h - 24, 4).fill({ color: ColorPalette.wood, alpha: 0.94 });
  e.roundRect(x + 10, y + 19, w - 20, h - 24, 4).stroke({ width: 1.4, color: ColorPalette.soilShadow, alpha: 0.9 });
  e.rect(x + w / 2 - 6, y + h - 23, 12, 19).fill({ color: ColorPalette.inkUi, alpha: 0.88 });
  e.rect(x + 18, y + 29, 11, 9).fill({ color: ColorPalette.paperMuted, alpha: 0.45 });
  e.rect(x + w / 2 - 8, y + h - 5, 16, 3).fill({ color: ColorPalette.paperMuted, alpha: 0.42 });
}

function drawFarmsteadFallbackObject(e: Graphics, object: FarmsteadSceneObject, x: number, y: number, ambientTimeMs: number, reducedMotion: boolean): void {
  const pulse = reducedMotion ? 0.65 : 0.55 + Math.sin((ambientTimeMs / 1400 + object.x * 0.13 + object.y * 0.07) * Math.PI * 2) * 0.1;
  if (object.kind === 'furnace') {
    e.circle(x + TILE / 2, y + TILE / 2 + 1, 12).fill({ color: ColorPalette.cinnabarOrange, alpha: 0.92 });
    e.circle(x + TILE / 2, y + TILE / 2 + 1, 12).stroke({ width: 1.8, color: ColorPalette.soilShadow, alpha: 0.94 });
    e.circle(x + TILE / 2, y + TILE / 2, 6).fill({ color: ColorPalette.emberBright, alpha: pulse });
    e.rect(x + 13, y + TILE - 13, TILE - 26, 4).fill({ color: ColorPalette.soilShadow, alpha: 0.9 });
    return;
  }

  if (object.kind === 'array-shed') {
    e.roundRect(x + 10, y + 10, TILE - 20, TILE - 16, 4).fill({ color: ColorPalette.mountain, alpha: 0.88 });
    e.roundRect(x + 10, y + 10, TILE - 20, TILE - 16, 4).stroke({ width: 1.4, color: ColorPalette.qiFlow, alpha: 0.72 });
    e.moveTo(x + TILE / 2, y + 13)
      .lineTo(x + TILE / 2, y + TILE - 12)
      .stroke({ width: 2, color: ColorPalette.qiBright, alpha: 0.82 });
    e.poly([x + TILE / 2, y + 12, x + TILE / 2 + 10, y + 17, x + TILE / 2, y + 22]).fill({ color: ColorPalette.giltBright, alpha: 0.82 });
    return;
  }

  if (object.kind === 'map-gate') {
    e.rect(x + 8, y + 8, 5, TILE - 14).fill({ color: ColorPalette.woodDark, alpha: 0.92 });
    e.rect(x + TILE - 13, y + 8, 5, TILE - 14).fill({ color: ColorPalette.woodDark, alpha: 0.92 });
    e.rect(x + 7, y + 9, TILE - 14, 5).fill({ color: ColorPalette.cinnabarOrange, alpha: 0.88 });
    e.moveTo(x + 12, y + TILE - 8)
      .lineTo(x + TILE - 12, y + TILE - 8)
      .stroke({ width: 2, color: ColorPalette.frostGray, alpha: 0.6 });
  }
}

function drawFarmsteadSceneObjects(layers: RenderLayers, retainedSprites: RetainedWorldSpriteCache, state: GameState, assets?: RuntimeRenderAssets): void {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return;
  const e = layers.entities;
  for (const object of layout.objects) {
    if (object.kind === 'storage' || object.kind === 'shipping') continue;
    if (object.kind === 'house') {
      drawFarmsteadHouse(e, object);
      continue;
    }

    const x = OX + object.x * TILE;
    const y = OY + object.y * TILE;
    drawFarmsteadObjectBase(e, object, x, y);
    const texture = farmsteadObjectTexture(object, assets);
    if (texture) {
      const sprite = retainSceneSprite(layers, retainedSprites, `world:farmstead-scene:${object.kind}`);
      const size = object.kind === 'map-gate' ? TILE - 4 : TILE - 2;
      applyWorldSprite(sprite, texture, x + TILE / 2, y + TILE / 2 + ambientBobOffset(layers.ambientTimeMs, object.x * 17 + object.y * 29, 0.8, 4200), size);
      sprite.alpha = object.kind === 'map-gate' ? 0.82 : 0.92;
      continue;
    }

    drawFarmsteadFallbackObject(e, object, x, y, layers.ambientTimeMs, layers.reducedMotion);
  }
}

function sameTilePoint(point: GridPoint | null | undefined, tile: Pick<Tile, 'x' | 'y'>): boolean {
  return point != null && point.x === tile.x && point.y === tile.y;
}

function pendingPathIndex(path: readonly GridPoint[] | undefined, tile: Pick<Tile, 'x' | 'y'>): number {
  return path?.findIndex(point => point.x === tile.x && point.y === tile.y) ?? -1;
}

function drawPointerTileCue(terrain: Graphics, state: GameState, tile: Tile, x: number, y: number, options?: DrawWorldOptions): void {
  const pointerActive = sameTilePoint(options?.pointerTile, tile);
  const pending = options?.pendingWorld ?? null;
  const pendingTarget = sameTilePoint(pending?.target, tile);
  const pendingDestination = sameTilePoint(pending?.destination, tile);
  const pathIndex = pendingPathIndex(pending?.path, tile);
  if (!pointerActive && !pendingTarget && !pendingDestination && pathIndex < 0) return;

  const object = farmsteadSceneObjectAt(state, tile.x, tile.y);
  const hasGroundItem = state.groundItems.some(item => item.pos.x === tile.x && item.pos.y === tile.y);
  const hasBuiltFacility = [...state.facilities.values()].some(facility => facility.tileId === tile.id);
  const npcPreview = npcWorldPreviewPlacementAt(state, tile.x, tile.y);
  const locationPreview = locationWorldPreviewPlacementAt(state, tile.x, tile.y);
  const farmPlot = isFarmsteadFarmPlotTile(state, tile.x, tile.y);
  const actionable = object != null || hasGroundItem || hasBuiltFacility || npcPreview != null || locationPreview != null || farmPlot || tile.cropId != null;
  const color = object || hasGroundItem || hasBuiltFacility || npcPreview || locationPreview ? ColorPalette.giltBright : farmPlot || tile.cropId != null ? ColorPalette.qiBright : ColorPalette.mountainMuted;

  if (pathIndex >= 0) {
    const pathLength = Math.max(1, pending?.path.length ?? 1);
    const alpha = Math.max(0.22, 0.52 - pathIndex / pathLength / 3);
    terrain.circle(x + TILE / 2, y + TILE - 8, pendingDestination ? 5.5 : 3.2).fill({ color: ColorPalette.giltBright, alpha });
    terrain.circle(x + TILE / 2, y + TILE - 8, pendingDestination ? 5.5 : 3.2).stroke({ width: 1, color: ColorPalette.inkPanelDeep, alpha: 0.62 });
  }

  if (pendingDestination && !pendingTarget) {
    terrain.ellipse(x + TILE / 2 - 5, y + TILE - 10, 5, 2.5).fill({ color: ColorPalette.paperText, alpha: 0.32 });
    terrain.ellipse(x + TILE / 2 + 6, y + TILE - 8, 5, 2.5).fill({ color: ColorPalette.paperText, alpha: 0.32 });
    terrain.rect(x + 4, y + 4, TILE - 9, TILE - 9).stroke({ width: 1.4, color: ColorPalette.giltBright, alpha: 0.64 });
  }

  if (pendingTarget) {
    const targetColor = actionable ? color : ColorPalette.giltBright;
    terrain.rect(x + 1, y + 1, TILE - 3, TILE - 3).fill({ color: ColorPalette.giltBright, alpha: actionable ? 0.12 : 0.08 });
    terrain.rect(x + 1, y + 1, TILE - 3, TILE - 3).stroke({ width: 3, color: targetColor, alpha: 0.94 });
    terrain.rect(x + 6, y + 6, TILE - 13, TILE - 13).stroke({ width: 1.2, color: ColorPalette.trueWhite, alpha: 0.7 });
  }

  if (!pointerActive) return;
  terrain.rect(x + 1, y + 1, TILE - 3, TILE - 3).fill({ color: ColorPalette.trueWhite, alpha: pendingTarget ? 0.05 : actionable ? 0.1 : 0.045 });
  terrain.rect(x + 1, y + 1, TILE - 3, TILE - 3).stroke({ width: actionable ? 2.4 : 1.5, color, alpha: actionable ? 0.86 : 0.52 });
  terrain.rect(x + 5, y + 5, TILE - 11, TILE - 11).stroke({ width: 1, color: ColorPalette.moonWhite, alpha: actionable ? 0.58 : 0.28 });
}

function applyWorldSprite(sprite: Sprite, texture: Texture, x: number, y: number, size = TILE): void {
  sprite.texture = texture;
  sprite.anchor.set(0.5);
  sprite.x = x;
  sprite.y = y;
  sprite.width = size;
  sprite.height = size;
  sprite.alpha = 1;
  sprite.tint = ColorPalette.trueWhite;
  sprite.visible = true;
}

function applyWorldCharacterSprite(sprite: Sprite, texture: Texture, x: number, y: number, width: number, height: number): void {
  sprite.texture = texture;
  sprite.anchor.set(0.5);
  sprite.x = x;
  sprite.y = y;
  sprite.width = width;
  sprite.height = height;
  sprite.alpha = 1;
  sprite.tint = ColorPalette.trueWhite;
  sprite.visible = true;
}

function drawWorldCharacterPedestal(e: Graphics, cx: number, cy: number, accent: number, kind: 'player' | 'npc', walkCycle?: CharacterWalkCycle): void {
  const shadow = footShadowSpec(kind);
  const shadowScaleX = walkCycle?.shadowScaleX ?? 1;
  const shadowScaleY = walkCycle?.shadowScaleY ?? 1;
  e.ellipse(cx, cy + shadow.yOffset, (shadow.width / 2) * shadowScaleX, (shadow.height / 2) * shadowScaleY).fill({
    color: ColorPalette.inkShadow,
    alpha: shadow.alpha
  });
  const radius = kind === 'player' ? 22 : 19;
  e.circle(cx, cy - 5, radius).fill({ color: ColorPalette.inkPanel, alpha: kind === 'player' ? 0.18 : 0.14 });
  e.circle(cx, cy - 5, radius).stroke({ width: kind === 'player' ? 1.8 : 1.2, color: accent, alpha: kind === 'player' ? 0.48 : 0.34 });
  e.ellipse(cx, cy + 12, radius * 0.72, 4.5).stroke({ width: 1.2, color: accent, alpha: kind === 'player' ? 0.44 : 0.28 });
}

function drawWorldCharacterReadabilityHalo(e: Graphics, cx: number, cy: number, accent: number, kind: 'player' | 'npc', walkCycle?: CharacterWalkCycle): void {
  const spec = worldCharacterReadabilityHaloSpec(kind);
  const width = spec.width * (walkCycle?.bodyScaleX ?? 1);
  const height = spec.height * (walkCycle?.bodyScaleY ?? 1);
  const centerY = cy + spec.yOffset;
  e.ellipse(cx + 1.5, centerY + 2, width * 0.52, height * 0.52).fill({ color: ColorPalette.inkShadow, alpha: spec.strokeAlpha * 0.38 });
  e.ellipse(cx, centerY, width * 0.5, height * 0.5).fill({ color: ColorPalette.paperWarm, alpha: spec.fillAlpha });
  e.ellipse(cx, centerY, width * 0.5, height * 0.5).stroke({ width: kind === 'player' ? 1.4 : 1.1, color: ColorPalette.inkShadow, alpha: spec.strokeAlpha });
  e.ellipse(cx, centerY, width * 0.43, height * 0.43).stroke({
    width: 1,
    color: accent,
    alpha: kind === 'player' ? 0.18 : 0.14
  });
}

function drawPlayerWalkFootfalls(e: Graphics, cx: number, cy: number, walkCycle: CharacterWalkCycle, moving: boolean): void {
  if (!moving) return;
  for (const foot of [walkCycle.leftFoot, walkCycle.rightFoot]) {
    e.ellipse(cx + foot.x, cy + foot.y, 5.6, 2.4).fill({ color: ColorPalette.paperText, alpha: foot.alpha * 0.4 });
    e.ellipse(cx + foot.x, cy + foot.y, 5.6, 2.4).stroke({ width: 0.8, color: ColorPalette.giltBright, alpha: foot.alpha });
  }
}

function drawNpcWorldFallback(e: Graphics, cx: number, cy: number, assetId: string): void {
  const p = npcWorldFallbackPresentation(assetId);
  drawWorldCharacterPedestal(e, cx, cy, p.trimColor, 'npc');

  e.ellipse(cx, cy + 6, 11, 15).fill({ color: p.robeColor, alpha: 0.94 });
  e.ellipse(cx, cy + 6, 11, 15).stroke({ width: 1.5, color: ColorPalette.soilShadow, alpha: 0.9 });
  e.circle(cx, cy - 13, 8).fill({ color: ColorPalette.paperWarm, alpha: 0.98 });
  e.circle(cx, cy - 13, 8).stroke({ width: 1.4, color: ColorPalette.soilShadow, alpha: 0.9 });
  e.arc(cx, cy - 15, 8, Math.PI, 0).stroke({ width: 2.2, color: p.role === 'elder' ? ColorPalette.frost : ColorPalette.inkPanelDeep, alpha: 0.95 });
  e.rect(cx - 7, cy + 6, 14, 3).fill({ color: p.trimColor, alpha: 0.92 });
  e.circle(cx - 3, cy - 13, 1.2).fill({ color: ColorPalette.inkPanelDeep, alpha: 0.92 });
  e.circle(cx + 3, cy - 13, 1.2).fill({ color: ColorPalette.inkPanelDeep, alpha: 0.92 });

  switch (p.role) {
    case 'merchant':
      e.roundRect(cx - 20, cy - 3, 10, 18, 4).fill({ color: ColorPalette.soilDeep, alpha: 0.9 });
      e.circle(cx - 15, cy + 6, 3.5).fill({ color: p.propColor, alpha: 0.9 });
      break;
    case 'elder':
      e.rect(cx - 18, cy - 20, 3, 34).fill({ color: ColorPalette.soilShadow, alpha: 0.9 });
      e.circle(cx - 16.5, cy - 22, 4).fill({ color: p.propColor, alpha: 0.64 });
      break;
    case 'artisan':
      e.roundRect(cx - 19, cy + 5, 18, 7, 3).fill({ color: ColorPalette.soilHighlight, alpha: 0.9 });
      e.circle(cx - 12, cy + 4, 2.5).fill({ color: p.propColor, alpha: 0.95 });
      break;
    case 'guard':
      e.rect(cx + 15, cy - 24, 3, 41).fill({ color: ColorPalette.soilShadow, alpha: 0.92 });
      e.poly([cx + 16.5, cy - 32, cx + 22, cy - 21, cx + 11, cy - 21]).fill({ color: p.propColor, alpha: 0.92 });
      break;
    case 'smith':
      e.circle(cx + 16, cy + 1, 6).stroke({ width: 2, color: p.propColor, alpha: 0.9 });
      e.poly([cx + 16, cy - 7, cx + 20, cy + 1, cx + 16, cy + 9, cx + 12, cy + 1]).fill({ color: ColorPalette.danger, alpha: 0.78 });
      break;
    case 'gatherer':
      e.roundRect(cx - 21, cy + 1, 12, 11, 5).fill({ color: ColorPalette.soil, alpha: 0.9 });
      e.circle(cx - 17, cy - 3, 3).fill({ color: ColorPalette.success, alpha: 0.94 });
      e.circle(cx - 12, cy - 2, 3).fill({ color: ColorPalette.leaf, alpha: 0.9 });
      break;
    default:
      e.circle(cx + 15, cy - 3, 4).stroke({ width: 1.8, color: p.propColor, alpha: 0.84 });
      break;
  }
}

function groundItemQualityColor(quality: CropQuality | undefined): number {
  switch (quality) {
    case 'treasure':
      return ColorPalette.giltBright;
    case 'spirit':
      return ColorPalette.qiBright;
    case 'mortal':
      return ColorPalette.soilWarm;
    default:
      return ColorPalette.mountainMuted;
  }
}

function drawGroundItemBadge(e: Graphics, x: number, y: number, item: GroundItem): void {
  if (item.quality) {
    e.poly([x + TILE - 13, y + 7, x + TILE - 8, y + 12, x + TILE - 13, y + 17, x + TILE - 18, y + 12]).fill({
      color: groundItemQualityColor(item.quality),
      alpha: 0.96
    });
    e.poly([x + TILE - 13, y + 7, x + TILE - 8, y + 12, x + TILE - 13, y + 17, x + TILE - 18, y + 12]).stroke({
      width: 1,
      color: ColorPalette.inkPanelDeep,
      alpha: 0.88
    });
  }
  if (item.count > 1) {
    e.roundRect(x + TILE - 18, y + TILE - 16, 14, 9, 3).fill({ color: ColorPalette.inkPanel, alpha: 0.92 });
    e.roundRect(x + TILE - 18, y + TILE - 16, 14, 9, 3).stroke({ width: 1, color: ColorPalette.paperGold, alpha: 0.82 });
    const dots = Math.min(3, item.count);
    for (let i = 0; i < dots; i += 1) {
      e.circle(x + TILE - 14 + i * 4, y + TILE - 11.5, 1.15).fill({ color: ColorPalette.paperText, alpha: 0.95 });
    }
  }
}

function drawGroundItemFallback(e: Graphics, x: number, y: number, item: GroundItem): void {
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  const accent = groundItemQualityColor(item.quality);
  e.roundRect(cx - 10, cy - 9, 20, 17, 5).fill({ color: ColorPalette.paperWarm, alpha: 0.94 });
  e.roundRect(cx - 10, cy - 9, 20, 17, 5).stroke({ width: 1.4, color: accent, alpha: 0.86 });
  e.rect(cx - 6, cy - 2, 12, 3).fill({ color: ColorPalette.mountainMuted, alpha: 0.7 });
  if (item.itemId.startsWith('seed.')) {
    e.circle(cx, cy, 3.5).fill({ color: ColorPalette.mossBright, alpha: 0.94 });
  } else if (item.itemId.startsWith('pill.')) {
    e.circle(cx, cy, 4).fill({ color: ColorPalette.cinnabarOrange, alpha: 0.94 });
  } else if (item.itemId.startsWith('herb.')) {
    e.moveTo(cx, cy + 5)
      .lineTo(cx, cy - 5)
      .stroke({ width: 1.5, color: ColorPalette.leafDark, alpha: 0.9 });
    e.circle(cx - 3, cy - 3, 3).fill({ color: ColorPalette.leaf, alpha: 0.9 });
    e.circle(cx + 3, cy - 1, 3).fill({ color: ColorPalette.mossBright, alpha: 0.9 });
  } else {
    e.circle(cx, cy, 4).fill({ color: ColorPalette.giltBright, alpha: 0.9 });
  }
}

function drawGroundItems(layers: RenderLayers, retainedSprites: RetainedWorldSpriteCache, state: GameState, content: ContentRegistry, assets?: RuntimeRenderAssets): void {
  const e = layers.entities;
  for (const item of state.groundItems) {
    const x = OX + item.pos.x * TILE;
    const y = OY + item.pos.y * TILE;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    const bob = ambientBobOffset(layers.ambientTimeMs, item.id * 19, 1.1, 2600);
    e.ellipse(cx, cy + 10, 10, 4).fill({ color: ColorPalette.inkShadow, alpha: 0.34 });
    const texture = assets?.itemIcons[itemIconAssetId(item.itemId, content) ?? ''];
    if (texture) {
      e.circle(cx, cy + bob, 13).fill({ color: ColorPalette.paperWarm, alpha: 0.58 });
      e.circle(cx, cy + bob, 13).stroke({ width: 1.2, color: groundItemQualityColor(item.quality), alpha: 0.72 });
      const sprite = retainSceneSprite(layers, retainedSprites, `world:ground-item:${item.id}`);
      applyWorldSprite(sprite, texture, cx, cy + bob, 26);
      sprite.alpha = 0.95;
    } else {
      drawGroundItemFallback(e, x, y + bob, item);
    }
    drawGroundItemBadge(e, x, y, item);
  }
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
  return assetId.startsWith('loc.') || assetId.startsWith('sprite.npc.') || assetId.startsWith('map-sprite.') || assetId.startsWith('facility.') || assetId === 'tile.scorched' || assetId === 'logo.full' || assetId === 'logo.emblem';
}

export function facilityWorldBadgeAssetId(outputItemId?: string): string | undefined {
  return outputItemId ? itemIconAssetId(outputItemId) : undefined;
}

function firstNonZeroRecordItem(items: Record<string, number>): string | undefined {
  return Object.entries(items).find(([, count]) => count > 0)?.[0];
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

  const storageItemId = Object.entries(state.storage.inventory).find(([, slot]) => (slot?.count ?? 0) > 0)?.[0];
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
  return serviceAssetId?.startsWith('icon.') || serviceAssetId?.startsWith('sprite.npc.') || serviceAssetId?.startsWith('map-sprite.') ? serviceAssetId : undefined;
}

export interface LocationWorldBadgeLayout {
  birthday: { x: number; y: number };
  quest: { x: number; y: number };
  service: { x: number; y: number };
  task: { x: number; y: number };
  crowd: { x: number; y: number };
}

export function locationWorldBadgeLayout(options: { hasBirthday: boolean; hasQuest: boolean; hasService: boolean; hasTask: boolean; npcCount: number }): LocationWorldBadgeLayout {
  const bottomLeft = options.hasService ? { x: 10, y: TILE - 10 } : { x: 9, y: TILE - 9 };
  const bottomRight = options.npcCount > 1 ? { x: TILE - 19, y: TILE - 10 } : { x: TILE - 10, y: TILE - 10 };
  const taskAnchor = options.hasService || options.npcCount > 1 ? bottomRight : bottomLeft;

  return {
    birthday: { x: 10, y: 10 },
    quest: { x: TILE - 10, y: 10 },
    service: bottomLeft,
    task: taskAnchor,
    crowd: { x: TILE - 15, y: TILE - 15 }
  };
}

interface RetainedWorldSpriteCache {
  tileSprites: Map<string, Sprite>;
  sceneSprites: Map<string, Sprite>;
  npcMarkers: Map<string, Graphics>;
  usedTileSprites: Set<string>;
  usedSceneSprites: Set<string>;
  usedNpcMarkers: Set<string>;
  tileOrder: Sprite[];
  sceneOrder: Sprite[];
  npcMarkerOrder: Graphics[];
}

const RETAINED_WORLD_SPRITES = new WeakMap<RenderLayers, RetainedWorldSpriteCache>();

function retainedWorldSpriteCache(layers: RenderLayers): RetainedWorldSpriteCache {
  const existing = RETAINED_WORLD_SPRITES.get(layers);
  if (existing) return existing;
  const created: RetainedWorldSpriteCache = {
    tileSprites: new Map(),
    sceneSprites: new Map(),
    npcMarkers: new Map(),
    usedTileSprites: new Set(),
    usedSceneSprites: new Set(),
    usedNpcMarkers: new Set(),
    tileOrder: [],
    sceneOrder: [],
    npcMarkerOrder: []
  };
  RETAINED_WORLD_SPRITES.set(layers, created);
  return created;
}

function beginRetainedWorldFrame(layers: RenderLayers): RetainedWorldSpriteCache {
  const cache = retainedWorldSpriteCache(layers);
  cache.usedTileSprites.clear();
  cache.usedSceneSprites.clear();
  cache.usedNpcMarkers.clear();
  cache.tileOrder.length = 0;
  cache.sceneOrder.length = 0;
  cache.npcMarkerOrder.length = 0;
  return cache;
}

function retainSprite(container: Container, sprites: Map<string, Sprite>, used: Set<string>, order: Sprite[], label: string): Sprite {
  let sprite = sprites.get(label);
  if (!sprite || sprite.destroyed) {
    sprite = new Sprite();
    sprite.label = label;
    sprites.set(label, sprite);
  }
  if (sprite.parent !== container) container.addChild(sprite);
  if (!used.has(label)) {
    used.add(label);
    order.push(sprite);
  }
  return sprite;
}

function retainTileSprite(layers: RenderLayers, cache: RetainedWorldSpriteCache, label: string): Sprite {
  return retainSprite(layers.tileSprites, cache.tileSprites, cache.usedTileSprites, cache.tileOrder, label);
}

function retainSceneSprite(layers: RenderLayers, cache: RetainedWorldSpriteCache, label: string): Sprite {
  return retainSprite(layers.sceneSprites, cache.sceneSprites, cache.usedSceneSprites, cache.sceneOrder, label);
}

function retainNpcMarker(layers: RenderLayers, cache: RetainedWorldSpriteCache, label: string): Graphics {
  let marker = cache.npcMarkers.get(label);
  if (!marker || marker.destroyed) {
    marker = new Graphics();
    marker.label = label;
    cache.npcMarkers.set(label, marker);
  }
  if (marker.parent !== layers.npcMarkers) layers.npcMarkers.addChild(marker);
  if (!cache.usedNpcMarkers.has(label)) {
    cache.usedNpcMarkers.add(label);
    cache.npcMarkerOrder.push(marker);
  }
  return marker;
}

function sweepRetainedSprites(container: Container, sprites: Map<string, Sprite>, used: ReadonlySet<string>): void {
  for (const [label, sprite] of sprites) {
    if (used.has(label)) continue;
    if (sprite.parent === container) container.removeChild(sprite);
    sprite.destroy();
    sprites.delete(label);
  }
}

function orderRetainedSprites(container: Container, order: readonly Sprite[]): void {
  for (let index = 0; index < order.length; index += 1) {
    const sprite = order[index]!;
    if (container.getChildIndex(sprite) !== index) container.setChildIndex(sprite, index);
  }
}

function sweepRetainedNpcMarkers(cache: RetainedWorldSpriteCache, layers: RenderLayers): void {
  for (const [label, marker] of cache.npcMarkers) {
    if (cache.usedNpcMarkers.has(label)) continue;
    if (marker.parent === layers.npcMarkers) layers.npcMarkers.removeChild(marker);
    marker.destroy();
    cache.npcMarkers.delete(label);
  }
}

function orderRetainedNpcMarkers(layers: RenderLayers, order: readonly Graphics[]): void {
  for (let index = 0; index < order.length; index += 1) {
    const marker = order[index]!;
    if (layers.npcMarkers.getChildIndex(marker) !== index) layers.npcMarkers.setChildIndex(marker, index);
  }
}

function finishRetainedWorldFrame(layers: RenderLayers, cache: RetainedWorldSpriteCache): void {
  sweepRetainedSprites(layers.tileSprites, cache.tileSprites, cache.usedTileSprites);
  sweepRetainedSprites(layers.sceneSprites, cache.sceneSprites, cache.usedSceneSprites);
  sweepRetainedNpcMarkers(cache, layers);
  orderRetainedSprites(layers.tileSprites, cache.tileOrder);
  orderRetainedSprites(layers.sceneSprites, cache.sceneOrder);
  orderRetainedNpcMarkers(layers, cache.npcMarkerOrder);
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
    .filter(entry => assets?.itemIcons[entry.iconId])
    .slice(0, 10);
  if (entries.length === 0) return;

  const root = layers.invIcons;
  const startX = SCREEN_W - 248;
  const startY = 78;
  const gapY = 34;
  const qualityTint: Record<string, number> = {
    treasure: ColorPalette.warningSoft,
    spirit: ColorPalette.qiPale,
    mortal: ColorPalette.loessMuted
  };

  entries.forEach((entry, index) => {
    const texture = assets?.itemIcons[entry.iconId];
    if (!texture) return;
    const y = startY + index * gapY;
    const bg = new Graphics();
    const sectionColor = entry.section === 'inventory' ? ColorPalette.grayGreenDark : entry.section === 'storage' ? ColorPalette.accentPurple : ColorPalette.woodDark;
    bg.roundRect(startX, y, 28, 28, 6).fill({ color: ColorPalette.inkPanel, alpha: 0.94 });
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
    countBg.roundRect(startX + 16, y + 16, 16, 12, 4).fill({ color: ColorPalette.inkVoid, alpha: 0.92 });
    root.addChild(countBg);

    const countText = new Text({
      text: `${entry.count}`,
      style: { fontFamily: CJK_FONT, fontSize: 9, fill: ColorPalette.paperText, align: 'center' }
    });
    countText.anchor.set(0.5);
    countText.x = startX + 24;
    countText.y = y + 22;
    root.addChild(countText);

    if (entry.quality) {
      const quality = new Graphics();
      quality.circle(startX + 4, y + 4, 3).fill({ color: qualityTint[entry.quality] ?? ColorPalette.paperText, alpha: 0.95 });
      root.addChild(quality);
    }
  });

  root.visible = true;
}

/** 触发天劫闪光（T3b）。ttl 帧后自动衰减。 */
export function triggerTribFlash(layers: RenderLayers, frames = 30): void {
  layers.tribFlashTtl = frames;
}

/**
 * 触发招牌雷劫电光（分形折线 + 命中点）。
 * 纯渲染层；screenImpact 为屏幕像素坐标（可用 screenPointForTile）。
 */
export function triggerTribBolt(layers: RenderLayers, screenImpact: { x: number; y: number }, frames = 28): void {
  const start = { x: screenImpact.x + (Math.random() * 2 - 1) * 40, y: -12 };
  layers.tribBoltGeom = generateLightningBolt(start, { x: screenImpact.x, y: screenImpact.y }, { iterations: 5, amplitude: 44 });
  layers.tribBoltTtl = frames;
  layers.tribBoltMaxTtl = frames;
  // 同步保留轻量全屏闪，避免电光过短时「完全无冲击」
  if (layers.tribFlashTtl < Math.min(18, frames)) layers.tribFlashTtl = Math.min(18, frames);
  triggerShake(layers, Math.max(frames - 8, 10), 3.5);
}

/** 世界层轻量屏震（不改 sim；与 HUD/focus 解耦）。 */
export function triggerShake(layers: RenderLayers, frames = 12, magnitude = 2.5): void {
  layers.shakeTtl = Math.max(layers.shakeTtl, frames);
  layers.shakeMagnitude = Math.max(layers.shakeMagnitude, magnitude);
}

function advanceWorldShake(layers: RenderLayers): void {
  if (layers.shakeTtl <= 0) {
    layers.worldRoot.x = 0;
    layers.worldRoot.y = 0;
    layers.shakeMagnitude = 0;
    return;
  }
  const mag = layers.shakeMagnitude * (layers.shakeTtl / Math.max(layers.shakeTtl, 12));
  layers.worldRoot.x = (Math.random() * 2 - 1) * mag;
  layers.worldRoot.y = (Math.random() * 2 - 1) * mag;
  layers.shakeTtl -= 1;
  if (layers.shakeTtl <= 0) {
    layers.worldRoot.x = 0;
    layers.worldRoot.y = 0;
    layers.shakeMagnitude = 0;
  }
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

/** 飘字定格期（帧，~0.3s）：在此期间不上飘、alpha 满值、做 punch 缩放，保证玩家读得清动作反馈。 */
const FLOAT_TEXT_HOLD_FRAMES = 18;
/** 定格期峰值放大（sin 包络，定格中点最大）。 */
const FLOAT_TEXT_PUNCH = 0.32;

/** 在屏幕坐标生成一条上飘短文案（纯渲染 juice）：先定格 punch，再上飘淡出。 */
export function spawnFloatText(layers: RenderLayers, x: number, y: number, text: string, color: number = ColorPalette.giltBright): void {
  if (layers.floatTexts.length > 24) layers.floatTexts.splice(0, layers.floatTexts.length - 24);
  layers.floatTexts.push({
    x,
    y,
    vy: -0.85,
    life: 64,
    maxLife: 64,
    text,
    color
  });
}

/** 推进飘字并同步 Text 节点（每帧）。 */
export function updateFloatTexts(layers: RenderLayers): void {
  const root = layers.floatTextLayer;
  const list = layers.floatTexts;
  while (root.children.length > list.length) {
    const child = root.children[root.children.length - 1]!;
    root.removeChild(child);
    child.destroy();
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const ft = list[i]!;
    // 定格期（前 FLOAT_TEXT_HOLD_FRAMES 帧）不上飘，给玩家读清反馈的时间。
    const elapsed = ft.maxLife - ft.life;
    const inHold = elapsed < FLOAT_TEXT_HOLD_FRAMES;
    if (!inHold) {
      ft.y += ft.vy;
    }
    ft.life -= 1;
    if (ft.life <= 0) {
      list.splice(i, 1);
      continue;
    }
    let label = root.children[i] as Text | undefined;
    if (!label) {
      label = new Text({
        text: ft.text,
        style: {
          fontFamily: CJK_FONT,
          fontSize: 14,
          fontWeight: '700',
          fill: ft.color,
          stroke: { color: ColorPalette.inkPanel, width: 3 },
          dropShadow: { color: ColorPalette.black, blur: 2, distance: 1, alpha: 0.45 }
        }
      });
      root.addChild(label);
    } else if (setTextIfChanged(label, ft.text)) {
      label.style.fill = ft.color;
    }
    // 定格期 alpha 满值 + sin 包络 punch；之后在剩余寿命上线性淡出。
    const fadeMax = ft.maxLife - FLOAT_TEXT_HOLD_FRAMES;
    const alpha = inHold ? 1 : Math.max(0, ft.life / fadeMax);
    label.alpha = alpha;
    const punch = inHold ? 1 + FLOAT_TEXT_PUNCH * Math.sin((elapsed / FLOAT_TEXT_HOLD_FRAMES) * Math.PI) : 1;
    label.scale.set(punch);
    // 避免依赖 canvas measureText（headless unit 无 document）；用字数估算居中。
    const approxWidth = Math.min(280, Math.max(24, ft.text.length * 12));
    label.x = ft.x - approxWidth / 2;
    label.y = ft.y;
  }
  // 列表变短后上面已裁；若变长需补节点（上面循环仅处理现有 index）
  while (root.children.length < list.length) {
    const ft = list[root.children.length]!;
    const label = new Text({
      text: ft.text,
      style: {
        fontFamily: CJK_FONT,
        fontSize: 14,
        fontWeight: '700',
        fill: ft.color,
        stroke: { color: ColorPalette.inkPanel, width: 3 }
      }
    });
    label.x = ft.x - 12;
    label.y = ft.y;
    root.addChild(label);
  }
}

/** 画一根水平条（背景 + 填充 + 描边）。pct 钳到 [0,1]。 */
function drawBar(g: Graphics, x: number, y: number, w: number, h: number, pct: number, fill: number): void {
  g.rect(x, y, w, h).fill({ color: ColorPalette.inkPanelDeep, alpha: 0.9 });
  const fw = Math.max(0, Math.min(1, pct)) * (w - 2);
  if (fw > 0) g.rect(x + 1, y + 1, fw, h - 2).fill(fill);
  g.rect(x, y, w, h).stroke({ width: 1, color: ColorPalette.borderDark });
}

const INV_GROUPS: Array<{ prefix: string; titleKey: string }> = [
  { prefix: 'seed.', titleKey: 'ui.hud.invSeed' },
  { prefix: 'herb.', titleKey: 'ui.hud.invHerb' },
  { prefix: 'pill.', titleKey: 'ui.hud.invPill' },
  { prefix: 'item.', titleKey: 'ui.hud.invMisc' }
];

const QUALITY_LABEL: Record<CropQuality, string> = {
  mortal: '凡品',
  spirit: '灵品',
  treasure: '珍品'
};

const QUALITY_ORDER: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];

/** 背包按类目分组渲染（种子/灵草/丹药/杂物/其他）。 */
export function renderInventory(state: GameState, content: ContentRegistry): string {
  const entries = Object.entries(state.player.inventory).filter(([, s]) => s && s.count > 0);
  const qualityEntries = QUALITY_ORDER.flatMap(quality => {
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
    const grp = INV_GROUPS.find(g => id.startsWith(g.prefix));
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
  const qualityEntries = QUALITY_ORDER.flatMap(quality => {
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
  const foundationText = nextCap == null ? `${Math.round(p.bodyFoundation / 1000)}` : `${Math.round(p.bodyFoundation / 1000)} / ${Math.round(nextCap / 1000)}`;
  const tribulationState = frozen ? '留驻此界后境界已止步' : readyToInvokeTribulation(state, ctx.params) ? '可主动引劫' : state.tribulation.status === 'countdown' ? `天劫将至：${state.tribulation.daysRemaining}日` : state.tribulation.status === 'due' ? '天劫已临门' : '尚未满足引劫条件';
  const fateState = frozen ? (victoryRecorded ? '已登天门｜留世守境' : '留世守境') : `因果债 ${Math.round(p.heavenDebt / 1000)}｜天道注视 ${Math.round(p.daoAttention / 1000)}`;
  const victoryText = frozen && victoryRecorded ? '胜后存档：已完成飞升，可继续留世经营' : null;
  const leak = bodyLeakPresentation(p, ctx.params);
  const progressingLayer = leak.layers.find(l => l.status === 'progressing');
  const bodyLeakLine = frozen
    ? '肉身：留世止步·七层已定'
    : progressingLayer
      ? `肉身（漏勺）：封堵 ${leak.sealedCount}/7｜${progressingLayer.name}压实 ${Math.round(progressingLayer.progress * 100)}%｜${7 - leak.sealedCount - 1} 层仍漏`
      : `肉身（漏勺）：封堵 ${leak.sealedCount}/7｜${7 - leak.sealedCount} 层仍漏`;
  return ['—— 功法 / 修炼 ——', '《偷天换劫诀》', `阶段：${stageName}`, `体魄根基：${foundationText}`, bodyLeakLine, `耐力：${Math.round(p.endurance / 1000)}｜意志：${Math.round(p.willpower / 1000)}`, `寿元：${p.lifespanRemainingDays}日`, `命数：${fateState}`, `劫势：${tribulationState}`, ...(victoryText ? [victoryText] : []), '', 'Esc 关闭；默认请从修行页确认备劫与行动。'].join('\n');
}

export function drawWorld(layers: RenderLayers, state: GameState, content: ContentRegistry, ctx?: SimContext, assets?: RuntimeRenderAssets, options?: DrawWorldOptions): void {
  // —— 瓦片 + 作物 ——
  const g = layers.tiles;
  const terrain = layers.terrainSemanticOverlay;
  const qiFlowLayer = layers.qiFlow;
  const e = layers.entities;
  const character = layers.characterOverlay;
  const retainedSprites = beginRetainedWorldFrame(layers);
  const ambientTimeMs = layers.ambientTimeMs;
  const showFrontSelection = options?.playerMovement?.moving !== true;
  const selectionDx = state.player.facing === 'left' ? -1 : state.player.facing === 'right' ? 1 : 0;
  const selectionDy = state.player.facing === 'up' ? -1 : state.player.facing === 'down' ? 1 : 0;
  const selectionX = state.player.position.x + selectionDx;
  const selectionY = state.player.position.y + selectionDy;
  const selectionTile = showFrontSelection && selectionX >= 0 && selectionY >= 0 && selectionX < state.width && selectionY < state.height ? state.tiles[selectionY * state.width + selectionX] : undefined;
  const selectionCrop = selectionTile?.cropId != null ? state.crops.get(selectionTile.id) : undefined;
  const selectionReadiness = selectionTile ? tileReadinessState(selectionTile, selectionCrop) : null;
  g.clear();
  terrain.clear();
  qiFlowLayer.clear();
  e.clear();
  character.clear();
  const hasPaintedFarmsteadBackdrop = drawFarmsteadPaintedBackdrop(layers, retainedSprites, state, assets);
  for (const t of state.tiles) {
    const x = OX + t.x * TILE;
    const y = OY + t.y * TILE;
    const crop = t.cropId != null ? state.crops.get(t.id) : undefined;
    const readiness = tileReadinessState(t, crop);
    const drawCultivationSurface = shouldDrawCultivationSurface(state, t, crop);
    const surfaceAlphaScale = cultivationSurfaceAlphaScale(state, t, crop, options, selectionTile);
    const insulationCovered = hasActiveArrayCoverage(state, t.id, 'array.insulation');
    const tileTexture = assets?.tiles[tileAssetId(t, { insulationCovered })];
    if (drawCultivationSurface && tileTexture) {
      const sprite = retainTileSprite(layers, retainedSprites, `world:tile:${t.id}`);
      applyWorldSprite(sprite, tileTexture, x + TILE / 2, y + TILE / 2, TILE - 1);
      sprite.alpha = surfaceAlphaScale >= 1 ? 0.9 : FARMSTEAD_PASSIVE_TILE_TEXTURE_ALPHA;
      g.rect(x, y, TILE - 1, TILE - 1).fill({ color: ColorPalette.tileShade, alpha: 0.14 * surfaceAlphaScale });
    } else if (drawCultivationSurface) {
      if (surfaceAlphaScale >= 1) {
        g.rect(x, y, TILE - 1, TILE - 1).fill(SOIL_COLOR[t.soilType] ?? ColorPalette.soil);
      } else {
        g.rect(x, y, TILE, TILE).fill({ color: farmsteadAmbientTileColor(state, t), alpha: hasPaintedFarmsteadBackdrop ? 0.08 : 0.32 });
      }
    } else {
      g.rect(x, y, TILE, TILE).fill({ color: farmsteadAmbientTileColor(state, t), alpha: hasPaintedFarmsteadBackdrop ? FARMSTEAD_PASSIVE_AMBIENT_ALPHA : 0.9 });
    }
    // P0-2：地表语义层位于地砖精灵之上、作物与实体之下。
    const tileState = tileVisualState(t, crop);
    const surfaceState = tileSurfaceVisualState(t, crop);
    if (drawCultivationSurface) {
      terrain.rect(x + 1, y + 1, TILE - 3, TILE - 3).fill({
        color: ColorPalette[surfaceState.baseTone],
        alpha: surfaceState.baseToneAlpha * surfaceAlphaScale
      });
      for (let grainIndex = 0; grainIndex < surfaceState.grainDensity; grainIndex++) {
        const grain = tileSurfaceGrainSample(t, surfaceState.grainKind, grainIndex);
        const grainX = x + Math.round(grain.ox * (TILE - 1));
        const grainY = y + Math.round(grain.oy * (TILE - 1));
        const grainAlpha = surfaceState.grainAlpha * grain.alphaScale * surfaceAlphaScale;
        if (surfaceState.grainKind === 'coarse' && grainIndex % 2 === 0) {
          terrain.rect(grainX - 1, grainY, grain.size + 2, 1).fill({ color: ColorPalette[surfaceState.grainTone], alpha: grainAlpha });
        } else {
          terrain.rect(grainX, grainY, grain.size, grain.size).fill({ color: ColorPalette[surfaceState.grainTone], alpha: grainAlpha });
        }
      }
    }
    drawFarmsteadGroundCue(terrain, state, t, x, y);
    // 空/翻/播/浇 四态差分 —— 翻地对比、水洼、种子、成熟上扬
    if (drawCultivationSurface && t.tilled) {
      // 翻地基色 + 对比暗层（浇水后更深），保留底图纹理而不整块盖死。
      terrain.rect(x + 3, y + 3, TILE - 7, TILE - 7).fill({ color: TILLED_SOIL_FILL, alpha: 0.28 + tileState.tilledContrastAlpha * 0.18 });
      if (tileState.tilledContrastAlpha > 0) {
        terrain.rect(x + 3, y + 3, TILE - 7, TILE - 7).fill({ color: ColorPalette.soilDampShadow, alpha: tileState.tilledContrastAlpha * 0.24 });
      }
      if (tileState.tilledBorderAlpha > 0) {
        terrain.rect(x + 3, y + 3, TILE - 7, TILE - 7).stroke({
          width: 1.25,
          color: TILLED_SOIL_BORDER,
          alpha: tileState.tilledBorderAlpha
        });
      }
    }
    if (drawCultivationSurface && tileState.dampAlpha > 0) {
      terrain.rect(x + 3, y + 3, TILE - 7, TILE - 7).fill({ color: ColorPalette.waterDamp, alpha: tileState.dampAlpha });
    }
    if (drawCultivationSurface && surfaceState.furrowAlpha > 0) {
      for (let row = 0; row < 3; row++) {
        const inset = 8 + ((t.id + row) % 3);
        const furrowY = y + 12 + row * 9;
        terrain
          .moveTo(x + inset, furrowY + 1)
          .lineTo(x + TILE - inset, furrowY + 1)
          .stroke({ width: 2, color: ColorPalette.soilShadow, alpha: surfaceState.furrowAlpha * 0.62 * surfaceAlphaScale });
        terrain
          .moveTo(x + inset, furrowY)
          .lineTo(x + TILE - inset, furrowY)
          .stroke({ width: 1, color: ColorPalette.soilHighlight, alpha: surfaceState.furrowAlpha * surfaceAlphaScale });
      }
    }
    // 浇水水洼高光层（比 damp 更易扫读）
    if (drawCultivationSurface && tileState.waterSheenAlpha > 0) {
      terrain.ellipse(x + TILE / 2, y + TILE - 12, TILE * 0.28, 4).fill({
        color: WATER_SHEEN_COLOR,
        alpha: tileState.waterSheenAlpha
      });
      terrain.ellipse(x + TILE / 2 + 4, y + TILE - 14, TILE * 0.14, 2.2).fill({
        color: ColorPalette.waterHighlight,
        alpha: tileState.waterSheenAlpha * 0.75
      });
    }
    if (drawCultivationSurface && tileState.qiGlowAlpha > 0) {
      terrain.rect(x + 6, y + 6, TILE - 13, TILE - 13).stroke({ width: 1.5, color: ColorPalette.qiBright, alpha: tileState.qiGlowAlpha });
    }
    // T2：高灵气地块轻量上浮微粒（纯 render 呼吸，不改 sim）
    if (drawCultivationSurface && shouldDrawQiSparkles(t.qiDensity, t.tilled)) {
      const sparkleTimeMs = layers.reducedMotion ? 0 : ambientTimeMs;
      const phase = qiSparklePhase(sparkleTimeMs, t.id);
      const sparkX = x + TILE / 2 + Math.sin(phase * Math.PI * 2 + t.id) * 7;
      const sparkY = y + TILE / 2 + 6 - phase * 14;
      terrain.circle(sparkX, sparkY, 1.6).fill({ color: ColorPalette.qiSoft, alpha: 0.28 + (1 - phase) * 0.45 });
      const phase2 = qiSparklePhase(sparkleTimeMs, t.id + 11);
      terrain.circle(x + TILE / 2 - 6 + phase2 * 10, y + 10 + (1 - phase2) * 8, 1.2).fill({
        color: ColorPalette.qiLight,
        alpha: 0.22 + (1 - phase2) * 0.35
      });
    }
    if (drawCultivationSurface && tileState.showWaterMark) {
      terrain.circle(x + 11, y + TILE - 11, 3.4).fill({ color: ColorPalette.waterBlue, alpha: 0.95 });
      terrain.circle(x + 18, y + TILE - 14, 2.4).fill({ color: ColorPalette.waterHighlight, alpha: 0.88 });
      terrain.circle(x + 14, y + TILE - 9, 1.6).fill({ color: ColorPalette.waterPaper, alpha: 0.7 });
    }
    if (drawCultivationSurface && tileState.showChannelMark) {
      terrain.poly([x + TILE - 12, y + 9, x + TILE - 8, y + 15, x + TILE - 12, y + 21, x + TILE - 16, y + 15]).fill({ color: ColorPalette.qiBright, alpha: 0.88 });
      terrain.poly([x + TILE - 12, y + 11, x + TILE - 10, y + 15, x + TILE - 12, y + 19, x + TILE - 14, y + 15]).fill({ color: ColorPalette.qiPaper, alpha: 0.7 });
    }

    if (selectionTile?.id === t.id) {
      const object = farmsteadSceneObjectAt(state, t.x, t.y);
      const selectionState = tileSelectionVisualState({
        selected: true,
        actionable: object != null || drawCultivationSurface ? (selectionReadiness?.actionable ?? false) : false,
        ambientTimeMs,
        reducedMotion: layers.reducedMotion
      });
      const edgePulse = 0.5 + Math.sin(selectionState.breathPhase * Math.PI * 2) * 0.5;
      terrain.rect(x + 2, y + 2, TILE - 5, TILE - 5).fill({ color: ColorPalette.trueWhite, alpha: selectionState.selectionMaskAlpha });
      terrain.rect(x + 2, y + 2, TILE - 5, TILE - 5).stroke({
        width: 2.1 + edgePulse * 0.5,
        color: ColorPalette.qiFlow,
        alpha: selectionState.selectionEdgeAlpha
      });
      terrain.rect(x + 4, y + 4, TILE - 9, TILE - 9).stroke({
        width: 1,
        color: ColorPalette.moonWhite,
        alpha: selectionState.selectionEdgeAlpha * 0.62
      });
    }
    drawPointerTileCue(terrain, state, t, x, y, options);

    const flowState = drawCultivationSurface && surfaceAlphaScale >= 1 ? qiFlowVisualState(t, ambientTimeMs, layers.reducedMotion) : EMPTY_QI_FLOW;
    if (flowState.glowAlpha > 0) {
      qiFlowLayer.rect(x + 2, y + 2, TILE - 5, TILE - 5).fill({ color: ColorPalette.qiFlow, alpha: flowState.glowAlpha });
    }
    drawQiFlowLines(qiFlowLayer, t, x, y, flowState);

    if (crop) {
      const herb = content.herbs.get(crop.defId);
      const cx = x + TILE / 2;
      const cy = y + TILE / 2;
      const metal = (herb?.metalAttract ?? 0) > 1;
      const cropFb = cropGrowthFeedbackState(crop, herb?.growthThreshold ?? 1, ambientTimeMs, layers.reducedMotion);
      if (crop.stage === 'withered') {
        // 枯萎：棕色 X
        e.moveTo(cx - 6, cy - 6)
          .lineTo(cx + 6, cy + 6)
          .moveTo(cx + 6, cy - 6)
          .lineTo(cx - 6, cy + 6)
          .stroke({ width: 2, color: STAGE_COLOR.withered });
      } else {
        const liftBonus = harvestLiftRadiusBonus(tileState);
        const baseRadius = crop.stage === 'seed' ? seedFallbackRadius(tileState, 3) : crop.stage === 'sprout' ? 6 : crop.stage === 'growing' ? 9 : 12 + liftBonus;
        const fallbackRadius = baseRadius;
        const texture = crop.stage === 'seed' ? assets?.cropSeeds[herb?.seedId ?? ''] : assets?.cropHerbs[crop.defId];
        if (texture) {
          const sprite = retainSceneSprite(layers, retainedSprites, `world:crop:${crop.id}`);
          const spec = cropWorldSpriteSpec(crop.stage);
          const sizeMul = crop.stage === 'seed' ? tileState.seedScale : tileState.harvestLift ? 1.12 : 1;
          const liftY = tileState.harvestLift ? -3 : 0;
          const bobOffset = crop.stage === 'seed' ? 0 : ambientBobOffset(ambientTimeMs, crop.id, 1.8, 3200);
          applyWorldSprite(sprite, texture, cx, cy + spec.yOffset + bobOffset + liftY, spec.size * sizeMul);
          if (metal) sprite.tint = ColorPalette.frostTint;
          if (tileState.harvestLift) sprite.tint = metal ? ColorPalette.frostPaper : ColorPalette.giltCrop;
        } else {
          // 回退路径：保留原始程序化图元，保证无贴图时仍可稳定演示
          const col = metal ? ColorPalette.frostGray : (STAGE_COLOR[crop.stage] ?? ColorPalette.leaf);
          if (crop.stage === 'seed' && tileState.seedVisible) {
            // 刚播下：土中种子点 + 短茎两叶（T0-3 + V1-T4 放大）
            const s = tileState.seedScale;
            e.ellipse(cx, cy + 5, 3.2 * s, 1.6 * s).fill({ color: ColorPalette.soilBorder, alpha: 0.55 });
            e.circle(cx, cy + 4, 2.1 * s).fill(metal ? ColorPalette.frostDeep : ColorPalette.soilWarm);
            e.moveTo(cx, cy + 3)
              .lineTo(cx, cy - 4 * s)
              .stroke({ width: 1.4 * s, color: ColorPalette.leafDark });
            e.circle(cx - 3 * s, cy - 4 * s, 2.4 * s).fill(metal ? ColorPalette.frost : ColorPalette.mossBright);
            e.circle(cx + 3 * s, cy - 4 * s, 2.4 * s).fill(metal ? ColorPalette.frost : ColorPalette.mossBright);
          } else if (crop.stage === 'seed') {
            e.moveTo(cx, cy + 3)
              .lineTo(cx, cy - 4)
              .stroke({ width: 1.4, color: ColorPalette.leafDark });
            e.circle(cx - 3, cy - 4, 2.4).fill(metal ? ColorPalette.frost : ColorPalette.mossBright);
            e.circle(cx + 3, cy - 4, 2.4).fill(metal ? ColorPalette.frost : ColorPalette.mossBright);
          } else {
            const drawCy = tileState.harvestLift ? cy - 3 : cy;
            if (crop.stage === 'growing' || crop.stage === 'mature') {
              e.moveTo(cx, drawCy + fallbackRadius)
                .lineTo(cx, y + TILE - 3)
                .stroke({ width: tileState.harvestLift ? 2 : 1.5, color: ColorPalette.leafDark });
            }
            e.circle(cx, drawCy, fallbackRadius).fill(col);
            if (tileState.harvestLift) {
              e.circle(cx, drawCy, fallbackRadius * 0.45).fill({ color: ColorPalette.giltGlow, alpha: 0.55 });
            }
          }
        }
        if (cropFb.qiGatherAlpha > 0) {
          e.moveTo(cx, cy + fallbackRadius + 6)
            .lineTo(cx, cy + Math.max(2, fallbackRadius - 2))
            .stroke({ width: 1.6, color: ColorPalette.qiFlow, alpha: cropFb.qiGatherAlpha });
        }
        if (cropFb.temperTintAlpha > 0) {
          e.circle(cx, tileState.harvestLift ? cy - 3 : cy, fallbackRadius).fill({ color: ColorPalette.frost, alpha: cropFb.temperTintAlpha });
        }
        if (readiness.showHarvestHalo || tileState.harvestLift) {
          const haloCy = tileState.harvestLift ? cy - 3 : cy;
          const pulse = 0.75 + 0.25 * Math.sin(cropFb.maturePulsePhase * Math.PI * 2);
          e.circle(cx, haloCy, fallbackRadius + 3).stroke({ width: 1.5, color: ColorPalette.giltBright, alpha: 0.85 * pulse });
          e.circle(cx, haloCy, fallbackRadius + 6).stroke({ width: 1, color: ColorPalette.qiLight, alpha: 0.45 * pulse });
          if (tileState.harvestLift || cropFb.matureGlowAlpha > 0) {
            e.circle(cx, haloCy, fallbackRadius + 9).stroke({ width: 1, color: ColorPalette.giltBright, alpha: 0.28 * pulse });
          }
        }
      }
    }
  }

  drawFarmsteadPlotFrame(terrain, state);

  // —— 场所感装饰（V1-T3）：路径石 / 草丛 / 卵石 / 远雾 / 篱笆；叠在地砖之上、设施与实体之下 ——
  for (const decor of worldDecorPlacements(state.width, state.height, state.tiles, {
    hasFacilities: state.facilities.size > 0
  })) {
    paintWorldDecor(terrain, decor, OX + decor.x * TILE, OY + decor.y * TILE, TILE, ambientTimeMs);
  }

  drawFarmsteadSceneObjects(layers, retainedSprites, state, assets);

  // —— 农庄设施：加工链从菜单入口落到具体地块 ——
  for (const placement of guardBeastPreviewPlacements(state)) {
    const x = OX + placement.x * TILE;
    const y = OY + placement.y * TILE;
    const guardTexture = assets?.guardBeastVariants?.[guardBeastPreviewAssetId(placement.beastId)] ?? assets?.guardBeast;
    if (guardTexture) {
      const sprite = retainSceneSprite(layers, retainedSprites, `world:guard-beast:${placement.beastId}`);
      applyWorldSprite(sprite, guardTexture, x + TILE / 2, y + TILE / 2 + 2 + ambientBobOffset(ambientTimeMs, placement.beastId * 7, 1.4, 2800), TILE - 6);
      sprite.alpha = 0.7 + placement.vigorRatio * 0.3;
    } else {
      e.circle(x + TILE / 2, y + TILE / 2 + 2, 11).fill({ color: ColorPalette.qiBlue, alpha: 0.82 });
      e.circle(x + TILE / 2, y + TILE / 2 + 2, 11).stroke({ width: 1.5, color: ColorPalette.inkBlueDeep });
      e.circle(x + TILE / 2 - 4, y + TILE / 2 - 1, 2).fill(ColorPalette.inkBlueDeep);
      e.circle(x + TILE / 2 + 4, y + TILE / 2 - 1, 2).fill(ColorPalette.inkBlueDeep);
      e.rect(x + 13, y + TILE - 10, TILE - 26, 3).fill({ color: ColorPalette.inkPanelDeep, alpha: 0.85 });
      e.rect(x + 13, y + TILE - 10, Math.max(3, (TILE - 26) * placement.vigorRatio), 3).fill(ColorPalette.mossBright);
    }

    const specialty = placement.specialty;
    if (specialty) {
      const marker = GUARD_BEAST_SPECIALTY_MARKER[specialty];
      const mx = x + TILE - 11;
      const my = y + 11;
      e.circle(mx, my, 5).fill({ color: marker.color, alpha: 0.94 });
      e.circle(mx, my, 5).stroke({ width: 1, color: ColorPalette.inkPanelDeep, alpha: 0.94 });
      if (specialty === 'field-ward') {
        e.moveTo(mx, my - 2)
          .lineTo(mx, my + 2)
          .stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
        e.moveTo(mx - 2, my)
          .lineTo(mx + 2, my)
          .stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
      } else if (specialty === 'array-warden') {
        e.moveTo(mx - 2, my - 2)
          .lineTo(mx + 2, my + 2)
          .stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
        e.moveTo(mx + 2, my - 2)
          .lineTo(mx - 2, my + 2)
          .stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
      } else {
        e.moveTo(mx - 2, my + 2)
          .lineTo(mx + 1, my - 1)
          .stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
        e.moveTo(mx + 1, my - 1)
          .lineTo(mx + 2, my)
          .stroke({ width: 1.3, color: marker.accent, alpha: 0.96 });
      }
    }
  }

  for (const prop of farmsteadPropPlacements(state)) {
    const x = OX + prop.x * TILE;
    const y = OY + prop.y * TILE;
    const texture = assets?.facilities[prop.assetId.slice('facility.'.length)];
    e.ellipse(x + TILE / 2, y + TILE - 8, 14, 4).fill({ color: ColorPalette.inkShadow, alpha: 0.24 });
    e.roundRect(x + 6, y + TILE - 17, TILE - 12, 9, 4).stroke({ width: 1, color: ColorPalette.gilt, alpha: 0.28 });
    if (texture) {
      const sprite = retainSceneSprite(layers, retainedSprites, `world:farmstead-prop:${prop.assetId}`);
      applyWorldSprite(sprite, texture, x + TILE / 2, y + TILE / 2 + 1 + ambientBobOffset(ambientTimeMs, prop.assetId.length * 11, 0.7, 3600), TILE - 4);
      sprite.alpha = 0.9;
    } else {
      const color = prop.assetId === 'facility.storage-chest' ? ColorPalette.wood : ColorPalette.woodBrown;
      e.roundRect(x + 9, y + 10, TILE - 18, TILE - 16, 5).fill({ color, alpha: 0.92 });
      e.roundRect(x + 9, y + 10, TILE - 18, TILE - 16, 5).stroke({ width: 1.5, color: ColorPalette.soilShadow });
      e.rect(x + 12, y + 16, TILE - 24, 4).fill({ color: ColorPalette.paperGold, alpha: 0.85 });
    }

    if (prop.status === 'ready') {
      const badgeTexture = assets?.itemIcons[farmsteadPropBadgeAssetId(state, prop.assetId) ?? ''];
      if (badgeTexture) {
        e.circle(x + TILE - 10, y + 10, 7).fill({ color: ColorPalette.inkPanel, alpha: 0.9 });
        e.circle(x + TILE - 10, y + 10, 7).stroke({ width: 1.2, color: ColorPalette.success, alpha: 0.94 });
        const badge = retainSceneSprite(layers, retainedSprites, `world:farmstead-prop:${prop.assetId}:badge`);
        applyWorldSprite(badge, badgeTexture, x + TILE - 10, y + 10, 12);
      } else {
        e.circle(x + TILE - 10, y + 10, 5).fill(ColorPalette.success);
        e.circle(x + TILE - 10, y + 10, 5).stroke({ width: 1.2, color: ColorPalette.inkPanelDeep, alpha: 0.92 });
      }
    }
  }

  for (const facility of state.facilities.values()) {
    const tile = state.tiles[facility.tileId];
    if (!tile) continue;
    const x = OX + tile.x * TILE;
    const y = OY + tile.y * TILE;
    const color = FACILITY_COLOR[facility.kind] ?? ColorPalette.neutralGray;
    const facilityTexture = assets?.facilities[facility.kind];
    e.ellipse(x + TILE / 2, y + TILE - 8, 15, 4).fill({ color: ColorPalette.inkShadow, alpha: 0.24 });
    e.roundRect(x + 5, y + TILE - 17, TILE - 10, 9, 4).stroke({ width: 1, color: ColorPalette.qiFlow, alpha: 0.26 });
    if (facilityTexture) {
      const sprite = retainSceneSprite(layers, retainedSprites, `world:facility:${facility.id}`);
      applyWorldSprite(sprite, facilityTexture, x + TILE / 2, y + TILE / 2 + ambientBobOffset(ambientTimeMs, facility.id, 0.7, 4000), TILE - 2);
    } else {
      e.rect(x + 7, y + 9, TILE - 15, TILE - 14).fill({ color, alpha: 0.92 });
      e.rect(x + 7, y + 9, TILE - 15, TILE - 14).stroke({ width: 1.5, color: ColorPalette.soilShadow });
      if (facility.kind === 'drying-rack') {
        e.moveTo(x + 11, y + 17)
          .lineTo(x + TILE - 11, y + 17)
          .stroke({ width: 2, color: ColorPalette.soil });
        e.moveTo(x + 11, y + 25)
          .lineTo(x + TILE - 11, y + 25)
          .stroke({ width: 2, color: ColorPalette.soil });
      } else if (facility.kind === 'sealing-cabinet') {
        e.rect(x + 17, y + 13, 8, TILE - 22).stroke({ width: 1.5, color: ColorPalette.inkBlue });
        e.circle(x + 26, y + TILE / 2, 2).fill(ColorPalette.paperText);
      } else if (facility.kind === 'talisman-furnace') {
        e.circle(x + TILE / 2, y + TILE / 2, 10).stroke({ width: 2, color: ColorPalette.cinnabarDeep });
        e.circle(x + TILE / 2, y + TILE / 2, 5).fill(ColorPalette.emberBright);
        e.rect(x + 14, y + TILE - 14, TILE - 28, 4).fill(ColorPalette.cinnabarDeep);
      }
    }
    if (facility.job) {
      const done = facility.job.daysRemaining <= 0;
      const badgeTexture = done ? assets?.itemIcons[facilityWorldBadgeAssetId(facility.job.outputItemId) ?? ''] : undefined;
      if (done && badgeTexture) {
        e.circle(x + TILE - 9, y + 9, 7).fill({ color: ColorPalette.inkPanel, alpha: 0.9 });
        e.circle(x + TILE - 9, y + 9, 7).stroke({ width: 1.2, color: ColorPalette.giltBright, alpha: 0.94 });
        const badge = retainSceneSprite(layers, retainedSprites, `world:facility:${facility.id}:badge`);
        applyWorldSprite(badge, badgeTexture, x + TILE - 9, y + 9, 12);
      } else {
        e.circle(x + TILE - 9, y + 9, 5).fill(done ? ColorPalette.giltBright : ColorPalette.qiBright);
        e.circle(x + TILE - 9, y + 9, 5).stroke({ width: 1.1, color: ColorPalette.inkPanelDeep, alpha: 0.92 });
      }
      if (!done) {
        e.rect(x + 9, y + TILE - 10, TILE - 18, 4).fill({ color: ColorPalette.inkPanelDeep, alpha: 0.9 });
        e.rect(x + 10, y + TILE - 9, TILE - 20, 2).fill(ColorPalette.qiBright);
      }
    }
  }

  for (const placement of locationWorldPreviewPlacements(state)) {
    const x = OX + placement.x * TILE;
    const y = OY + placement.y * TILE;
    const locationTexture = assets?.locations[placement.locationId];
    const badgeLayout = locationWorldBadgeLayout({
      hasBirthday: placement.birthday,
      hasQuest: placement.hasQuest,
      hasService: placement.serviceReady || placement.serviceDone,
      hasTask: placement.taskReady,
      npcCount: placement.npcCount
    });

    if (locationTexture) {
      const sprite = retainSceneSprite(layers, retainedSprites, `world:location:${placement.locationId}`);
      applyWorldSprite(sprite, locationTexture, x + TILE / 2, y + TILE / 2 + ambientBobOffset(ambientTimeMs, placement.locationId.length * 13, 0.9, 5200), TILE - 4);
      sprite.alpha = 0.24;
    } else {
      e.roundRect(x + 3, y + 3, TILE - 7, TILE - 7, 7).fill({ color: ColorPalette.badgeDark, alpha: 0.28 });
      e.roundRect(x + 3, y + 3, TILE - 7, TILE - 7, 7).stroke({ width: 1.2, color: ColorPalette.mountainHighlight, alpha: 0.5 });
    }

    if (placement.npcCount > 1) {
      e.roundRect(x + badgeLayout.crowd.x, y + badgeLayout.crowd.y, 11, 11, 4).fill({ color: ColorPalette.inkPanel, alpha: 0.9 });
      e.roundRect(x + badgeLayout.crowd.x, y + badgeLayout.crowd.y, 11, 11, 4).stroke({ width: 1, color: ColorPalette.badgeGold, alpha: 0.85 });
      e.rect(x + badgeLayout.crowd.x + 4, y + badgeLayout.crowd.y + 4, 3, 3).fill({ color: ColorPalette.paperText, alpha: 0.9 });
      e.rect(x + badgeLayout.crowd.x + 4, y + badgeLayout.crowd.y + 8, 3, 3).fill({ color: ColorPalette.paperText, alpha: 0.9 });
      e.rect(x + badgeLayout.crowd.x + 8, y + badgeLayout.crowd.y + 4, 3, 3).fill({ color: ColorPalette.paperText, alpha: 0.9 });
      e.rect(x + badgeLayout.crowd.x + 8, y + badgeLayout.crowd.y + 8, 3, 3).fill({ color: ColorPalette.paperText, alpha: 0.9 });
    }

    if (placement.birthday) {
      e.circle(x + badgeLayout.birthday.x, y + badgeLayout.birthday.y, 4).fill({ color: ColorPalette.warningOrange, alpha: 0.94 });
      e.circle(x + badgeLayout.birthday.x, y + badgeLayout.birthday.y, 4).stroke({ width: 1, color: ColorPalette.markerBrown, alpha: 0.9 });
    }
    if (placement.hasQuest) {
      const color = placement.questReady ? ColorPalette.giltBright : ColorPalette.qiBright;
      e.rect(x + badgeLayout.quest.x - 4, y + badgeLayout.quest.y - 4, 7, 7).fill({ color, alpha: 0.94 });
      e.rect(x + badgeLayout.quest.x - 4, y + badgeLayout.quest.y - 4, 7, 7).stroke({ width: 1, color: ColorPalette.inkPanelDeep, alpha: 0.92 });
    }
    if (placement.serviceReady || placement.serviceDone) {
      const color = placement.serviceReady ? ColorPalette.success : ColorPalette.mountainMuted;
      const alpha = placement.serviceReady ? 0.96 : 0.9;
      const serviceBadgeAssetId = locationServiceWorldBadgeAssetId(placement.serviceAssetId);
      const serviceBadgeTexture = serviceBadgeAssetId?.startsWith('sprite.npc.')
        ? assets?.npcs[serviceBadgeAssetId]
        : serviceBadgeAssetId?.startsWith('map-sprite.')
          ? assets?.mapSprites?.[serviceBadgeAssetId]
          : assets?.itemIcons[serviceBadgeAssetId ?? ''];
      if (serviceBadgeTexture) {
        e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 7).fill({ color: ColorPalette.inkPanel, alpha: 0.9 });
        e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 7).stroke({ width: 1.2, color, alpha: 0.94 });
        const badge = retainSceneSprite(layers, retainedSprites, `world:location:${placement.locationId}:service`);
        applyWorldSprite(badge, serviceBadgeTexture, x + badgeLayout.service.x, y + badgeLayout.service.y, 12);
      } else {
        e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 4).fill({ color, alpha });
        e.circle(x + badgeLayout.service.x, y + badgeLayout.service.y, 4).stroke({ width: 1, color: ColorPalette.inkPanelDeep, alpha: 0.92 });
      }
    }
    if (placement.taskReady) {
      const taskBadgeAssetId = locationTaskWorldBadgeAssetId(placement.taskAssetId);
      const badgeTexture = taskBadgeAssetId?.startsWith('facility.') ? assets?.facilities[taskBadgeAssetId] : assets?.itemIcons[taskBadgeAssetId ?? ''];
      if (badgeTexture) {
        e.circle(x + badgeLayout.task.x, y + badgeLayout.task.y, 7).fill({ color: ColorPalette.inkPanel, alpha: 0.9 });
        e.circle(x + badgeLayout.task.x, y + badgeLayout.task.y, 7).stroke({ width: 1.2, color: ColorPalette.warning, alpha: 0.94 });
        const badge = retainSceneSprite(layers, retainedSprites, `world:location:${placement.locationId}:task`);
        applyWorldSprite(badge, badgeTexture, x + badgeLayout.task.x, y + badgeLayout.task.y, 12);
      } else {
        e.rect(x + badgeLayout.task.x - 4, y + badgeLayout.task.y - 4, 8, 8).fill({ color: ColorPalette.warning, alpha: 0.95 });
        e.rect(x + badgeLayout.task.x - 4, y + badgeLayout.task.y - 4, 8, 8).stroke({ width: 1, color: ColorPalette.inkPanelDeep, alpha: 0.92 });
      }
    }
  }

  for (const placement of npcWorldPreviewPlacements(state)) {
    const x = OX + placement.x * TILE;
    const y = OY + placement.y * TILE;
    const ncx = x + TILE / 2;
    const ncy = y + TILE / 2 + 1 + ambientBobOffset(ambientTimeMs, placement.placementKey.length * 17, 1.6, 3400);
    const mapSpriteId = npcWorldMapSpriteAssetId(placement.assetId);
    const npcTexture = mapSpriteId ? assets?.mapSprites?.[mapSpriteId] : undefined;
    if (npcTexture) {
      const metrics = worldCharacterSpriteMetrics('npc');
      const accent = placement.questReady ? ColorPalette.giltBright : placement.hasQuest ? ColorPalette.qiBright : ColorPalette.mountainMuted;
      drawWorldCharacterReadabilityHalo(e, ncx, ncy, accent, 'npc');
      drawWorldCharacterPedestal(e, ncx, ncy, accent, 'npc');
      const sprite = retainSceneSprite(layers, retainedSprites, `world:npc:${placement.placementKey}`);
      applyWorldCharacterSprite(sprite, npcTexture, ncx, ncy + metrics.yOffset, metrics.width, metrics.height);
      sprite.alpha = 0.97;
    } else {
      drawNpcWorldFallback(e, ncx, ncy, placement.assetId);
    }

    if (placement.birthday || placement.hasQuest) {
      const marker = retainNpcMarker(layers, retainedSprites, `world:npc:${placement.placementKey}:marker`);
      marker.clear();
      marker.x = x;
      marker.y = y;
      if (placement.birthday) {
        marker.circle(TILE - 10, 10, 4).fill({ color: ColorPalette.warningOrange, alpha: 0.94 });
        marker.circle(TILE - 10, 10, 4).stroke({ width: 1, color: ColorPalette.markerBrown, alpha: 0.9 });
      }
      if (placement.hasQuest) {
        const color = placement.questReady ? ColorPalette.giltBright : ColorPalette.qiBright;
        marker.rect(6, 6, 7, 7).fill({ color, alpha: 0.94 });
        marker.rect(6, 6, 7, 7).stroke({ width: 1, color: ColorPalette.inkPanelDeep, alpha: 0.92 });
      }
    }
  }

  drawGroundItems(layers, retainedSprites, state, content, assets);

  // —— 玩家 + 阵眼 + 面前格光标 ——
  // 阵法覆盖区 + 阵眼
  for (const arr of arrayWorldPreviewPlacements(state)) {
    const isRod = arr.assetId === 'facility.array-eye';
    const active = arr.status === 'active';
    const color = isRod ? ColorPalette.giltBright : ColorPalette.qiBright;
    // 覆盖圈半透明填色，让"种田即布阵"的阵法范围可见
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
      const sprite = retainSceneSprite(layers, retainedSprites, `world:array:${arr.arrayId}`);
      applyWorldSprite(sprite, arrayTexture, cx, cy + ambientBobOffset(ambientTimeMs, arr.arrayId, 1.2, 3000), TILE - 8);
      sprite.alpha = active ? 0.88 : 0.52;
      e.circle(cx, cy, 7).stroke({ width: 1.5, color, alpha: active ? 0.75 : 0.42 });
    } else {
      e.circle(cx, cy, 6).fill({ color, alpha: active ? 0.96 : 0.5 });
    }

    if (!active) {
      e.rect(cx - 6, cy - 1, 12, 2).fill({ color: ColorPalette.inkPanelDeep, alpha: 0.9 });
      e.rect(cx - 6, cy - 1, 12, 2).stroke({ width: 1, color: ColorPalette.soilMuted, alpha: 0.8 });
    }
  }
  const p = state.player;
  // 教学天劫落雷预警区（T1）：中心 + 八邻域脉动紫辉，替代纯文本坐标
  const warnedId = state.tutorialTribulation?.phase === 'active' ? state.tutorialTribulation.warnedTileId : null;
  if (warnedId != null) {
    const warned = state.tiles.find(tile => tile.id === warnedId);
    if (warned) {
      const pulse = tutorialWarningPulse(ambientTimeMs);
      for (const cell of tutorialWarningZoneTiles(warned.x, warned.y, state.width, state.height)) {
        const zx = OX + cell.x * TILE;
        const zy = OY + cell.y * TILE;
        const fillA = cell.isCenter ? pulse * 0.42 : pulse * 0.18;
        const strokeA = cell.isCenter ? Math.min(0.95, pulse + 0.25) : pulse * 0.7;
        e.rect(zx + 1, zy + 1, TILE - 3, TILE - 3).fill({ color: ColorPalette.purpleDanger, alpha: fillA });
        e.rect(zx + 1, zy + 1, TILE - 3, TILE - 3).stroke({
          width: cell.isCenter ? 2.5 : 1.5,
          color: cell.isCenter ? ColorPalette.purplePaper : ColorPalette.purpleSoft,
          alpha: strokeA
        });
        if (cell.isCenter) {
          const cx = zx + TILE / 2;
          const cy = zy + TILE / 2;
          e.circle(cx, cy, 7 + pulse * 4).stroke({ width: 1.5, color: ColorPalette.trueWhite, alpha: pulse * 0.85 });
          e.circle(cx, cy, 3).fill({ color: ColorPalette.trueWhite, alpha: 0.55 + pulse * 0.35 });
        }
      }
    }
  }
  const playerMovement = options?.playerMovement ?? null;
  const moving = Boolean(playerMovement?.moving) && !layers.reducedMotion;
  const playerGridX = playerMovement?.x ?? p.position.x;
  const playerGridY = playerMovement?.y ?? p.position.y;
  const walkLift = moving ? -Math.sin((playerMovement?.progress ?? 1) * Math.PI) * 4.2 : 0;
  const walkSway = moving ? Math.sin((playerMovement?.progress ?? 1) * Math.PI * 2) * 1.4 : 0;
  const lateralSway = p.facing === 'up' || p.facing === 'down' ? walkSway : 0;
  const verticalSway = p.facing === 'left' || p.facing === 'right' ? walkSway * 0.35 : 0;
  const px = OX + playerGridX * TILE + TILE / 2 + lateralSway;
  const py = OY + playerGridY * TILE + TILE / 2 + ambientBobOffset(ambientTimeMs, 1, moving ? 0.35 : 1, 2400) + walkLift + verticalSway;
  const facing = p.facing as Facing4;
  const walkCycle = characterWalkCycle(facing, playerMovement?.progress ?? 1, moving, layers.reducedMotion);
  if (moving && playerMovement?.from && playerMovement.to) {
    const fromX = OX + playerMovement.from.x * TILE + TILE / 2;
    const fromY = OY + playerMovement.from.y * TILE + TILE / 2;
    const toX = OX + playerMovement.to.x * TILE + TILE / 2;
    const toY = OY + playerMovement.to.y * TILE + TILE / 2;
    e.moveTo(fromX, fromY + 15).lineTo(toX, toY + 15).stroke({ width: 2.4, color: ColorPalette.giltBright, alpha: 0.14 });
  }
  const playerWorldTexture = assets?.mapSprites?.[playerWorldMapSpriteAssetId()];
  if (playerWorldTexture) {
    const metrics = worldCharacterSpriteMetrics('player');
    const presence = playerPresenceOverlay(facing);
    drawWorldCharacterReadabilityHalo(e, px, py, ColorPalette.giltBright, 'player', walkCycle);
    drawWorldCharacterPedestal(e, px, py, ColorPalette.giltBright, 'player', walkCycle);
    for (const band of presence.bands) {
      if (band.layer !== 'under') continue;
      e.ellipse(px + band.ox, py + band.oy, band.rx, band.ry).fill({ color: band.color, alpha: band.alpha * 0.46 });
    }
    drawPlayerWalkFootfalls(character, px, py, walkCycle, moving);
    const sprite = retainSceneSprite(layers, retainedSprites, 'world:player');
    applyWorldCharacterSprite(sprite, playerWorldTexture, px, py + metrics.yOffset, metrics.width, metrics.height);
    // 左右朝向镜像；上下保留原图 + 箭头指示
    const sx = Math.abs(sprite.scale.x) || 1;
    const sy = Math.abs(sprite.scale.y) || 1;
    sprite.scale.x = sx * facingScaleX(facing) * walkCycle.bodyScaleX;
    sprite.scale.y = sy * walkCycle.bodyScaleY;
    sprite.rotation = walkCycle.bodyTilt;
    sprite.alpha = PLAYER_MAP_SPRITE_ALPHA;
    for (const band of presence.bands) {
      if (band.layer !== 'over') continue;
      character.ellipse(px + band.ox, py + band.oy, band.rx, band.ry).fill({ color: band.color, alpha: band.alpha * 0.72 });
    }
    character.circle(px, py - 11, 12).stroke({ width: 1.2, color: ColorPalette.playerGilt, alpha: 0.54 });
  } else {
    drawWorldCharacterPedestal(e, px, py, ColorPalette.giltBright, 'player', walkCycle);
    drawPlayerWalkFootfalls(character, px, py, walkCycle, moving);
    // V1-T5：旧贴图加载失败时才使用色带兜底，避免回退为纯黑剪影。
    const presence = playerPresenceOverlay(facing);
    for (const band of presence.bands) {
      if (band.layer !== 'under') continue;
      e.ellipse(px + band.ox, py + band.oy, band.rx, band.ry).fill({ color: band.color, alpha: band.alpha });
    }
    if (assets?.player) {
      const sprite = retainSceneSprite(layers, retainedSprites, 'world:player');
      applyWorldSprite(sprite, assets.player, px, py, TILE);
      const sx = Math.abs(sprite.scale.x) || 1;
      const sy = Math.abs(sprite.scale.y) || 1;
      sprite.scale.x = sx * facingScaleX(facing) * walkCycle.bodyScaleX;
      sprite.scale.y = sy * walkCycle.bodyScaleY;
      sprite.rotation = walkCycle.bodyTilt;
      sprite.tint = presence.tint;
      sprite.alpha = presence.spriteAlpha;
    } else {
      // 回退：under 条带已是头+袍；补描边增强轮廓
      e.circle(px, py - 5, 7).stroke({ width: 1.2, color: ColorPalette.playerOutline, alpha: 0.85 });
    }
    for (const band of presence.bands) {
      if (band.layer !== 'over') continue;
      character.ellipse(px + band.ox, py + band.oy, band.rx, band.ry).fill({ color: band.color, alpha: band.alpha });
    }
  }
  // 朝向指示（尖头，比白点更易扫读）
  const tip = facingIndicatorOffset(facing, TILE * 0.95);
  const base = facingIndicatorOffset(facing, TILE * 0.72);
  if (facing === 'left' || facing === 'right') {
    character.poly([px + tip.x, py + tip.y, px + base.x, py - 4, px + base.x, py + 4]).fill({ color: ColorPalette.giltBright, alpha: 0.95 });
    character.poly([px + tip.x, py + tip.y, px + base.x, py - 4, px + base.x, py + 4]).stroke({ width: 1, color: ColorPalette.seedDark, alpha: 0.75 });
  } else {
    character.poly([px + tip.x, py + tip.y, px - 4, py + base.y, px + 4, py + base.y]).fill({ color: ColorPalette.giltBright, alpha: 0.95 });
    character.poly([px + tip.x, py + tip.y, px - 4, py + base.y, px + 4, py + base.y]).stroke({ width: 1, color: ColorPalette.seedDark, alpha: 0.75 });
  }
  finishRetainedWorldFrame(layers, retainedSprites);

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
  const hpColor = hpRatio > 0.5 ? ColorPalette.accentGreen : hpRatio > 0.2 ? ColorPalette.giltBright : ColorPalette.dangerBright;
  const poisonColor = poisonPct > 0.7 ? ColorPalette.accentRed : poisonPct > 0.4 ? ColorPalette.ember : ColorPalette.loessDeep;
  const BAR_W = 120,
    BAR_H = 11,
    BAR_X0 = 12,
    BAR_DX = 152,
    BAR_Y = 42;
  drawBar(bg, BAR_X0, BAR_Y, BAR_W, BAR_H, hpRatio, hpColor);
  drawBar(bg, BAR_X0 + BAR_DX, BAR_Y, BAR_W, BAR_H, poisonPct, poisonColor);
  drawBar(bg, BAR_X0 + 2 * BAR_DX, BAR_Y, BAR_W, BAR_H, cultPct, ColorPalette.qiBright);
  drawBar(bg, BAR_X0 + 3 * BAR_DX, BAR_Y, BAR_W, BAR_H, staPct, ColorPalette.mossBright);
  setTextIfChanged(layers.barLabels[0]!, `气血 ${hpPct}%`);
  setTextIfChanged(layers.barLabels[1]!, `丹毒 ${pp}`);
  setTextIfChanged(layers.barLabels[2]!, `体魄 ${Math.round(cultPct * 100)}%`);
  setTextIfChanged(layers.barLabels[3]!, `体力 ${Math.round(staPct * 100)}%`);
  const eventChip = state.activeEvent ? `　天象 ${state.activeEvent.displayName} ${state.activeEvent.daysLeft}日` : '';
  const surgeChip = state.beastSurge ? `　妖兽潮 ${state.beastSurge.daysLeft}日` : '';
  const stayedChip = state.postAscension.mode === 'stayed-in-world' ? '　留世' : '';
  setTextIfChanged(layers.hud, `第 ${state.day} 日 · ${t('ui.hud.season.' + state.season)} · ${stageNames[state.player.stage] ?? state.player.stage} · 寿元 ${p.lifespanRemainingDays ?? '?'}日${eventChip}${surgeChip}${stayedChip}`);

  // —— 结局遮罩 ——
  if (state.gameOver) {
    layers.worldRoot.visible = false;
    layers.tiles.visible = false;
    layers.entities.visible = false;
    layers.sceneSprites.visible = false;
    layers.characterOverlay.visible = false;
    layers.npcMarkers.visible = false;
    layers.bars.visible = false;
    for (const lbl of layers.barLabels) lbl.visible = false;
    layers.ending.y = SCREEN_H / 2;
    layers.ending.visible = false;
    layers.inv.visible = false;
    clearInventoryIcons(layers);
    layers.cultivation.visible = false;
  } else if (state.postAscension.mode === 'choice-pending') {
    layers.worldRoot.visible = true;
    layers.tiles.visible = true;
    layers.entities.visible = true;
    layers.sceneSprites.visible = true;
    layers.characterOverlay.visible = true;
    layers.npcMarkers.visible = true;
    layers.bars.visible = true;
    for (const lbl of layers.barLabels) lbl.visible = true;
    layers.ending.y = SCREEN_H / 2;
    setTextIfChanged(layers.ending, '紫雷尽散，天门已开。\n1 飞升离界\n2 留驻此界');
    layers.ending.visible = true;
    layers.inv.visible = false;
    clearInventoryIcons(layers);
    layers.cultivation.visible = false;
  } else {
    layers.worldRoot.visible = true;
    layers.tiles.visible = true;
    layers.entities.visible = true;
    layers.sceneSprites.visible = true;
    layers.characterOverlay.visible = true;
    layers.npcMarkers.visible = true;
    layers.bars.visible = true;
    for (const lbl of layers.barLabels) lbl.visible = true;
    layers.ending.y = SCREEN_H / 2;
    layers.ending.visible = false;
    if (layers.showInv) {
      const shipping = ctx ? `\n\n${renderShippingBin(state, content, ctx)}` : '';
      const stayingGoals = state.postAscension.mode === 'stayed-in-world' ? `\n\n${renderPostAscensionGoals(state)}` : '';
      setTextIfChanged(layers.inv, `${renderInventory(state, content)}\n\n${renderStorage(state, content)}${shipping}${stayingGoals}`);
      layers.inv.visible = true;
      drawInventoryIconStrip(layers, state, content, assets, ctx);
    } else {
      layers.inv.visible = false;
      clearInventoryIcons(layers);
    }
    if (!layers.cultivation.visible) setTextIfChanged(layers.cultivation, '');
  }

  // 天劫全屏闪光 + 招牌电光（衰减，T3b / Phase A2）
  const tf = layers.tribFlash;
  tf.clear();
  if (layers.tribFlashTtl > 0) {
    // 压低全屏白闪占比，把「可识别招牌」让给电光几何
    tf.rect(0, 0, SCREEN_W, SCREEN_H).fill({ color: ColorPalette.trueWhite, alpha: (layers.tribFlashTtl / 30) * 0.22 });
    layers.tribFlashTtl -= 1;
  }
  if (layers.tribBoltTtl > 0 && layers.tribBoltGeom) {
    const maxTtl = layers.tribBoltMaxTtl > 0 ? layers.tribBoltMaxTtl : 28;
    const alpha = Math.max(0, layers.tribBoltTtl / maxTtl);
    strokeLightningBolt(tf, layers.tribBoltGeom, { alpha });
    layers.tribBoltTtl -= 1;
    if (layers.tribBoltTtl <= 0) layers.tribBoltGeom = null;
  }

  advanceWorldShake(layers);
}

export function setToast(layers: RenderLayers, msg: string, texture?: Texture, profile: ToastLayoutProfile = 'desktop'): void {
  layers.toastIconBg.clear();
  const layout = toastLayoutForText(msg, Boolean(texture), profile);
  layers.toast.x = layout.textX;
  layers.toast.y = layout.textY;
  layers.toast.style.wordWrapWidth = layout.textWidth;
  setTextIfChanged(layers.toast, msg);
  layers.toastIconBg.roundRect(layout.bgX, layout.bgY, layout.bgWidth, layout.bgHeight, 7).fill({ color: ColorPalette.inkNearBlack, alpha: 0.78 });
  layers.toastIconBg.roundRect(layout.bgX, layout.bgY, layout.bgWidth, layout.bgHeight, 7).stroke({ width: 1, color: ColorPalette.badgeGold, alpha: 0.7 });
  if (!texture) {
    layers.toastIcon.visible = false;
    return;
  }

  layers.toastIconBg.roundRect(14, layout.textY - 2, 28, 28, 6).fill({ color: ColorPalette.inkPanel, alpha: 0.96 });
  layers.toastIconBg.roundRect(14, layout.textY - 2, 28, 28, 6).stroke({ width: 1.4, color: ColorPalette.badgeGold, alpha: 0.94 });
  applyPanelSprite(layers.toastIcon, texture, 14, layout.textY + 2, 20);
  layers.toastIcon.visible = true;
}

export function drawTodayBriefing(layers: RenderLayers, title: string, body: string, texture?: Texture, assetId?: string): void {
  const bg = layers.briefingBg;
  const text = layers.briefing;
  const heroAsset = isBriefingHeroAsset(assetId) && texture !== undefined;
  text.style.wordWrapWidth = heroAsset ? 118 : 176;
  text.x = BRIEFING_BOX.x + (heroAsset ? 106 : 40);
  text.y = BRIEFING_BOX.y + BRIEFING_BOX.paddingY;
  setTextIfChanged(text, `${title}\n${body}`);
  const height = briefingBoxHeight(text.height);
  bg.clear();
  bg.roundRect(BRIEFING_BOX.x, BRIEFING_BOX.y, BRIEFING_BOX.width, height, BRIEFING_BOX.radius).fill({ color: ColorPalette.inkPanel, alpha: 0.9 });
  bg.roundRect(BRIEFING_BOX.x, BRIEFING_BOX.y, BRIEFING_BOX.width, height, BRIEFING_BOX.radius).stroke({ width: 1.2, color: ColorPalette.grayBlue, alpha: 0.95 });
  if (heroAsset) {
    bg.roundRect(BRIEFING_BOX.x + 10, BRIEFING_BOX.y + 10, 84, 84, 8).fill({ color: ColorPalette.inkNearBlack, alpha: 0.96 });
    bg.roundRect(BRIEFING_BOX.x + 10, BRIEFING_BOX.y + 10, 84, 84, 8).stroke({ width: 1, color: ColorPalette.badgeGold, alpha: 0.92 });
    applyPanelSprite(layers.briefingImage, texture!, BRIEFING_BOX.x + 16, BRIEFING_BOX.y + 16, 72);
    layers.briefingImage.visible = true;
    layers.briefingIcon.visible = false;
  } else {
    layers.briefingImage.visible = false;
    bg.roundRect(BRIEFING_BOX.x + 8, BRIEFING_BOX.y + 8, 28, 28, 6).fill({ color: ColorPalette.badgeDark, alpha: 0.92 });
    bg.roundRect(BRIEFING_BOX.x + 8, BRIEFING_BOX.y + 8, 28, 28, 6).stroke({ width: 1, color: ColorPalette.badgeGold, alpha: 0.9 });
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
  setTextIfChanged(layers.briefing, '');
  layers.briefing.visible = false;
}

export function setHotbar(layers: RenderLayers, msg: string): void {
  setTextIfChanged(layers.hotbar, msg);
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
  bg.roundRect(10, SCREEN_H - 50, 28, 28, 6).fill({ color: ColorPalette.inkPanel, alpha: 0.96 });
  bg.roundRect(10, SCREEN_H - 50, 28, 28, 6).stroke({ width: 1.5, color: ColorPalette.badgeGold });
  applyPanelSprite(layers.hotbarIcon, texture, 14, SCREEN_H - 46, 20);
  layers.hotbarIcon.visible = true;
}

export function drawPanelItemPreview(layers: RenderLayers, title: string, details: string, texture?: Texture): void {
  const bg = layers.panelPreviewBg;
  setTextIfChanged(layers.panelPreviewText, `${title}\n\n${details}`);
  const height = itemPreviewBoxHeight(layers.panelPreviewText.height);
  bg.clear();
  bg.roundRect(PANEL_PREVIEW_BOX.x, PANEL_PREVIEW_BOX.y, PANEL_PREVIEW_BOX.width, height, PANEL_PREVIEW_BOX.radius).fill({ color: ColorPalette.inkPanel, alpha: 0.94 });
  bg.roundRect(PANEL_PREVIEW_BOX.x, PANEL_PREVIEW_BOX.y, PANEL_PREVIEW_BOX.width, height, PANEL_PREVIEW_BOX.radius).stroke({ width: 1.5, color: ColorPalette.mountainHighlight });
  bg.roundRect(704, 304, 60, 60, 6).fill({ color: ColorPalette.badgeDark, alpha: 0.92 });
  bg.roundRect(704, 304, 60, 60, 6).stroke({ width: 1, color: ColorPalette.badgeGold, alpha: 0.9 });
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
  setTextIfChanged(layers.panelPreviewText, '');
  layers.panelPreviewText.visible = false;
}

export function drawLocationPreview(layers: RenderLayers, title: string, details: string, texture?: Texture, npcPrimary?: Texture, npcSecondary?: Texture): void {
  const bg = layers.locationPreviewBg;
  bg.clear();
  const imageOffset = texture ? 112 : 0;
  const textWidth = texture ? 144 : 256;
  layers.locationPreviewText.x = 664 + imageOffset;
  layers.locationPreviewText.y = 86;
  layers.locationPreviewText.style.wordWrapWidth = textWidth;
  let previewText = locationPreviewTextContent(title, details, textWidth);
  setTextIfChanged(layers.locationPreviewText, previewText);
  let textHeight = locationPreviewEstimatedTextHeight(previewText, textWidth);
  if (typeof document !== 'undefined') textHeight = fitMeasuredLocationPreviewText(layers.locationPreviewText, previewText);
  const height = locationPreviewBoxHeight(textHeight);
  bg.roundRect(LOCATION_PREVIEW_BOX.x, LOCATION_PREVIEW_BOX.y, LOCATION_PREVIEW_BOX.width, height, LOCATION_PREVIEW_BOX.radius).fill({ color: ColorPalette.inkPanel, alpha: 0.94 });
  bg.roundRect(LOCATION_PREVIEW_BOX.x, LOCATION_PREVIEW_BOX.y, LOCATION_PREVIEW_BOX.width, height, LOCATION_PREVIEW_BOX.radius).stroke({ width: 1.5, color: ColorPalette.mountainHighlight });
  bg.roundRect(664, 194, 88, 66, 6).fill({ color: ColorPalette.badgeDark, alpha: 0.9 });
  bg.roundRect(664, 194, 88, 66, 6).stroke({ width: 1, color: ColorPalette.badgeGold, alpha: 0.9 });
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
  setTextIfChanged(layers.locationPreviewText, '');
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
  setTextIfChanged(layers.dialogue, `${lines.join('\n')}\n\n${DIALOGUE_CONTINUE_PROMPT}`);
  const layout = dialogueBoxLayout(layers.dialogue.height, hasPortrait);

  g.clear();
  g.roundRect(layout.x, layout.y, layout.width, layout.height, DIALOGUE_LAYOUT_LIMITS.radius).fill({ color: ColorPalette.inkPanel, alpha: 0.86 });
  g.roundRect(layout.x, layout.y, layout.width, layout.height, DIALOGUE_LAYOUT_LIMITS.radius).stroke({ width: 1.5, color: ColorPalette.badgeGold });
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
  const pauseHeight = DIALOGUE_LAYOUT_LIMITS.minHeight + 28;
  const pauseY = DIALOGUE_LAYOUT_LIMITS.bottom - pauseHeight;
  g.clear().roundRect(DIALOGUE_LAYOUT_LIMITS.x, pauseY, DIALOGUE_LAYOUT_LIMITS.width, pauseHeight, DIALOGUE_LAYOUT_LIMITS.radius).fill({ color: ColorPalette.inkPanel, alpha: 0.86 }).roundRect(DIALOGUE_LAYOUT_LIMITS.x, pauseY, DIALOGUE_LAYOUT_LIMITS.width, pauseHeight, DIALOGUE_LAYOUT_LIMITS.radius).stroke({ width: 1.5, color: ColorPalette.mountainHighlight });
  g.visible = true;
  layers.dialoguePortrait.visible = false;
  layers.dialogue.x = DIALOGUE_LAYOUT_LIMITS.x + DIALOGUE_LAYOUT_LIMITS.paddingX;
  layers.dialogue.y = pauseY + DIALOGUE_LAYOUT_LIMITS.paddingY;
  layers.dialogue.style.wordWrapWidth = 560;
  setTextIfChanged(layers.dialogue, '已暂停\n\nEsc / P 继续\n下方按钮打开各系统，B 打开行囊');
  layers.dialogue.visible = true;
}
