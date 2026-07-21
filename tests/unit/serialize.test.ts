import { describe, it, expect } from 'vitest';
import { applyAction, createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, greenhouseNurserySlotsRemaining, inventorySlotKey, tileAt } from '@sim';
import { deserializeState, roundTripEqual, canonicalSerialize, stateHash, saveGame, serializeState } from '@sim/serialize';
import { buildRegistry, isSchemaHashCompatible } from '@content/registry';
import { mutateItem } from '@sim/world/player';

describe('序列化与确定性 ', () => {
  it('canonicalSerialize 与 key 顺序无关', () => {
    expect(canonicalSerialize({ a: 1, b: 2 })).toBe(canonicalSerialize({ b: 2, a: 1 }));
    expect(canonicalSerialize({ x: { y: 1 } })).toBe(canonicalSerialize({ x: { y: 1 } }));
  });

  it('空世界存档往返等价', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    expect(roundTripEqual(s)).toBe(true);
  });

  it('出货箱随存档往返保留', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    s.shippingBin['herb.mossling'] = 2;
    expect(roundTripEqual(s)).toBe(true);
  });

  it('旧存档缺少巡守兽字段时默认为空数组', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(s) as Record<string, unknown>;
    delete raw.guardBeasts;

    const restored = deserializeState(raw);

    expect(restored.guardBeasts).toEqual([]);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧存档缺少巡逻指派字段时默认为空数组', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(s) as Record<string, unknown>;
    delete raw.guardBeastPatrols;

    const restored = deserializeState(raw);

    expect(restored.guardBeastPatrols).toEqual([]);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧存档缺少飞升后状态字段时补为默认值', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(s) as Record<string, unknown>;
    delete raw.postAscension;

    const restored = deserializeState(raw);

    expect(restored.postAscension).toEqual({ mode: 'none', ascensionDay: null, victoryRecorded: false });
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧存档缺少留世跨日状态字段时补为默认值', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(s) as Record<string, unknown>;
    delete raw.stayingWorld;

    const restored = deserializeState(raw);

    expect(restored.stayingWorld).toEqual({
      wardingPressure: 18_000,
      quietHarmony: 62_000,
      neglectedWardingDays: 0,
      neglectedQuietDays: 0,
      greenhouseClimate: 42_000,
      greenhouseCareStreak: 0,
      stableDays: 0,
      lastEvaluatedDay: 0,
      currentIncidentId: null,
      currentIncidentDay: 0,
      resolvedIncidentDay: 0
    });
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧巡守兽存档缺少羁绊字段时补为 0', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    s.guardBeasts.push({ id: 1, vigor: 1, maxVigor: 3, bond: 0, specialty: null });
    const raw = serializeState(s) as Record<string, unknown>;
    const guardBeasts = raw.guardBeasts as Array<Record<string, unknown>>;
    delete guardBeasts[0]!.bond;

    const restored = deserializeState(raw);

    expect(restored.guardBeasts[0]?.bond).toBe(0);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧巡守兽存档缺少专长字段时补为 null', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    s.guardBeasts.push({ id: 1, vigor: 1, maxVigor: 3, bond: 36, specialty: null });
    const raw = serializeState(s) as Record<string, unknown>;
    const guardBeasts = raw.guardBeasts as Array<Record<string, unknown>>;
    delete guardBeasts[0]!.specialty;

    const restored = deserializeState(raw);

    expect(restored.guardBeasts[0]?.specialty).toBeNull;
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('巡逻指派随存档往返保留', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    s.guardBeasts.push({ id: 1, vigor: 1, maxVigor: 3, bond: 0, specialty: 'field-ward' });
    s.guardBeastPatrols.push({ beastId: 1, tileId: 5, assignedDay: 3 });

    const restored = deserializeState(serializeState(s));

    expect(restored.guardBeastPatrols).toEqual([{ beastId: 1, tileId: 5, assignedDay: 3 }]);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧存档缺少仓库字段时创建默认空仓库', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(s) as Record<string, unknown>;
    delete raw.storage;

    const restored = deserializeState(raw);

    expect(restored.storage).toEqual({ inventory: {}, qualityInventory: {}, capacity: 48 });
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧存档缺少探索字段时创建默认探索进度', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(s) as Record<string, unknown>;
    delete raw.exploration;

    const restored = deserializeState(raw);

    expect(restored.exploration).toEqual({ deepestRuinLevel: 0 });
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧存档缺少背包格子顺序时创建默认布局状态', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 83, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(state) as Record<string, unknown>;
    delete raw.inventoryLayout;

    const restored = deserializeState(raw);

    expect(restored.inventoryLayout).toEqual({ orders: {}, view: { activeTab: 'player', pageByContainer: {}, searchTerm: '', sortKey: 'layout' } });
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('背包格子顺序序列化时过滤旧 key 并补齐当前 key', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 84, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    mutateItem(state.player, 'seed.mossling', 1);
    mutateItem(state.player, 'item.beast-core', 1);
    state.player.qualityInventory.spirit = { 'herb.dewroot': 2 };
    state.inventoryLayout.orders.player = ['missing.old-key', 'seed.mossling'];

    const raw = serializeState(state) as Record<string, unknown>;
    const layout = raw.inventoryLayout as { orders: { player: string[] } };
    const qualityKey = inventorySlotKey('herb.dewroot', 'spirit');

    expect(layout.orders.player[0]).toBe('seed.mossling');
    expect(layout.orders.player).not.toContain('missing.old-key');
    expect(layout.orders.player).toEqual(expect.arrayContaining(['seed.mossling', 'item.beast-core', qualityKey]));

    const restored = deserializeState(raw);
    expect(restored.inventoryLayout.orders.player).toEqual(layout.orders.player);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('背包视图偏好随存档往返并过滤无效页码', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 85, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.inventoryLayout.view = {
      activeTab: 'storage',
      pageByContainer: { player: 2, storage: 1, shipping: 0 },
      searchTerm: '灵草药酒',
      sortKey: 'count'
    };

    const raw = serializeState(state) as Record<string, unknown>;
    const layout = raw.inventoryLayout as { view: unknown };

    expect(layout.view).toEqual({
      activeTab: 'storage',
      pageByContainer: { player: 2, storage: 1 },
      searchTerm: '灵草药酒',
      sortKey: 'count'
    });

    const restored = deserializeState(raw);
    expect(restored.inventoryLayout.view).toEqual(layout.view);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧背包视图偏好缺字段时补齐默认值', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 86, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(state) as Record<string, unknown>;
    raw.inventoryLayout = {
      orders: {},
      view: { activeTab: 'furnace', pageByContainer: { player: 3 }, sortKey: 'name' }
    };

    const restored = deserializeState(raw);

    expect(restored.inventoryLayout).toEqual({
      orders: {},
      view: { activeTab: 'furnace', pageByContainer: { player: 3 }, searchTerm: '', sortKey: 'name' }
    });
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('遗迹探索进度随存档往返保留', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    s.exploration.deepestRuinLevel = 7;

    const restored = deserializeState(serializeState(s));

    expect(restored.exploration.deepestRuinLevel).toBe(7);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧存档缺少设施字段时默认为空设施表', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(s) as Record<string, unknown>;
    delete raw.facilities;

    const restored = deserializeState(raw);

    expect([...restored.facilities.values()]).toEqual([]);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('旧设施存档缺少加工队列字段时补为 null', () => {
    const reg = buildRegistry();
    const s = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const tile = tileAt(s, 1, 1)!;
    tile.blockType = 'building';
    s.facilities.set(7, { id: 7, kind: 'drying-rack', tileId: tile.id, job: null });
    const raw = serializeState(s) as Record<string, unknown>;
    const facilities = raw.facilities as [number, Record<string, unknown>][];
    delete facilities[0]![1].job;

    const restored = deserializeState(raw);

    expect(restored.facilities.get(7)?.job).toBeNull;
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('种田若干日后存档往返等价', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 42, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(42, reg, DEFAULT_BALANCE);
    mutateItem(state.player, 'seed.mossling', 5);
    simulateDay(state, { actions: [{ kind: 'till', at: { x: 1, y: 1 } }] }, ctx);
    simulateDay(
      state,
      {
        actions: [
          { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.mossling' },
          { kind: 'water', at: { x: 1, y: 1 } },
          { kind: 'channel-qi', at: { x: 1, y: 1 } }
        ]
      },
      ctx
    );
    for (let i = 0; i < 10; i++) {
      simulateDay(
        state,
        {
          actions: [
            { kind: 'water', at: { x: 1, y: 1 } },
            { kind: 'channel-qi', at: { x: 1, y: 1 } }
          ]
        },
        ctx
      );
    }
    expect(roundTripEqual(state)).toBe(true);
  });

  it('暖棚离季苗标记可随存档往返保留', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 77, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(77, reg, DEFAULT_BALANCE);
    state.player.stage = 7;
    state.postAscension.mode = 'stayed-in-world';
    state.season = 'winter';
    state.day = 2;
    state.seasonDay = 2;
    mutateItem(state.player, 'seed.sunmoss', 1);
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);

    applyAction(state, { kind: 'till', at: { x: 1, y: 1 } }, ctx);
    state.flags.add('upgrade.greenhouse-nursery-1');
    state.flags.add('greenhouse-tended.2');
    applyAction(state, { kind: 'sow', at: { x: 1, y: 1 }, seedId: 'seed.sunmoss' }, ctx);
    applyAction(state, { kind: 'water', at: { x: 1, y: 1 } }, ctx);
    applyAction(state, { kind: 'channel-qi', at: { x: 1, y: 1 } }, ctx);

    const restored = deserializeState(serializeState(state));
    const tile = tileAt(restored, 1, 1)!;
    expect(restored.crops.get(tile.id)?.greenhouseProtected).toBe(true);
    expect(greenhouseNurserySlotsRemaining(restored)).toBe(2);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('旧存档缺少地块连作追踪字段时补为默认值', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 82, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const raw = serializeState(state) as Record<string, unknown>;
    const tiles = raw.tiles as Array<Record<string, unknown>>;
    delete tiles[0]!.lastHarvestedCropDefId;
    delete tiles[0]!.consecutiveSameCropSeasons;

    const restored = deserializeState(raw);

    expect(restored.tiles[0]?.lastHarvestedCropDefId).toBeNull;
    expect(restored.tiles[0]?.consecutiveSameCropSeasons).toBe(0);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('留世跨日状态可随存档往返保留', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 78, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    state.postAscension.mode = 'stayed-in-world';
    state.stayingWorld.wardingPressure = 57_000;
    state.stayingWorld.quietHarmony = 41_000;
    state.stayingWorld.neglectedWardingDays = 3;
    state.stayingWorld.neglectedQuietDays = 2;
    state.stayingWorld.greenhouseClimate = 74_000;
    state.stayingWorld.greenhouseCareStreak = 5;
    state.stayingWorld.stableDays = 1;
    state.stayingWorld.lastEvaluatedDay = 9;
    state.stayingWorld.currentIncidentId = 'incident.array-fray';
    state.stayingWorld.currentIncidentDay = 10;
    state.stayingWorld.resolvedIncidentDay = 10;

    const restored = deserializeState(serializeState(state));

    expect(restored.stayingWorld).toEqual(state.stayingWorld);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('旧留世存档缺少暖棚跨日字段时补为默认值', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 81, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    state.postAscension.mode = 'stayed-in-world';
    const raw = serializeState(state) as Record<string, unknown>;
    const stayingWorld = raw.stayingWorld as Record<string, unknown>;
    delete stayingWorld.greenhouseClimate;
    delete stayingWorld.greenhouseCareStreak;

    const restored = deserializeState(raw);

    expect(restored.stayingWorld.greenhouseClimate).toBe(42_000);
    expect(restored.stayingWorld.greenhouseCareStreak).toBe(0);
    expect(roundTripEqual(restored)).toBe(true);
  });

  it('留世胜后存档标记可随存档往返保留', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 79, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = 12;
    state.postAscension.victoryRecorded = true;

    const restored = deserializeState(serializeState(state));

    expect(restored.postAscension).toEqual(state.postAscension);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('同种子+同输入 ⇒ 同 stateHash（Golden Replay 基础）', () => {
    const reg = buildRegistry();
    const run = (seed: number) => {
      const state = createWorld({ seed, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
      const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
      mutateItem(state.player, 'seed.dewroot', 3);
      for (let d = 0; d < 8; d++) {
        simulateDay(state, { actions: [{ kind: 'water', at: { x: 2, y: 2 } }] }, ctx);
      }
      return stateHash(state);
    };
    expect(run(7)).toBe(run(7));
    expect(run(7)).not.toBe(run(8));
  });

  it('新增可选内容兼容旧 schemaHash，未知指纹仍拒绝', () => {
    const reg = buildRegistry();
    expect(isSchemaHashCompatible(reg, reg.schemaHash)).toBe(true);
    expect(isSchemaHashCompatible(reg, '1eb5f343')).toBe(true);
    expect(isSchemaHashCompatible(reg, 'unknown')).toBe(false);
  });

  it('saveGame 返回有效 SaveGame 结构（formatVersion/gameVersion/schemaHash/state）', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 5, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(5, reg, DEFAULT_BALANCE);
    simulateDay(state, { actions: [] }, ctx);
    const sg = saveGame(state, 'abc123');
    expect(sg.formatVersion).toBe(1);
    expect(sg.gameVersion).toBeTruthy();
    expect(sg.schemaHash).toBe('abc123');
    expect(sg.state).toBeTruthy();
    expect(sg.createdAt).toBe(0); // io 层负责填时间，sim 层恒为 0
  });
});
