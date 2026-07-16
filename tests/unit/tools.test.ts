/**
 * 工具耐久系统。
 * 覆盖：持有消耗耐久、无工具徒手不阻塞、归零损毁反馈、浇水/收获工具。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, applyAction, performUpgrade } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';
import { tileAt } from '@sim/world/state';
import { MILLI } from '@sim/world/types';
import type { GameState, SimContext } from '@sim';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  state.player.stamina = 10_000 * MILLI;
  return { state, ctx };
}

function firstLoam(state: GameState): { x: number; y: number } {
  const t = state.tiles.find(x => x.soilType === 'loam' && x.blockType === 'none' && !x.tilled);
  if (!t) throw new Error('no tillable loam');
  return { x: t.x, y: t.y };
}

function grantTool(state: GameState, id: string, dur: number): void {
  mutateItem(state.player, id, 1);
  state.player.inventory[id]!.durability = dur;
}

describe('工具耐久', () => {
  it('持有铁锈锄翻地：消耗耐久 + tool-worn 反馈', () => {
    const { state, ctx } = setup();
    grantTool(state, 'item.rust-hoe', 50);
    const at = firstLoam(state);
    state.events.length = 0;
    applyAction(state, { kind: 'till', at }, ctx);
    expect(state.player.inventory['item.rust-hoe']!.durability).toBe(49);
    expect(state.events.some(e => e.type === 'tool-worn')).toBe(true);
  });

  it('无工具徒手翻地：动作成功、无 tool-worn（headless bot 零回归）', () => {
    const { state, ctx } = setup();
    const at = firstLoam(state);
    state.events.length = 0;
    applyAction(state, { kind: 'till', at }, ctx);
    expect(tileAt(state, at.x, at.y)!.tilled).toBe(true);
    expect(state.events.some(e => e.type === 'tool-worn')).toBe(false);
  });

  it('耐久归零：tool-broke 反馈 + 移除工具 + 后续徒手仍可操作', () => {
    const { state, ctx } = setup();
    grantTool(state, 'item.rust-hoe', 1);
    const at = firstLoam(state);
    applyAction(state, { kind: 'till', at }, ctx);
    expect(state.player.inventory['item.rust-hoe']).toBeUndefined;
    expect(state.events.some(e => e.type === 'tool-broke')).toBe(true);
    const at2 = firstLoam(state);
    applyAction(state, { kind: 'till', at: at2 }, ctx);
    expect(tileAt(state, at2.x, at2.y)!.tilled).toBe(true);
  });

  it('浇水消耗灵水桶、收获消耗镰刀耐久', () => {
    const { state, ctx } = setup();
    grantTool(state, 'item.water-pail', 200);
    grantTool(state, 'item.sickle', 80);
    const at = firstLoam(state);
    applyAction(state, { kind: 'till', at }, ctx);
    mutateItem(state.player, 'seed.mossling', 5);
    applyAction(state, { kind: 'sow', at, seedId: 'seed.mossling' }, ctx);
    state.events.length = 0;
    applyAction(state, { kind: 'water', at }, ctx);
    expect(state.player.inventory['item.water-pail']!.durability).toBe(199);
    // 强制成熟后收获
    const tile = tileAt(state, at.x, at.y)!;
    const crop = state.crops.get(tile.cropId!)!;
    crop.growth = 100_000;
    crop.stage = 'mature';
    state.events.length = 0;
    applyAction(state, { kind: 'harvest', at }, ctx);
    expect(state.player.inventory['item.sickle']!.durability).toBe(79);
  });

  it('工具升级降低体力消耗但仍按次消耗耐久', () => {
    const { state, ctx } = setup();
    grantTool(state, 'item.rust-hoe', 50);
    mutateItem(state.player, 'item.spirit-stone', 6);
    mutateItem(state.player, 'item.broken-talisman', 1);
    expect(performUpgrade(state, 'tool-hoe-1').ok).toBe(true);
    const before = state.player.stamina;
    const at = firstLoam(state);

    applyAction(state, { kind: 'till', at }, ctx);

    expect(before - state.player.stamina).toBe(6 * MILLI);
    expect(state.player.inventory['item.rust-hoe']!.durability).toBe(49);
  });

  it('锄头升级后一次翻开目标格与相邻十字地块', () => {
    const { state, ctx } = setup();
    grantTool(state, 'item.rust-hoe', 50);
    mutateItem(state.player, 'item.spirit-stone', 6);
    mutateItem(state.player, 'item.broken-talisman', 1);
    expect(performUpgrade(state, 'tool-hoe-1').ok).toBe(true);
    const before = state.player.stamina;

    applyAction(state, { kind: 'till', at: { x: 3, y: 3 } }, ctx);

    for (const at of [
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 2, y: 3 }
    ]) {
      expect(tileAt(state, at.x, at.y)!.tilled, `${at.x},${at.y}`).toBe(true);
    }
    expect(before - state.player.stamina).toBe(6 * MILLI);
    expect(state.player.inventory['item.rust-hoe']!.durability).toBe(49);
    expect(state.events.filter(e => e.type === 'till').length).toBe(5);
  });

  it('水桶升级后一次浇灌目标格与相邻十字作物', () => {
    const { state, ctx } = setup();
    grantTool(state, 'item.water-pail', 200);
    mutateItem(state.player, 'item.spirit-stone', 6);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    expect(performUpgrade(state, 'tool-pail-1').ok).toBe(true);
    mutateItem(state.player, 'seed.mossling', 5);
    const plots = [
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 2, y: 3 }
    ];
    for (const at of plots) {
      tileAt(state, at.x, at.y)!.tilled = true;
      applyAction(state, { kind: 'sow', at, seedId: 'seed.mossling' }, ctx);
    }
    const before = state.player.stamina;

    applyAction(state, { kind: 'water', at: { x: 3, y: 3 } }, ctx);

    for (const at of plots) {
      expect(tileAt(state, at.x, at.y)!.wateredToday, `${at.x},${at.y}`).toBe(true);
    }
    expect(before - state.player.stamina).toBe(1.5 * MILLI);
    expect(state.player.inventory['item.water-pail']!.durability).toBe(199);
  });
});
