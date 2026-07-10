/**
 * PixiJS v8 渲染层（docs/10 §2 / docs/04 双模 HUD）。
 * 只读 sim 状态绘制；不修改 sim。中文 HUD（C8），CJK 字体走系统回退（首版；正式版内置 霞鹜文楷，docs/10 §13.2）。
 */
import { Application, Graphics, Text } from 'pixi.js';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';
import { MILLI } from '@sim/world/types';

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
    text: '方向键移动·空格翻地·Z播种·X浇水·C供灵·V收获·1/2/3选种·回车过夜·T引劫·B/N/M炼丹·H/J/K服丹·R引雷阵·F绝缘阵',
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
  return { tiles, entities, hud, toast, help, ending };
}

const SEASON_CN: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

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

  // —— 玩家 + 阵眼 ——
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
  const px = OX + p.position.x * TILE + TILE / 2;
  const py = OY + p.position.y * TILE + TILE / 2;
  e.circle(px, py, TILE / 3).fill(0xff5a5a);
  // 朝向指示
  const dx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
  const dy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
  e.circle(px + dx * 10, py + dy * 10, 4).fill(0xffffff);

  // —— HUD ——
  const hpPct = Math.round((p.hp / p.maxHp) * 100);
  const pp = Math.round(p.pillPoison / MILLI);
  const stageNames = ['凡骨', '淬皮', '锻骨', '通脉', '凝丹', '破丹', '化神', '飞升前夜'];
  const ev = state.activeEvent ? `　【天象·${state.activeEvent.displayName} ${state.activeEvent.daysLeft}日】` : '';
  layers.hud.text =
    `第 ${state.day} 日 · ${SEASON_CN[state.season] ?? state.season} · 第 ${state.year} 年　|　` +
    `阶段：${stageNames[state.player.stage] ?? state.player.stage}　` +
    `气血：${hpPct}%　丹毒：${pp}　修为：${Math.floor(p.cultivation / MILLI)}${ev}`;

  // —— 结局遮罩 ——
  if (state.gameOver) {
    layers.tiles.visible = false;
    layers.entities.visible = false;
    layers.ending.text = `${ENDING_CN[state.ending ?? ''] ?? '终'}\n按 R 重新开始`;
    layers.ending.visible = true;
  } else {
    layers.tiles.visible = true;
    layers.entities.visible = true;
    layers.ending.visible = false;
  }
}

export function setToast(layers: RenderLayers, msg: string): void {
  layers.toast.text = msg;
}
