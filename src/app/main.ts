/**
 * 应用入口：PixiJS v8 启动 + 输入 → sim 即时动作 + 过夜推进（docs/04 控制）。
 * sim/render 解耦：本文件桥接 io(输入) → sim → render。
 * 启动：pnpm dev（浏览器打开）。全程中文 UI（C8）。
 */
import { Application } from 'pixi.js';
import { createWorld, createSimContext, DEFAULT_BALANCE, applyAction, advanceDay, type GameState, type SimContext } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';
import { createLayers, drawWorld, setToast, type RenderLayers } from '@render/renderer';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { readyForBreakthrough, breakthrough } from '@sim/progression/progression';
import type { Direction } from '@sim/world/types';

async function main(): Promise<void> {
  const reg = buildRegistry();
  const SEED = 20260710;
  const state: GameState = createWorld({ seed: SEED, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
  const ctx: SimContext = createSimContext(SEED, reg, DEFAULT_BALANCE);

  // 初始物资（序章→第一幕过渡）
  mutateItem(state.player, 'seed.mossling', 12);
  mutateItem(state.player, 'seed.dewroot', 6);
  mutateItem(state.player, 'seed.suncap', 4);

  const app = new Application();
  await app.init({ width: 960, height: 540, background: 0x10101a, antialias: true });
  document.body.appendChild(app.canvas);

  const layers: RenderLayers = createLayers(app);

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
    const matures = state.events.filter((e) => e.type === 'crop-mature').length;
    toast(matures > 0 ? `过夜·新一日（第 ${state.day} 日）·${matures} 株成熟` : `过夜·第 ${state.day} 日 · ${state.events.find((e) => e.type === 'season-change') ? '换季' : ''}`);
  }

  function tryTribulation(): void {
    if (!readyForBreakthrough(state, DEFAULT_BALANCE)) {
      toast('修为未满，不可引劫');
      return;
    }
    const res = runTribulation(state, { stage: state.player.stage, boltCount: 3 + state.player.stage, policy: { blockChance: 0 } }, ctx);
    const br = breakthrough(state, ctx, res.survived);
    if (!res.survived) toast('陨于天劫！');
    else if (br.success) toast(`渡劫成功！突破至 ${state.player.stage + 1 - 1} 阶`);
    else toast(`扛过天劫（淬体+${Math.floor(res.temperingGainMilli / 1000)}）`);
  }

  window.addEventListener('keydown', (ev) => {
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
      default:
        return;
    }
    ev.preventDefault();
  });

  app.ticker.add(() => {
    drawWorld(layers, state, reg);
  });

  toast('欢迎来到 永恒山谷。种田以炼丹，炼丹以渡劫。');
}

void main();
