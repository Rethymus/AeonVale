/**
 * 应用入口：PixiJS v8 启动 + 输入 → sim 即时动作 + 过夜推进（docs/04 控制）。
 * sim/render 解耦：本文件桥接 io(输入) → sim → render。
 * 启动：pnpm dev（浏览器打开）。全程中文 UI（C8）。
 */
import { Application } from 'pixi.js';
import { createWorld, createSimContext, createSimContextFromState, DEFAULT_BALANCE, applyAction, advanceDay, applyPill, brewPills, placeArray, checkGameEnd, type GameState, type SimContext } from '@sim';
import { saveGame, deserializeState } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';
import { createLayers, drawWorld, setToast, type RenderLayers } from '@render/renderer';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { readyForBreakthrough, breakthrough } from '@sim/progression/progression';
import type { Direction } from '@sim/world/types';
import { AudioEngine } from '@io/audio';

async function main(): Promise<void> {
  const reg = buildRegistry();
  const SEED = 20260710;
  const SAVE_KEY = 'aeonvale-save-v1';

  const loadSave = (): GameState | null => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const sg = JSON.parse(raw) as { schemaHash?: string; state?: unknown };
      if (sg.schemaHash !== reg.schemaHash) return null; // 内容版本不兼容 → 开新档
      return deserializeState(sg.state) as GameState;
    } catch {
      return null;
    }
  };
  const saveState = (s: GameState): void => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveGame(s, reg.schemaHash)));
    } catch {
      /* 存储满/禁用 */
    }
  };
  const clearSave = (): void => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  };

  const loaded = loadSave();
  const state: GameState = loaded ?? createWorld({ seed: SEED, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
  const ctx: SimContext = loaded ? createSimContextFromState(state, reg, DEFAULT_BALANCE) : createSimContext(SEED, reg, DEFAULT_BALANCE);
  if (!loaded) {
    // 初始物资（序章→第一幕过渡）
    mutateItem(state.player, 'seed.mossling', 12);
    mutateItem(state.player, 'seed.dewroot', 6);
    mutateItem(state.player, 'seed.suncap', 4);
    // 少量灵草供炼丹实验（储物戒残存）
    mutateItem(state.player, 'herb.metalpine', 2);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.emberheart', 2);
    mutateItem(state.player, 'herb.dewroot', 4);
  }

  const app = new Application();
  await app.init({ width: 960, height: 540, background: 0x10101a, antialias: true });
  document.body.appendChild(app.canvas);

  const layers: RenderLayers = createLayers(app);
  const audio = new AudioEngine();

  const seedChoices = ['seed.mossling', 'seed.dewroot', 'seed.suncap'];
  let seedIdx = 0;

  /** 玩家面前的格子 */
  function frontTile(): { x: number; y: number } {
    const p = state.player;
    const dx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
    const dy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
    return { x: p.position.x + dx, y: p.position.y + dy };
  }

  function toast(msg: string): void {
    setToast(layers, msg);
  }

  function move(dir: Direction): void {
    state.player.facing = dir;
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    applyAction(state, { kind: 'move', to: { x: state.player.position.x + dx, y: state.player.position.y + dy } }, ctx);
  }

  function endDay(): void {
    state.events.length = 0;
    advanceDay(state, ctx);
    const evStart = state.events.find((e) => e.type === 'celestial-start');
    const matures = state.events.filter((e) => e.type === 'crop-mature').length;
    let msg = `第 ${state.day} 日`;
    if (evStart) msg = `【天象·${(evStart.payload as { displayName?: string })?.displayName ?? ''}】降临！`;
    else if (matures > 0) msg = `${matures} 株灵草成熟`;
    if (readyForBreakthrough(state, DEFAULT_BALANCE)) msg += '　⚠ 修为满，按 T 引劫';
    toast(msg);
  }

  function tryTribulation(): void {
    if (!readyForBreakthrough(state, DEFAULT_BALANCE)) {
      toast('修为未满，不可引劫');
      return;
    }
    const res = runTribulation(state, { stage: state.player.stage, boltCount: 3 + state.player.stage, policy: { blockChance: 0 } }, ctx);
    audio.playSfx('tribulation');
    const br = breakthrough(state, ctx, res.survived);
    checkGameEnd(state, ctx);
    if (state.gameOver) {
      audio.playSfx(state.ending === 'ascension' ? 'ending' : 'explosion');
      audio.setBgmMode('off');
      toast(state.ending === 'ascension' ? '白日飞升！' : '陨于天劫');
      return;
    }
    if (!res.survived) toast('陨于天劫！');
    else if (br.success) {
      audio.playSfx('breakthrough');
      toast(`渡劫成功！突破至 ${state.player.stage} 阶`);
    } else toast(`扛过天劫（淬体+${Math.floor(res.temperingGainMilli / 1000)}）`);
  }

  /** 按丹方炼丹（理想火候，docs/06；完整火候解谜 UI 待 M4） */
  function brewById(recipeId: string, name: string): void {
    const r = ctx.content.recipes.get(recipeId);
    if (!r) { toast('无此丹方'); return; }
    for (const inp of r.inputs) {
      if (itemCount(state.player, inp.herbId) < inp.qty) {
        toast(`材料不足：${ctx.content.items.get(inp.herbId)?.displayName ?? inp.herbId}`);
        return;
      }
    }
    const heat = Math.round((r.idealHeatRange[0] + r.idealHeatRange[1]) / 2);
    const res = brewPills(state, { materials: r.inputs.map((i) => ({ herbId: i.herbId, qty: i.qty })), avgHeatMilli: heat }, ctx);
    audio.playSfx(res.outcome === 'exploded' ? 'explosion' : 'brew');
    toast(res.outcome === 'pill' ? `炼成 ${name}` : res.outcome === 'exploded' ? '炸炉！丹毒反噬' : res.outcome === 'flawed' ? '残丹（效减）' : '废丹');
  }

  function eatById(pillId: string, name: string): void {
    const r = applyPill(state, pillId, ctx);
    if (r.applied) audio.playSfx('eat-pill');
    toast(r.applied ? `服 ${name}：${r.effects.join('，') || '无'}` : `无 ${name}`);
  }

  window.addEventListener('keydown', (ev) => {
    audio.init();
    audio.resume();
    if (state.gameOver) {
      if (ev.key === 'r' || ev.key === 'R') location.reload();
      return;
    }
    const f = frontTile();
    switch (ev.key) {
      case 'ArrowUp':
      case 'w':
        move('up');
        break;
      case 'ArrowDown':
      case 's':
        move('down');
        break;
      case 'ArrowLeft':
      case 'a':
        move('left');
        break;
      case 'ArrowRight':
      case 'd':
        move('right');
        break;
      case ' ': // 翻地
        applyAction(state, { kind: 'till', at: f }, ctx);
        toast('翻地');
        break;
      case 'z': { // 播种
        const sd = seedChoices[seedIdx]!;
        if (itemCount(state.player, sd) <= 0) {
          toast(`无 ${sd} 种子`);
          break;
        }
        applyAction(state, { kind: 'sow', at: f, seedId: sd }, ctx);
        toast(`播种 ${sd}`);
        break;
      }
      case 'x': // 浇水
        applyAction(state, { kind: 'water', at: f }, ctx);
        toast('浇水');
        break;
      case 'c': // 供灵
        applyAction(state, { kind: 'channel-qi', at: f }, ctx);
        toast('供灵');
        break;
      case 'v': // 收获
        applyAction(state, { kind: 'harvest', at: f }, ctx);
        audio.playSfx('harvest');
        toast('收获');
        break;
      case '1':
        seedIdx = 0;
        toast('选种：青苔');
        break;
      case '2':
        seedIdx = 1;
        toast('选种：露根草');
        break;
      case '3':
        seedIdx = 2;
        toast('选种：朝阳菇');
        break;
      case 'Enter':
        endDay();
        break;
      case 't':
        tryTribulation();
        break;
      case 'b':
        brewById('recipe.ward-pill', '避雷丹');
        break;
      case 'n':
        brewById('recipe.bone-pill', '生骨丹');
        break;
      case 'm':
        brewById('recipe.detox-pill', '净毒丹');
        break;
      case 'h':
        eatById('pill.ward-basic', '避雷丹');
        break;
      case 'j':
        eatById('pill.bone-basic', '生骨丹');
        break;
      case 'k':
        eatById('pill.detox', '净毒丹');
        break;
      case 'r': {
        const ft = frontTile();
        const r = placeArray(state, 'array.lightning-rod', ft.x, ft.y, ctx);
        toast(r.placed ? '布设引雷阵（金属性草为阵眼）' : r.reason ?? '不可放置');
        break;
      }
      case 'f': {
        const ft = frontTile();
        const r = placeArray(state, 'array.insulation', ft.x, ft.y, ctx);
        toast(r.placed ? '布设绝缘阵' : r.reason ?? '不可放置');
        break;
      }
      case 'i':
        layers.showInv = !layers.showInv;
        toast(layers.showInv ? '打开背包' : '关闭背包');
        break;
      default:
        return;
    }
    ev.preventDefault();
    if (state.gameOver) clearSave();
    else saveState(state);
  });

  app.ticker.add(() => {
    drawWorld(layers, state, reg);
    // BGM 慢/急切换（docs/10 §10.2）：修为满引劫在即→急，否则→慢
    const mode = state.gameOver ? 'off' : readyForBreakthrough(state, DEFAULT_BALANCE) ? 'tense' : 'calm';
    audio.setBgmMode(mode);
  });

  toast('欢迎来到 永恒山谷。种田以炼丹，炼丹以渡劫。');
}

void main();
