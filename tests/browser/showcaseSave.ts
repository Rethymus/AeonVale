import { expect, type Page } from '@playwright/test';
import { buildRegistry } from '@content/registry';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, placeArray } from '@sim';
import { placeFacility } from '@sim/buildings/facilities';
import { saveGame } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';
import { tileAt } from '@sim/world/state';

export const SAVE_KEY = 'aeonvale-save-v1';

/**
 * 构造一份"发展态"展示存档（stage 3、多阶段作物、阵法、设施、巡守兽、承雷丹），
 * 用于截图/演示。预标关键叙事节拍 seen，避免截图时弹出对白。
 */
export function buildShowcaseSave(): string {
  const reg = buildRegistry();
  const state = createWorld({ seed: 20260714, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(state.masterSeed, reg, DEFAULT_BALANCE);

  // showcase 处于 stage=3 + temperingStack>0 的发展态；stage-3 与 first-tribulation 节拍会因此触发，
  // 但展示存档应代表玩家已阅过它们，预标 seen 以免截图时弹出对白（本夹具是截图用，非叙事流测试）。
  for (const beat of ['awaken', 'spirit-test', 'intro', 'first-till', 'first-tribulation', 'stage-3']) {
    state.player.flags.add(`narr-${beat}`);
  }
  state.player.flags.add('onboarding-first-second-water');
  state.day = 9;
  state.seasonDay = 9;
  state.season = 'spring';
  state.player.position = { x: 7, y: 3 };
  state.player.facing = 'down';
  state.player.stage = 3;
  state.player.hp = 84_000;
  state.player.stamina = 78_000;
  state.player.bodyFoundation = 26_000;
  state.player.cultivation = state.player.bodyFoundation;
  state.player.temperingStack = 8_000;
  state.player.pillPoison = 7_000;

  mutateItem(state.player, 'item.spirit-stone', 9);
  mutateItem(state.player, 'item.rust-hoe', 1);
  mutateItem(state.player, 'item.water-pail', 1);
  mutateItem(state.player, 'item.sickle', 1);
  mutateItem(state.player, 'seed.mossling', 4);
  mutateItem(state.player, 'seed.dewroot', 3);
  mutateItem(state.player, 'herb.mossling', 2);
  mutateItem(state.player, 'pill.ward-basic', 1);

  const crops: Array<{ x: number; y: number; seedId: string; growth: number; stage: 'sprout' | 'growing' | 'mature'; watered?: boolean; qi?: boolean }> = [
    { x: 5, y: 4, seedId: 'seed.mossling', growth: 100_000, stage: 'mature', watered: true, qi: true },
    { x: 6, y: 4, seedId: 'seed.dewroot', growth: 62_000, stage: 'growing', watered: true },
    { x: 7, y: 4, seedId: 'seed.mossling', growth: 34_000, stage: 'sprout' },
    { x: 8, y: 4, seedId: 'seed.dewroot', growth: 86_000, stage: 'growing', watered: true, qi: true },
    { x: 9, y: 4, seedId: 'seed.mossling', growth: 100_000, stage: 'mature', watered: true },
    { x: 6, y: 5, seedId: 'seed.mossling', growth: 48_000, stage: 'growing', watered: true },
    { x: 7, y: 5, seedId: 'seed.dewroot', growth: 18_000, stage: 'sprout' }
  ];

  for (const entry of crops) {
    const tile = tileAt(state, entry.x, entry.y);
    if (!tile) throw new Error(`missing showcase tile ${entry.x},${entry.y}`);
    tile.blockType = 'none';
    tile.soilType = entry.qi ? 'spirit-loam' : 'loam';
    tile.tilled = true;
    tile.wateredToday = entry.watered ?? false;
    tile.channeledToday = entry.qi ?? false;
    tile.moisture = entry.watered ? 80_000 : 28_000;
    tile.qiDensity = entry.qi ? 70_000 : 22_000;
    applyAction(state, { kind: 'sow', at: { x: entry.x, y: entry.y }, seedId: entry.seedId }, ctx);
    const crop = state.crops.get(tile.id);
    if (!crop) throw new Error(`missing showcase crop ${entry.x},${entry.y}`);
    crop.growth = entry.growth;
    crop.stage = entry.stage;
    crop.health = 96_000;
  }

  expect(placeArray(state, 'array.insulation', 7, 5, ctx, { free: true }).placed).toBe(true);
  const dryingTile = tileAt(state, 8, 5);
  if (!dryingTile) throw new Error('missing showcase drying rack tile');
  dryingTile.blockType = 'none';
  dryingTile.tilled = false;
  dryingTile.cropId = null;
  expect(placeFacility(state, 'drying-rack', 8, 5, { free: true }).ok).toBe(true);
  state.shippingBin['herb.mossling'] = 2;

  const patrolTile = tileAt(state, 6, 5);
  if (!patrolTile) throw new Error('missing showcase guard beast patrol tile');
  state.guardBeasts.push({ id: 9001, vigor: 6, maxVigor: 6, bond: 68, specialty: 'field-ward' });
  state.guardBeastPatrols.push({ beastId: 9001, tileId: patrolTile.id, assignedDay: state.day });

  return JSON.stringify(saveGame(state, reg.schemaHash));
}

/** 把展示存档写入 localStorage，供 openGame 继续旅程时载入。需在 page.goto 之前调用。 */
export async function installShowcaseSave(page: Page): Promise<void> {
  const payload = buildShowcaseSave();
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: payload }
  );
}
