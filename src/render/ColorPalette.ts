/**
 * AeonVale 全局视觉语义色。
 *
 * 生产渲染与 DOM/CSS 的颜色只允许从这里进入。数值颜色保留 Pixi 的
 * 0xRRGGBB 形式；CSS 变量由 applyColorPaletteCssVariables() 统一注入。
 * 透明度属于表现参数，不属于颜色真源。
 */
/**
 * 32 个 canonical swatch 是生产色值的唯一来源。
 *
 * ColorPalette 保留较细的历史语义 token 作为兼容 alias；新增调用应优先
 * 复用已有 token，而不是增加新的 RGB。透明色与黑色共享同一数值。
 */
const CanonicalSwatches = {
  black: 0x000000,
  canvas: 0x10101a,
  shell: 0x0d1714,
  shellPine: 0x173c32,
  inkDark: 0x1a1a1f,
  inkPanel: 0x12121c,
  inkWarm: 0x272117,
  paper: 0xf4ecd8,
  paperMuted: 0xd8d0ba,
  trueWhite: 0xffffff,
  mountain: 0x5c6b73,
  mountainMuted: 0x9aa3b2,
  frost: 0x9fb6c4,
  soilFertile: 0xa88b5c,
  soil: 0x6b4f2a,
  soilDeep: 0x4a3318,
  soilShadow: 0x2a1a0a,
  soilHighlight: 0xd8b070,
  water: 0x2a4a6b,
  qiFlow: 0x4a8c9c,
  qiBright: 0x66ddff,
  waterBright: 0x7ec8ff,
  moss: 0x7a8c5a,
  leaf: 0x4a9a30,
  success: 0x7fe38b,
  danger: 0xb5482f,
  dangerBright: 0xff5a5a,
  ember: 0xff8a3a,
  gilt: 0xc9a14a,
  giltBright: 0xffe066,
  palePurple: 0x7b6c8a,
  purpleBright: 0xb48cff
} as const;

