/**
 * PixiJS v8 渲染层（docs/10 §2 / docs/04 双模 HUD）。
 * 只读 sim 状态绘制；不修改 sim。中文 HUD（C8），CJK 字体走系统回退（首版；正式版内置 霞鹜文楷，docs/10 §13.2）。
 */
import { Application, Graphics, Text } from 'pixi.js';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';
import { MILLI } from '@sim/world/types';
import { stageQiCap } from '@sim/progression/progression';
import { DEFAULT_BALANCE } from '@sim/params';

/** CJK 字体栈（首版用系统 CJK 回退；正式版应 FontFace 预加载 霞鹜文楷，docs/10 §13.2） */
export const CJK_FONT = "'LXGW WenKai','Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif";

export const TILE = 42;
const OX = 32;
const OY = 70;

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

export interface RenderLayers {
  tiles: Graphics;
  entities: Graphics;
  hud: Text;
  toast: Text;
  help: Text;
  ending: Text;
  inv: Text;
  bars: Graphics;
  barLabels: Text[];
  showInv: boolean;
  furnaceHeat: number; // 玩家炉温 0..100（app 设置，HUD 显示）
}

const ENDING_CN: Record<string, string> = {
  ascension: '白日飞升',
  'poison-death': '丹毒暴毙',
  'tribulation-death': '陨于天劫',
  madness: '走火入魔',
};

export function createLayers(app: Application): RenderLayers {
  const tiles = new Graphics();
  app.stage.addChild(tiles);
  const entities = new Graphics();
  app.stage.addChild(entities);
  const hud = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 15, fill: 0xeae0c8 },
  });
  hud.x = 10;
  hud.y = 8;
  app.stage.addChild(hud);
  const toast = new Text({
    text: '',
    style: { fontFamily: CJK_FONT, fontSize: 16, fill: 0xffe066 },
  });
  toast.x = 10;
  toast.y = app.screen.height - 56;
  app.stage.addChild(toast);
  const help = new Text({
    text: '方向键移动·空格翻地·Z播种·X浇水·C供灵·V收获·1-6选种·回车过夜·T引劫·G猎妖·B/N/M炼丹·[/]调炉温·H/J/K服丹·E飞升·R引雷阵·F绝缘阵·Q静修·I背包',
    style: { fontFamily: CJK_FONT, fontSize: 12, fill: 0x9090a0 },
  });
  help.x = 10;
  help.y = app.screen.height - 24;
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
  const bars = new Graphics();
  app.stage.addChild(bars);
  const barLabels = ['气血', '丹毒', '修为', '体力'].map((label, i) => {
    const t = new Text({ text: label, style: { fontFamily: CJK_FONT, fontSize: 11, fill: 0xb0b0c8 } });
    t.x = 12 + i * 152;
    t.y = 26;
    app.stage.addChild(t);
    return t;
  });
  return { tiles, entities, hud, toast, help, ending, inv, bars, barLabels, showInv: false, furnaceHeat: 50 };
}

const SEASON_CN: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

/** 画一根水平条（背景 + 填充 + 描边）。pct 钳到 [0,1]。 */
function drawBar(g: Graphics, x: number, y: number, w: number, h: number, pct: number, fill: number): void {
  g.rect(x, y, w, h).fill({ color: 0x1a1a22, alpha: 0.9 });
  const fw = Math.max(0, Math.min(1, pct)) * (w - 2);
  if (fw > 0) g.rect(x + 1, y + 1, fw, h - 2).fill(fill);
  g.rect(x, y, w, h).stroke({ width: 1, color: 0x3a3a44 });
}

const INV_GROUPS: Array<{ prefix: string; title: string }> = [
  { prefix: 'seed.', title: '种子' },
  { prefix: 'herb.', title: '灵草' },
  { prefix: 'pill.', title: '丹药' },
  { prefix: 'item.', title: '杂物' },
];

/** 背包按类目分组渲染（种子/灵草/丹药/杂物/其他）。 */
function renderInventory(state: GameState, content: ContentRegistry): string {
  const entries = Object.entries(state.player.inventory).filter(([, s]) => s && s.count > 0);
  if (entries.length === 0) return '—— 背包 ——\n（空）';
  const lines: string[] = ['—— 背包 ——'];
  const grouped = new Map<string, Array<[string, number]>>();
  const others: Array<[string, number]> = [];
  for (const [id, slot] of entries) {
    const name = content.items.get(id)?.displayName ?? id;
    const grp = INV_GROUPS.find((g) => id.startsWith(g.prefix));
    if (grp) (grouped.get(grp.title) ?? grouped.set(grp.title, []).get(grp.title)!).push([name, slot.count]);
    else others.push([name, slot.count]);
  }
  for (const g of INV_GROUPS) {
    const arr = grouped.get(g.title);
    if (arr) lines.push(`[${g.title}]`, ...arr.map(([n, c]) => `  ${n} ×${c}`));
  }
  if (others.length) lines.push('[其他]', ...others.map(([n, c]) => `  ${n} ×${c}`));
  return lines.join('\n');
}