export const ColorPalette = {
  // 基础语义色（P0 必需）
  transparent: CanonicalSwatches.black,
  paper: CanonicalSwatches.paper,
  inkDark: CanonicalSwatches.inkDark,
  soilFertile: CanonicalSwatches.soilFertile,
  qiFlow: CanonicalSwatches.qiFlow,
  danger: CanonicalSwatches.danger,

  // 画布、面板与文字
  canvas: CanonicalSwatches.canvas,
  shell: CanonicalSwatches.shell,
  shellPine: CanonicalSwatches.shellPine,
  shellPineLight: CanonicalSwatches.shellPine,
  paperUi: CanonicalSwatches.paper,
  paperText: CanonicalSwatches.paperMuted,
  paperBright: CanonicalSwatches.trueWhite,
  paperWarm: CanonicalSwatches.paperMuted,
  paperMuted: CanonicalSwatches.paperMuted,
  paperGold: CanonicalSwatches.gilt,
  moonWhite: CanonicalSwatches.paper,
  trueWhite: CanonicalSwatches.trueWhite,
  black: CanonicalSwatches.black,
  ink: CanonicalSwatches.inkDark,
  inkUi: CanonicalSwatches.inkWarm,
  inkPanel: CanonicalSwatches.inkPanel,
  inkPanelDeep: CanonicalSwatches.inkDark,
  inkShadow: CanonicalSwatches.black,
  inkBlueDeep: CanonicalSwatches.water,
  inkBlue: CanonicalSwatches.water,
  inkNearBlack: CanonicalSwatches.inkPanel,
  inkDeep: CanonicalSwatches.canvas,
  inkVoid: CanonicalSwatches.shell,
  tileShade: CanonicalSwatches.canvas,
  mutedInk: CanonicalSwatches.soil,
  mountain: CanonicalSwatches.mountain,
  mountainHighlight: CanonicalSwatches.mountain,
  mountainMuted: CanonicalSwatches.mountainMuted,
  stoneGray: CanonicalSwatches.mountainMuted,
  neutralGray: CanonicalSwatches.mountainMuted,
  moonGray: CanonicalSwatches.frost,
  frostGray: CanonicalSwatches.frost,

  // 土地与农业
  loess: CanonicalSwatches.soilFertile,
  loessDeep: CanonicalSwatches.soil,
  loessMuted: CanonicalSwatches.soilFertile,
  soil: CanonicalSwatches.soil,
  soilDeep: CanonicalSwatches.soilDeep,
  soilShadow: CanonicalSwatches.soilShadow,
  soilBorder: CanonicalSwatches.soilShadow,
  soilInk: CanonicalSwatches.soilShadow,
  soilDampShadow: CanonicalSwatches.soilShadow,
  seedDark: CanonicalSwatches.soilDeep,
  soilWarm: CanonicalSwatches.soil,
  soilMuted: CanonicalSwatches.soilFertile,
  soilHighlight: CanonicalSwatches.soilHighlight,
  soilWet: CanonicalSwatches.soilDeep,
  soilSpirit: CanonicalSwatches.moss,
  sand: CanonicalSwatches.soilFertile,
  scorchedSoil: CanonicalSwatches.soilShadow,
  water: CanonicalSwatches.water,
  waterSheen: CanonicalSwatches.qiFlow,
  waterDamp: CanonicalSwatches.water,
  waterBlue: CanonicalSwatches.waterBright,
  waterText: CanonicalSwatches.qiBright,
  waterHighlight: CanonicalSwatches.trueWhite,
  waterPaper: CanonicalSwatches.trueWhite,
  metalOre: CanonicalSwatches.mountain,
  insulated: CanonicalSwatches.mountain,
  wood: CanonicalSwatches.soil,
  woodBrown: CanonicalSwatches.soil,
  woodDark: CanonicalSwatches.soilDeep,

  // 植物、灵气与状态
  moss: CanonicalSwatches.moss,
  mossBright: CanonicalSwatches.success,
  mossCue: CanonicalSwatches.success,
  mossPaper: CanonicalSwatches.paper,
  leaf: CanonicalSwatches.leaf,
  leafDark: CanonicalSwatches.moss,
  qiBright: CanonicalSwatches.qiBright,
  qiSoft: CanonicalSwatches.trueWhite,
  qiLight: CanonicalSwatches.qiFlow,
  qiPale: CanonicalSwatches.qiBright,
  qiText: CanonicalSwatches.qiBright,
  qiBlue: CanonicalSwatches.waterBright,
  qiPaper: CanonicalSwatches.trueWhite,
  success: CanonicalSwatches.success,
  successPaper: CanonicalSwatches.paper,
  warning: CanonicalSwatches.giltBright,
  warningSoft: CanonicalSwatches.giltBright,
  warningOrange: CanonicalSwatches.ember,
  dangerBright: CanonicalSwatches.dangerBright,
  dangerOrange: CanonicalSwatches.dangerBright,
  cinnabarDeep: CanonicalSwatches.soilShadow,
  cinnabarOrange: CanonicalSwatches.danger,
  ember: CanonicalSwatches.ember,
  emberBright: CanonicalSwatches.giltBright,
  emberWarm: CanonicalSwatches.ember,
  gilt: CanonicalSwatches.gilt,
  giltBright: CanonicalSwatches.giltBright,
  giltCrop: CanonicalSwatches.giltBright,
  giltSoft: CanonicalSwatches.giltBright,
  giltPaper: CanonicalSwatches.paper,
  giltGlow: CanonicalSwatches.trueWhite,
  palePurple: CanonicalSwatches.palePurple,
  purpleDanger: CanonicalSwatches.purpleBright,
  purpleBolt: CanonicalSwatches.purpleBright,
  purpleSoft: CanonicalSwatches.purpleBright,
  purplePaper: CanonicalSwatches.paperMuted,
  purpleText: CanonicalSwatches.paperMuted,
  purpleAction: CanonicalSwatches.purpleBright,
  frost: CanonicalSwatches.frost,
  frostDeep: CanonicalSwatches.mountain,
  frostPaper: CanonicalSwatches.paperMuted,
  frostTint: CanonicalSwatches.paperMuted,
  withered: CanonicalSwatches.soil,

  // 组件/设施的少量既有语义色
  facilityGold: CanonicalSwatches.gilt,
  facilityBlue: CanonicalSwatches.qiFlow,
  facilityCinnabar: CanonicalSwatches.danger,
  facilityDark: CanonicalSwatches.soilShadow,
  markerDark: CanonicalSwatches.soilShadow,
  markerBrown: CanonicalSwatches.soilDeep,
  badgeDark: CanonicalSwatches.inkPanel,
  badgeGold: CanonicalSwatches.gilt,
  borderDark: CanonicalSwatches.mountain,
  borderMuted: CanonicalSwatches.soil,
  grayBlue: CanonicalSwatches.mountain,
  grayGreen: CanonicalSwatches.moss,
  grayGreenDark: CanonicalSwatches.moss,
  grayDark: CanonicalSwatches.mountain,
  blackWarm: CanonicalSwatches.inkWarm,
  accentPurple: CanonicalSwatches.palePurple,
  accentGreen: CanonicalSwatches.success,
  propertyCold: CanonicalSwatches.qiBright,
  propertyWarm: CanonicalSwatches.ember,
  accentRed: CanonicalSwatches.dangerBright,
  sowBurst: CanonicalSwatches.moss,
  sowText: CanonicalSwatches.success,
  playerWarm: CanonicalSwatches.paperMuted,
  playerSkin: CanonicalSwatches.paper,
  playerSkinLight: CanonicalSwatches.paperMuted,
  playerHighlight: CanonicalSwatches.trueWhite,
  playerSash: CanonicalSwatches.danger,
  playerGilt: CanonicalSwatches.gilt,
  playerOutline: CanonicalSwatches.soilShadow,

  // 季节低透明叠色
  seasonSpring: CanonicalSwatches.moss,
  seasonSummer: CanonicalSwatches.soilFertile,
  seasonAutumn: CanonicalSwatches.danger,
  seasonWinter: CanonicalSwatches.water,

  // CSS 既有语义 alias
  cssSurfaceDeep: CanonicalSwatches.shell,
  cssSurfacePine: CanonicalSwatches.shellPine,
  cssSurfaceDark: CanonicalSwatches.inkWarm,
  cssTextLight: CanonicalSwatches.trueWhite,
  cssTextWarm: CanonicalSwatches.paper,
  cssTextMuted: CanonicalSwatches.paperMuted,
  cssTextGold: CanonicalSwatches.gilt,
  cssTextCinnabar: CanonicalSwatches.danger,
  cssBorderPine: CanonicalSwatches.shellPine,
  cssBorderGold: CanonicalSwatches.gilt,
  cssSurfaceBrown: CanonicalSwatches.soil,
  cssSurfaceBrownDark: CanonicalSwatches.soil,
  cssSurfaceRed: CanonicalSwatches.danger,
  cssSurfaceGreen: CanonicalSwatches.moss,
  cssSurfaceGreenDark: CanonicalSwatches.moss,
  cssSurfaceBlueGreen: CanonicalSwatches.qiFlow,
  cssTextBrown: CanonicalSwatches.soil,
  cssTextBrownLight: CanonicalSwatches.soilFertile,
  cssTextBrownDark: CanonicalSwatches.inkWarm,
  cssCinnabarMuted: CanonicalSwatches.danger,
  cssGoldMuted: CanonicalSwatches.gilt,
  cssPaperMuted: CanonicalSwatches.paperMuted,

  // DOM 现有视觉的语义 alias
  giltUi: CanonicalSwatches.gilt,
  dangerUi: CanonicalSwatches.danger,
  pinePressed: CanonicalSwatches.shellPine,
  pineOverlay: CanonicalSwatches.shellPine,
  pineNight: CanonicalSwatches.shell,
  mountainFar: CanonicalSwatches.shellPine,
  mountainMid: CanonicalSwatches.inkDark,
  mountainNear: CanonicalSwatches.shell,
  mistPaper: CanonicalSwatches.paper,
  inkEarthDeep: CanonicalSwatches.soilShadow,
  paperWarmStrong: CanonicalSwatches.paperMuted,
  paperWarmSoft: CanonicalSwatches.paper,
  paperPanel: CanonicalSwatches.paper,
  paperBorder: CanonicalSwatches.paperMuted,
  emberUi: CanonicalSwatches.ember,
  paperPanelLight: CanonicalSwatches.paper,
  giltPale: CanonicalSwatches.giltBright
} as const;

export type ColorPaletteKey = keyof typeof ColorPalette;

function rgbChannels(color: number): string {
  const value = color >>> 0;
  return `${(value >>> 16) & 0xff} ${(value >>> 8) & 0xff} ${value & 0xff}`;
}

function cssHex(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, '0')}`;
}

export function titleLandscapeCssImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice"><rect width="1280" height="800" fill="${cssColor('pinePressed')}"/><rect width="1280" height="300" fill="${cssColor('pineNight')}"/><path d="M0,800 L0,360 L120,300 L240,350 L360,270 L490,330 L620,250 L760,320 L880,280 L1000,330 L1130,290 L1280,340 L1280,800 Z" fill="${cssColor('mountainFar')}"/><path d="M0,800 L0,470 L150,420 L300,460 L460,400 L620,450 L790,410 L940,450 L1090,420 L1280,455 L1280,800 Z" fill="${cssColor('mountainMid')}"/><path d="M0,800 L0,560 L160,520 L320,555 L480,500 L640,548 L800,510 L960,550 L1120,515 L1280,548 L1280,800 Z" fill="${cssColor('mountainNear')}"/><ellipse cx="640" cy="300" rx="540" ry="92" fill="${cssColor('mistPaper')}" opacity="0.05"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** 将同一份 Pixi 色值注入 DOM/CSS 变量。 */
export function applyColorPaletteCssVariables(root: { style: { setProperty(name: string, value: string): void } }): void {
  for (const [name, value] of Object.entries(ColorPalette)) {
    root.style.setProperty(`--color-${name}`, name === 'transparent' ? 'transparent' : cssHex(value));
    root.style.setProperty(`--rgb-${name}`, rgbChannels(value));
  }
  root.style.setProperty('--image-title-landscape', titleLandscapeCssImage());
}

export function cssColor(key: ColorPaletteKey): string {
  return key === 'transparent' ? 'transparent' : cssHex(ColorPalette[key]);
}

export function cssRgb(key: ColorPaletteKey): string {
  return rgbChannels(ColorPalette[key]);
}

/**
 * R4-a 雷劫炼体原型调色（dev-only surface 画板 + 内联样式用）。
 * 集中于此以守色盘纪律（hex 只允许在 ColorPalette.ts）；正式整合（R4-d）时并入正式调色体系。
 */
export const ROGUELITE_PROTO_PALETTE = {
  soilFill: {
    loam: '#5b4632',
    'wet-loam': '#3a2818',
    'dry-sand': '#a8895a',
    'metal-ore': '#8a8f99',
    scorched: '#241a14',
    insulated: '#163030',
    'spirit-loam': '#5b4632',
    rock: '#3b3b3b',
    water: '#274060'
  },
  text: '#e8e0d0',
  accent: '#ffd27a',
  hpTrack: '#2a2030',
  hpBorder: '#553a5a',
  hpLo: '#e0556a',
  hpHi: '#ffa078',
  boardBg: '#0e0b12',
  boardBorder: '#3a2f3a',
  helpText: '#c2b7ab',
  btnBg: '#2a2330',
  btnBorder: '#4a3f4a',
  primaryBg: '#4a2f5a',
  primaryBorder: '#7a4f8a',
  okBg: '#1c3a2a',
  okText: '#9fe8b0',
  badBg: '#3a1c22',
  badText: '#ffb0b8',
  rod: '#ffd27a',
  boltViolet: '#c084ff',
  boltBlue: '#7ad0ff',
  ringPerfect: '#ffe066',
  ringExpired: '#ff5566',
  bodyAlive: '#f2e8d0',
  bodyDead: '#7a2030',
  bodyStroke: '#1a1418',
  // R4′ Sokoban 布阵导流 用色（与上面共用一 palette，集中守纪律）
  floor: '#3a2c1e',
  wallStone: '#2a2a30',
  beamSource: '#5aa0ff',
  goalBody: '#7af0c8',
  herbGreen: '#2e6b3a',
  herbLight: '#5fa86a',
  mirrorGold: '#ffcf4a',
  conductorBlue: '#4ab6d8',
  insulatorPurple: '#5a4a6a',
  beamGlow: '#ffe066'
} as const;