export function drawWorld(layers: RenderLayers, state: GameState, content: ContentRegistry): void {
  // —— 瓦片 + 作物 ——
  const g = layers.tiles;
  g.clear();
  for (const t of state.tiles) {
    const x = OX + t.x * TILE;
    const y = OY + t.y * TILE;
    g.rect(x, y, TILE - 1, TILE - 1).fill(SOIL_COLOR[t.soilType] ?? 0x6b4f2a);
    if (t.tilled) g.rect(x + 3, y + 3, TILE - 7, TILE - 7).fill(0x4a3318);
    if (t.cropId != null) {
      const crop = state.crops.get(t.id);
      if (crop) {
        const herb = content.herbs.get(crop.defId);
        const col = crop.stage === 'withered' ? STAGE_COLOR.withered : (herb?.metalAttract ?? 0) > 1 ? 0xb8b8c8 : STAGE_COLOR[crop.stage] ?? 0x4a9a30;
        g.circle(x + TILE / 2, y + TILE / 2, TILE / 3).fill(col);
      }
    }
  }

  // —— 玩家 + 阵眼 + 面前格光标 ——
  const e = layers.entities;
  e.clear();
  // 阵眼标记（引雷阵=金、绝缘阵=青）
  for (const arr of state.arrays.values()) {
    if (!arr.active) continue;
    const core = state.tiles[arr.coreTileId];
    if (!core) continue;
    const cx = OX + core.x * TILE + TILE / 2;
    const cy = OY + core.y * TILE + TILE / 2;
    e.circle(cx, cy, 6).fill(arr.defId === 'array.lightning-rod' ? 0xffe066 : 0x66ddff);
  }
  const p = state.player;
  // 面前格高亮（操作目标）
  const fdx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
  const fdy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
  const fx = p.position.x + fdx;
  const fy = p.position.y + fdy;
  if (fx >= 0 && fy >= 0 && fx < state.width && fy < state.height) {
    e.rect(OX + fx * TILE, OY + fy * TILE, TILE - 1, TILE - 1).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
  }
  const px = OX + p.position.x * TILE + TILE / 2;
  const py = OY + p.position.y * TILE + TILE / 2;
  e.circle(px, py, TILE / 3).fill(0xff5a5a);
  // 朝向指示
  e.circle(px + fdx * 10, py + fdy * 10, 4).fill(0xffffff);

  // —— HUD：状态文字 + 图形条（气血/丹毒/修为/体力）——
  const bg = layers.bars;
  bg.clear();
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  const hpPct = Math.round(hpRatio * 100);
  const pp = Math.round(p.pillPoison / MILLI);
  const poisonCap = DEFAULT_BALANCE.pillPoison.cap; // 100
  const poisonPct = Math.min(1, p.pillPoison / (poisonCap * MILLI));
  const staCap = DEFAULT_BALANCE.player.staminaCap * MILLI;
  const staPct = Math.max(0, Math.min(1, p.stamina / staCap));
  const stageNames = ['凡骨', '淬皮', '锻骨', '通脉', '凝丹', '破丹', '化神', '飞升前夜'];
  // 修为进度：当前阶段修为 / 该阶段修为上限（stage≥7 飞升前夜无后续突破→满条）
  const cultPct = p.stage >= 7 ? 1 : Math.min(1, p.cultivation / stageQiCap(p.stage, DEFAULT_BALANCE));
  // 控血走钢丝（docs/14 §6.2）：HP<20% 黄警，<10% 红警（险死区是核心张力）
  const hpColor = hpRatio > 0.5 ? 0x4ade80 : hpRatio > 0.2 ? 0xffe066 : 0xff5a5a;
  const poisonColor = poisonPct > 0.7 ? 0xff3030 : poisonPct > 0.4 ? 0xff8a3a : 0x9a7a3a;
  const BAR_W = 120, BAR_H = 11, BAR_X0 = 12, BAR_DX = 152, BAR_Y = 42;
  drawBar(bg, BAR_X0, BAR_Y, BAR_W, BAR_H, hpRatio, hpColor);
  drawBar(bg, BAR_X0 + BAR_DX, BAR_Y, BAR_W, BAR_H, poisonPct, poisonColor);
  drawBar(bg, BAR_X0 + 2 * BAR_DX, BAR_Y, BAR_W, BAR_H, cultPct, 0x66ddff);
  drawBar(bg, BAR_X0 + 3 * BAR_DX, BAR_Y, BAR_W, BAR_H, staPct, 0x7ac050);
  layers.barLabels[0]!.text = `气血 ${hpPct}%`;
  layers.barLabels[1]!.text = `丹毒 ${pp}`;
  layers.barLabels[2]!.text = `修为 ${Math.round(cultPct * 100)}%`;
  layers.barLabels[3]!.text = `体力 ${Math.round(staPct * 100)}%`;
  const ev = state.activeEvent ? `　【天象·${state.activeEvent.displayName} ${state.activeEvent.daysLeft}日】` : '';
  const surge = state.beastSurge ? `　⚠妖兽潮 ${state.beastSurge.daysLeft}日` : '';
  layers.hud.text =
    `第 ${state.day} 日 · ${SEASON_CN[state.season] ?? state.season} · 第 ${state.year} 年　|　` +
    `阶段：${stageNames[state.player.stage] ?? state.player.stage}　炉温：${layers.furnaceHeat}${ev}${surge}`;

  // —— 结局遮罩 ——
  if (state.gameOver) {
    layers.tiles.visible = false;
    layers.entities.visible = false;
    layers.bars.visible = false;
    for (const lbl of layers.barLabels) lbl.visible = false;
    layers.ending.text = `${ENDING_CN[state.ending ?? ''] ?? '终'}\n按 R 重新开始`;
    layers.ending.visible = true;
    layers.inv.visible = false;
  } else {
    layers.tiles.visible = true;
    layers.entities.visible = true;
    layers.bars.visible = true;
    for (const lbl of layers.barLabels) lbl.visible = true;
    layers.ending.visible = false;
    if (layers.showInv) {
      layers.inv.text = renderInventory(state, content);
      layers.inv.visible = true;
    } else {
      layers.inv.visible = false;
    }
  }
}

export function setToast(layers: RenderLayers, msg: string): void {
  layers.toast.text = msg;
}
