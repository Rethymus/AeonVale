import { expect, test, type Page } from '@playwright/test';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { saveGame } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';
import { continueToLoadedWorld, continueToWorld, openGameWithLoadedSave, waitForInitialSurface } from './openGame';

const SAVE_KEY = 'aeonvale-save-v1';
const LOGICAL_CANVAS = { width: 960, height: 540 } as const;

async function openGame(page: Page): Promise<void> {
  // 夹具存档生效（不清档）+ 旧快捷键启用，二者都是本文件用例的书写前提。
  await openGameWithLoadedSave(page, { legacyShortcuts: true });
}

interface SaveSnapshot {
  gameVersion?: string;
  formatVersion?: number;
  state?: {
    day?: number;
    postAscension?: {
      mode?: string;
      ascensionDay?: number | null;
      victoryRecorded?: boolean;
    };
    gameOver?: boolean;
    ending?: string | null;
    facilities?: Array<[number, { kind: string; job?: { inputItemId: string; outputItemId: string; outputCount: number; daysRemaining: number } | null }]>;
    flags?: string[];
    tiles?: Array<{
      x: number;
      y: number;
      tilled: boolean;
      cropId: number | null;
      wateredToday: boolean;
      channeledToday: boolean;
      blockType: string;
      soilType: string;
    }>;
    storage?: {
      inventory?: Record<string, { count: number }>;
    };
    shippingBin?: Record<string, number>;
    player?: {
      position?: { x: number; y: number };
      facing?: string;
      stamina?: number;
      flags?: string[];
      inventory?: Record<string, { count: number }>;
    };
  };
}

interface AeonDebugSnapshot {
  dialogueBeatId?: string | null;
  locationSelectionActive?: boolean;
  selectedLocationId?: string | null;
  selectedLocationServiceCommand?: string | null;
  interactionPanelKind?: string;
  postAscensionMode?: string;
  paused?: boolean;
  inventoryVisible?: boolean;
  cultivationPanelVisible?: boolean;
}

async function pressShiftTab(page: Page): Promise<void> {
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
}

async function pressShiftDigit(page: Page, digit: string): Promise<void> {
  await page.keyboard.down('Shift');
  await page.keyboard.press(`Digit${digit}`);
  await page.keyboard.up('Shift');
}

async function waitForDebugState(page: Page, expected: Partial<AeonDebugSnapshot>): Promise<void> {
  try {
    await page.waitForFunction(
      target => {
        const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {};
        return Object.entries(target).every(([key, value]) => debug[key as keyof AeonDebugSnapshot] === value);
      },
      expected,
      { timeout: 5_000 }
    );
  } catch (error) {
    const actual = await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
    throw new Error(`Timed out waiting for debug state ${JSON.stringify(expected)}; actual ${JSON.stringify(actual)}`, { cause: error });
  }
}

async function clickCanvasLogical(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.click({
    position: {
      x: (x / LOGICAL_CANVAS.width) * box!.width,
      y: (y / LOGICAL_CANVAS.height) * box!.height
    }
  });
}

async function clearBlockingDialogue(page: Page): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    const beatId = await page.evaluate(() => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null } }).__AEON_DEBUG__;
      return debug?.dialogueBeatId ?? null;
    });
    if (beatId == null) return;
    await page.keyboard.press('Enter');
    await page.waitForFunction(previousBeatId => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null } }).__AEON_DEBUG__;
      return (debug?.dialogueBeatId ?? null) !== previousBeatId;
    }, beatId);
  }
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null } }).__AEON_DEBUG__;
    return debug?.dialogueBeatId == null;
  });
}

async function openLocationSelection(page: Page): Promise<void> {
  await page.waitForTimeout(60);
  await clearBlockingDialogue(page);
  await pressShiftTab(page);
  await waitForDebugState(page, { locationSelectionActive: true });
}

async function preselectLocationService(page: Page, locationDigit: string, locationId: string, serviceDigit: string, serviceCommand: string): Promise<void> {
  await pressShiftDigit(page, locationDigit);
  await waitForDebugState(page, { selectedLocationId: locationId });
  await page.keyboard.press(serviceDigit);
  await waitForDebugState(page, { selectedLocationServiceCommand: serviceCommand });
}

async function preselectMarketShop(page: Page): Promise<void> {
  await clearBlockingDialogue(page);
  await page.keyboard.press(',');
  await waitForDebugState(page, {
    locationSelectionActive: true,
    selectedLocationId: 'valley-market',
    selectedLocationServiceCommand: 'browse-shop'
  });
}

async function confirmSelectedService(page: Page, expectedPanelKind?: string): Promise<void> {
  await page.keyboard.press('Enter');
  if (expectedPanelKind) {
    await waitForDebugState(page, { interactionPanelKind: expectedPanelKind });
  }
}

async function clearIntroDialogue(page: Page): Promise<void> {
  for (const beatId of ['awaken', 'spirit-test', 'intro']) {
    const flag = `narr-${beatId}`;
    const alreadyCleared = await page.evaluate(
      ({ key, expectedFlag }: { key: string; expectedFlag: string }) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { state?: { player?: { flags?: string[] } } };
        return parsed.state?.player?.flags?.includes(expectedFlag) ?? false;
      },
      { key: SAVE_KEY, expectedFlag: flag }
    );
    if (alreadyCleared) continue;

    await page.waitForFunction(id => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null } }).__AEON_DEBUG__;
      return debug?.dialogueBeatId === id;
    }, beatId);
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      ({ key, flag }: { key: string; flag: string }) => {
        const raw = window.localStorage.getItem(key);
        if (!raw) return false;
        const parsed = JSON.parse(raw) as { state?: { player?: { flags?: string[] } } };
        return parsed.state?.player?.flags?.includes(flag) ?? false;
      },
      { key: SAVE_KEY, flag }
    );
  }
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null } }).__AEON_DEBUG__;
    return debug?.dialogueBeatId == null || !['awaken', 'spirit-test', 'intro'].includes(debug.dialogueBeatId);
  });
}

async function clearNarrativeBeat(page: Page, beatId: string): Promise<void> {
  const flag = `narr-${beatId}`;
  for (let i = 0; i < 8; i += 1) {
    const save = await readSave(page);
    const flags = save.state?.player?.flags ?? [];
    const activeBeatId = await page.evaluate(() => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null } }).__AEON_DEBUG__;
      return debug?.dialogueBeatId ?? null;
    });
    if (flags.includes(flag) && activeBeatId == null) break;
    if (activeBeatId == null) {
      await page.waitForTimeout(40);
      continue;
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(40);
  }
}

async function clearCommissionDialogue(page: Page): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    const save = await readSave(page);
    const flags = save.state?.flags ?? [];
    const debug = await page.evaluate(() => {
      const snapshot = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null; interactionPanelKind?: string } }).__AEON_DEBUG__;
      return {
        dialogueBeatId: snapshot?.dialogueBeatId ?? null,
        interactionPanelKind: snapshot?.interactionPanelKind ?? 'none'
      };
    });
    if (flags.includes('commission.6.commission.human-ward-patrol') && debug.dialogueBeatId == null && debug.interactionPanelKind !== 'commission') break;
    if (flags.includes('commission.6.commission.human-ward-patrol') && debug.dialogueBeatId == null && debug.interactionPanelKind === 'commission') {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(40);
      continue;
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(40);
  }
}

type SaveFixtureMode = 'build-panel' | 'furnace-build-panel' | 'sealing-processing-panel' | 'furnace-processing-panel' | 'festival-panel' | 'shop-panel' | 'shop-panel-stable' | 'shop-panel-trade' | 'storage-panel' | 'shipping-panel' | 'facility-collect-panel' | 'hotbar-primary' | 'end-day-ready' | 'exploration-panel' | 'first-restock-ready' | 'second-sow-raw-front' | 'ascension-choice' | 'ascension-pill' | 'post-ascension-commission' | 'post-ascension-tea-shed' | 'post-ascension-greenhouse' | 'post-ascension-quick-access' | 'post-ascension-greenhouse-upgrade';

function buildSavePayload(mode: SaveFixtureMode): string {
  const reg = buildRegistry();
  const state = createWorld({ seed: 20260710, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
  const markIntroCleared = (): void => {
    state.player.flags.add('narr-awaken');
    state.player.flags.add('narr-spirit-test');
    state.player.flags.add('narr-intro');
  };
  const markStageNarrativeCleared = (): void => {
    state.player.flags.add('narr-shennong-art-truth');
    // first-till 由「存在已翻土瓦片」触发：stage≥5 夹具的翻土瓦片会让它在快照间突现。
    state.player.flags.add('narr-first-till');
    state.player.flags.add('narr-stage-3');
    state.player.flags.add('narr-stage-5');
    // shennong-reveal（stage≥5 触发）与 stage 系列同批内容更新加入，须一并标记已读。
    state.player.flags.add('narr-shennong-reveal');
    state.player.flags.add('narr-stage-7');
  };

  markIntroCleared();

  if (mode === 'build-panel') {
    mutateItem(state.player, 'item.spirit-stone', 3);
    mutateItem(state.player, 'herb.mossling', 2);
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
  } else if (mode === 'furnace-build-panel') {
    state.flags.add('upgrade.farmstead-expansion-1');
    state.flags.add('upgrade.farmstead-expansion-2');
    mutateItem(state.player, 'item.spirit-stone', 10);
    mutateItem(state.player, 'item.broken-talisman', 2);
    mutateItem(state.player, 'item.dried-herb', 1);
    state.player.position = { x: 7, y: 1 };
    state.player.facing = 'down';
  } else if (mode === 'sealing-processing-panel') {
    const tile = state.tiles.find(entry => entry.x === 7 && entry.y === 4)!;
    tile.blockType = 'building';
    state.facilities.set(9002, {
      id: 9002,
      kind: 'sealing-cabinet',
      tileId: tile.id,
      job: null
    });
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
    mutateItem(state.player, 'item.dried-herb', 2);
    mutateItem(state.player, 'item.spirit-compost', 1);
  } else if (mode === 'furnace-processing-panel') {
    const tile = state.tiles.find(entry => entry.x === 7 && entry.y === 4)!;
    tile.blockType = 'building';
    state.facilities.set(9003, {
      id: 9003,
      kind: 'talisman-furnace',
      tileId: tile.id,
      job: null
    });
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
    mutateItem(state.player, 'item.broken-talisman', 1);
    mutateItem(state.player, 'item.spirit-stone', 2);
  } else if (mode === 'festival-panel') {
    state.activeEvent = { defId: 'event.spring-festival', displayName: '青芽会', daysLeft: 1, growthMod: 1, qiMod: 1 };
  } else if (mode === 'storage-panel') {
    state.player.flags.add('narr-first-till');
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
    const targetTile = state.tiles.find(tile => tile.x === 7 && tile.y === 4);
    if (!targetTile) throw new Error('missing storage fixture front tile');
    targetTile.tilled = false;
    targetTile.cropId = null;
    targetTile.wateredToday = false;
    targetTile.channeledToday = false;
    targetTile.blockType = 'none';
    targetTile.soilType = 'loam';
    mutateItem(state.player, 'seed.mossling', 3);
    state.storage.inventory['seed.dewroot'] = { itemId: 'seed.dewroot', count: 2 };
  } else if (mode === 'shop-panel-stable') {
    state.season = 'summer';
    state.seasonDay = 1;
    state.day = 1;
    state.player.flags.add('narr-first-till');
    state.player.flags.add('onboarding-first-shipping-settlement');
    mutateItem(state.player, 'item.spirit-stone', 3);
  } else if (mode === 'shop-panel-trade') {
    state.player.stage = 1 as 1;
    state.player.flags.add('onboarding-first-shipping-settlement');
    mutateItem(state.player, 'item.spirit-stone', 3);
  } else if (mode === 'shipping-panel') {
    mutateItem(state.player, 'seed.mossling', 2);
  } else if (mode === 'facility-collect-panel') {
    const tile = state.tiles.find(entry => entry.x === 7 && entry.y === 4)!;
    tile.blockType = 'building';
    state.facilities.set(9001, {
      id: 9001,
      kind: 'drying-rack',
      tileId: tile.id,
      job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
    });
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
  } else if (mode === 'hotbar-primary') {
    mutateItem(state.player, 'seed.mossling', 3);
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
  } else if (mode === 'end-day-ready') {
    state.player.flags.add('onboarding-first-second-water');
    state.player.flags.add('narr-first-till');
    mutateItem(state.player, 'seed.mossling', 3);
    mutateItem(state.player, 'item.spirit-stone', 3);
  } else if (mode === 'exploration-panel') {
    state.player.flags.add('onboarding-first-second-water');
    mutateItem(state.player, 'item.spirit-stone', 3);
  } else if (mode === 'first-restock-ready') {
    state.day = 1;
    state.seasonDay = 1;
    state.player.flags.add('onboarding-first-shipping-settlement');
    state.player.flags.add('narr-first-till');
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
    const targetTile = state.tiles.find(tile => tile.x === 7 && tile.y === 4);
    if (!targetTile) throw new Error('missing first restock fixture front tile');
    targetTile.tilled = true;
    targetTile.cropId = null;
    targetTile.wateredToday = false;
    targetTile.channeledToday = false;
    mutateItem(state.player, 'item.spirit-stone', 3);
  } else if (mode === 'second-sow-raw-front') {
    state.player.flags.add('onboarding-first-market-restock');
    state.player.flags.add('narr-first-till');
    state.player.position = { x: 7, y: 3 };
    state.player.facing = 'down';
    const targetTile = state.tiles.find(tile => tile.x === 7 && tile.y === 4);
    if (!targetTile) throw new Error('missing second sow fixture front tile');
    targetTile.tilled = false;
    targetTile.cropId = null;
    targetTile.wateredToday = false;
    targetTile.channeledToday = false;
    targetTile.blockType = 'none';
    targetTile.soilType = 'loam';
    mutateItem(state.player, 'seed.mossling', 1);
  } else if (mode === 'ascension-choice') {
    state.player.stage = 7 as 1;
    state.postAscension.mode = 'choice-pending';
    state.postAscension.ascensionDay = state.day;
    markStageNarrativeCleared();
  } else if (mode === 'ascension-pill') {
    state.player.stage = 7 as 1;
    mutateItem(state.player, 'pill.ascend', 1);
    markStageNarrativeCleared();
  } else if (mode === 'post-ascension-commission') {
    state.player.stage = 7 as 1;
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;
    state.day = 6;
    // This fixture isolates daily commission turn-in through the location directory.
    state.stayingWorld.resolvedIncidentDay = state.day;
    mutateItem(state.player, 'item.beast-core', 2);
    markStageNarrativeCleared();
  } else if (mode === 'post-ascension-tea-shed') {
    state.player.stage = 7 as 1;
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;
    state.season = 'winter';
    state.player.hp = 70_000;
    state.player.pillPoison = 2_000;
    markStageNarrativeCleared();
  } else if (mode === 'post-ascension-greenhouse') {
    state.player.stage = 7 as 1;
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;
    state.season = 'winter';
    state.tiles[0]!.tilled = true;
    state.tiles[0]!.fertility = 40_000;
    state.tiles[0]!.qiDensity = 25_000;
    markStageNarrativeCleared();
  } else if (mode === 'post-ascension-quick-access') {
    state.player.stage = 7 as 1;
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;
    state.day = 6;
    state.season = 'winter';
    // This fixture isolates the three quick daily services. Mark the rotating
    // staying-world incident as already handled so Alt+Q reaches the commission flow.
    state.stayingWorld.resolvedIncidentDay = state.day;
    state.player.hp = 70_000;
    state.player.pillPoison = 2_000;
    state.tiles[0]!.tilled = true;
    state.tiles[0]!.fertility = 40_000;
    state.tiles[0]!.qiDensity = 25_000;
    mutateItem(state.player, 'item.beast-core', 2);
    markStageNarrativeCleared();
  } else if (mode === 'post-ascension-greenhouse-upgrade') {
    state.player.stage = 7 as 1;
    state.postAscension.mode = 'stayed-in-world';
    state.postAscension.ascensionDay = state.day;
    state.season = 'winter';
    state.day = 2;
    state.seasonDay = 2;
    state.tiles[0]!.tilled = true;
    state.tiles[0]!.fertility = 40_000;
    state.tiles[0]!.qiDensity = 25_000;
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);
    markStageNarrativeCleared();
  } else {
    if (mode === 'shop-panel') state.player.flags.add('onboarding-first-shipping-settlement');
    mutateItem(state.player, 'item.spirit-stone', 3);
  }

  return JSON.stringify(saveGame(state, reg.schemaHash));
}

async function installSave(page: Page, mode: SaveFixtureMode) {
  const payload = buildSavePayload(mode);
  return page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      if (window.localStorage.getItem(key) == null) window.localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: payload }
  );
}

function findTile(snapshot: SaveSnapshot, x: number, y: number) {
  return snapshot.state?.tiles?.find(tile => tile.x === x && tile.y === y);
}

async function readSave(page: Page): Promise<SaveSnapshot> {
  const save = await page.evaluate(key => window.localStorage.getItem(key), SAVE_KEY);
  expect(save).not.toBeNull();
  return JSON.parse(save ?? '{}') as SaveSnapshot;
}

async function clickCanvasTile(page: Page, x: number, y: number, button: 'left' | 'right' = 'left'): Promise<void> {
  const position = await page.evaluate(
    target => {
      const testApi = (window as typeof window & { __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null } }).__AEON_TEST__;
      return testApi?.canvasPointForTile?.(target.x, target.y) ?? null;
    },
    { x, y }
  );
  expect(position).not.toBeNull();
  await page.locator('canvas').click({ button, position: position! });
}

test('legacy F5 now preselects build in farm action panel and Enter remains the real confirm path', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F5');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { facilities?: Array<unknown> } };
    return (parsed.state?.facilities?.length ?? 0) > 0;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.facilities?.length ?? 0).toBe(1);
  expect(parsed.state?.facilities?.[0]?.[1]?.kind).toBe('drying-rack');
});

test('legacy Shift+F5 now preselects talisman furnace via farm action panel and still requires Enter to advance and confirm', async ({ page }) => {
  await installSave(page, 'furnace-build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Shift+F5');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterFirstEnter = await readSave(page);
  expect(afterFirstEnter).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { facilities?: Array<[number, { kind: string }]> } };
    return parsed.state?.facilities?.some(entry => entry[1]?.kind === 'talisman-furnace') ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.facilities?.some(entry => entry[1]?.kind === 'talisman-furnace')).toBe(true);
});

test('legacy F11 now preselects sealing through farm action panel and still requires Enter to advance and confirm', async ({ page }) => {
  await installSave(page, 'sealing-processing-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F11');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterFirstEnter = await readSave(page);
  expect(afterFirstEnter).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.facilities?.[0]?.[1]?.job?.outputItemId ?? null) === 'item.sealed-herb';
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.facilities?.[0]?.[1]?.job?.outputItemId ?? null).toBe('item.sealed-herb');
});

test('legacy Shift+F11 now preselects furnace processing through farm action panel and still requires Enter to advance and confirm', async ({ page }) => {
  await installSave(page, 'furnace-processing-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Shift+F11');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterFirstEnter = await readSave(page);
  expect(afterFirstEnter).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.facilities?.[0]?.[1]?.job?.outputItemId ?? null) === 'item.array-core';
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.facilities?.[0]?.[1]?.job?.outputItemId ?? null).toBe('item.array-core');
});

test('farm action panel flow persists facility placement to save', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { facilities?: Array<unknown> } };
    return (parsed.state?.facilities?.length ?? 0) > 0;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.facilities?.length ?? 0).toBe(1);
  expect(parsed.state?.facilities?.[0]?.[1]?.kind).toBe('drying-rack');
});

test('farm action panel digit direct-select now only preselects facility collect until Enter advances and confirms pickup', async ({ page }) => {
  await installSave(page, 'facility-collect-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(40);
  await page.keyboard.press('2');
  await page.waitForTimeout(120);

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['item.dried-herb']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['item.dried-herb']?.count ?? 0).toBe(1);
  expect(parsed.state?.facilities?.[0]?.[1]?.job ?? null).toBeNull();
});

test('farm action panel digit direct-select now only preselects storage deposit until Enter advances and confirms move', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(40);
  await page.keyboard.press('3');
  await page.waitForTimeout(120);

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(2);
});

test('festival panel key flow persists participation result to save', async ({ page }) => {
  await installSave(page, 'festival-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('End');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { flags?: string[] } };
    return parsed.state?.flags?.some(flag => flag.includes('festival-participated:event.spring-festival')) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.some(flag => flag.includes('festival-participated:event.spring-festival'))).toBe(true);
});

test('location service flow opens market shop and persists purchase', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await preselectMarketShop(page);
  await confirmSelectedService(page, 'shop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThanOrEqual(1);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(2);
});

test('Shift+digit and digit now only preselect location and service before Enter confirms the flow', async ({ page }) => {
  await installSave(page, 'shop-panel-stable');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await preselectMarketShop(page);

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await confirmSelectedService(page, 'shop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThanOrEqual(1);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(2);
});

test('legacy comma key now preselects market shop via location services and Enter completes purchase', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await preselectMarketShop(page);
  await confirmSelectedService(page, 'shop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThanOrEqual(1);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(2);
});

test('legacy npc gift key now preselects npc action first, then Enter advances into panel before applying gift', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeSpiritStones = before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0;
  const beforeStamina = before.state?.player?.stamina ?? 0;

  await page.keyboard.press('\\');
  await page.waitForTimeout(120);

  const afterPreselect = await readSave(page);
  expect(afterPreselect.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(beforeSpiritStones);
  expect(afterPreselect.state?.player?.stamina ?? 0).toBe(beforeStamina);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterFirstEnter = await readSave(page);
  expect(afterFirstEnter.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(beforeSpiritStones);
  expect(afterFirstEnter.state?.player?.stamina ?? 0).toBe(beforeStamina);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterSecondEnter = await readSave(page);
  expect(afterSecondEnter.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).not.toBe(beforeSpiritStones);
});

test('npc action panel supports digit direct-select before Enter confirms the selected social action', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeSpiritStones = before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0;
  const beforeStamina = before.state?.player?.stamina ?? 0;

  await page.keyboard.press('-');
  await page.waitForTimeout(120);

  const afterPreselect = await readSave(page);
  expect(afterPreselect.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(beforeSpiritStones);
  expect(afterPreselect.state?.player?.stamina ?? 0).toBe(beforeStamina);

  await page.keyboard.press('2');
  await page.waitForTimeout(120);

  const afterDigitSelect = await readSave(page);
  expect(afterDigitSelect.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(beforeSpiritStones);
  expect(afterDigitSelect.state?.player?.stamina ?? 0).toBe(beforeStamina);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterConfirm = await readSave(page);
  expect(afterConfirm.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBeLessThan(beforeSpiritStones);
});

test('npc browse panel no longer chains Enter into gift confirmation', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeSpiritStones = before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0;
  const beforeStamina = before.state?.player?.stamina ?? 0;

  await page.keyboard.press('-');
  await page.waitForTimeout(120);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterOpenBrowse = await readSave(page);
  expect(afterOpenBrowse.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(beforeSpiritStones);
  expect(afterOpenBrowse.state?.player?.stamina ?? 0).toBe(beforeStamina);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterBrowseConfirm = await readSave(page);
  expect(afterBrowseConfirm.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(beforeSpiritStones);
  expect(afterBrowseConfirm.state?.player?.stamina ?? 0).toBe(beforeStamina);
});

test('legacy Ctrl+Enter still executes the currently selected market shop service', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press(',');
  await page.waitForTimeout(40);
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(40);
  await page.keyboard.press('Control+Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThanOrEqual(1);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(2);
});

test('legacy period key confirms the currently selected market shop service and purchase', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press(',');
  await page.waitForTimeout(40);
  await page.keyboard.press('.');
  await page.waitForTimeout(40);
  await page.keyboard.press('.');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThanOrEqual(1);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(2);
});

test('legacy period key no longer opens market shop on its own without a selected service', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('.');
  await page.waitForTimeout(40);
  await page.keyboard.press('.');
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('legacy Ctrl+Enter no longer opens market shop on its own without a selected service', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(40);
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(before.state?.player?.inventory?.['seed.mossling']?.count ?? 0);
  expect(after.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0);
});

test('legacy O key now preselects market trade via location services and period confirms trade', async ({ page }) => {
  await installSave(page, 'shop-panel-trade');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeSpiritStones = before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0;
  const beforeFrostmarrowSeeds = before.state?.player?.inventory?.['seed.frostmarrow']?.count ?? 0;

  await page.keyboard.press('O');
  await waitForDebugState(page, {
    locationSelectionActive: true,
    selectedLocationId: 'valley-market',
    selectedLocationServiceCommand: 'browse-trade'
  });
  await page.keyboard.press('.');
  await waitForDebugState(page, { interactionPanelKind: 'trade' });
  await page.keyboard.press('Tab');
  await page.waitForTimeout(40);
  await page.keyboard.press('.');
  await page.waitForFunction(
    ({ key, previousSpiritStones, previousFrostmarrowSeeds }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0) < previousSpiritStones && (parsed.state?.player?.inventory?.['seed.frostmarrow']?.count ?? 0) > previousFrostmarrowSeeds;
    },
    { key: SAVE_KEY, previousSpiritStones: beforeSpiritStones, previousFrostmarrowSeeds: beforeFrostmarrowSeeds }
  );

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBeLessThan(beforeSpiritStones);
  expect(parsed.state?.player?.inventory?.['seed.frostmarrow']?.count ?? 0).toBeGreaterThan(beforeFrostmarrowSeeds);
});

test('legacy semicolon key opens a location action panel before confirming valley exploration', async ({ page }) => {
  await installSave(page, 'exploration-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await clearBlockingDialogue(page);
  await page.keyboard.press(';');
  await waitForDebugState(page, {
    locationSelectionActive: true,
    selectedLocationId: 'valley-outskirts',
    selectedLocationServiceCommand: 'explore-valley'
  });

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await page.keyboard.press('Enter');
  await waitForDebugState(page, { locationSelectionActive: false, interactionPanelKind: 'location-action' });

  const afterPanelOpen = await readSave(page);
  expect(afterPanelOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousStamina }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.player?.stamina ?? 0) < previousStamina;
    },
    { key: SAVE_KEY, previousStamina: before.state?.player?.stamina ?? 0 }
  );

  const parsed = await readSave(page);
  expect(parsed.state?.player?.stamina ?? 0).toBeLessThan(before.state?.player?.stamina ?? 0);
});

test('legacy L key opens a location action panel before confirming ruin exploration', async ({ page }) => {
  await installSave(page, 'exploration-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await clearBlockingDialogue(page);
  await page.keyboard.press('l');
  await waitForDebugState(page, {
    locationSelectionActive: true,
    selectedLocationId: 'ruin-gate',
    selectedLocationServiceCommand: 'explore-ruin'
  });

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await page.keyboard.press('Enter');
  await waitForDebugState(page, { locationSelectionActive: false, interactionPanelKind: 'location-action' });

  const afterPanelOpen = await readSave(page);
  expect(afterPanelOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousStamina }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.player?.stamina ?? 0) < previousStamina;
    },
    { key: SAVE_KEY, previousStamina: before.state?.player?.stamina ?? 0 }
  );

  const parsed = await readSave(page);
  expect(parsed.state?.player?.stamina ?? 0).toBeLessThan(before.state?.player?.stamina ?? 0);
});

test('Escape closes location selection without mutating save', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await openLocationSelection(page);
  await page.keyboard.press('Escape');
  await waitForDebugState(page, { locationSelectionActive: false });

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('left click only confirms location and interaction panels from their visible preview area', async ({ page }) => {
  await installSave(page, 'shop-panel-stable');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await preselectMarketShop(page);

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await clickCanvasLogical(page, 96, 96);
  await page.waitForTimeout(120);
  await waitForDebugState(page, { locationSelectionActive: true, interactionPanelKind: 'none' });
  expect(await readSave(page)).toEqual(before);

  await clickCanvasLogical(page, 800, 168);
  await waitForDebugState(page, { interactionPanelKind: 'shop' });
  const beforePurchase = await readSave(page);
  expect(beforePurchase).toEqual(before);

  await clickCanvasLogical(page, 96, 96);
  await page.waitForTimeout(120);
  await waitForDebugState(page, { interactionPanelKind: 'shop' });
  expect(await readSave(page)).toEqual(beforePurchase);

  await clickCanvasLogical(page, 800, 348);
  await page.waitForFunction(
    ({ key, previousCount }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) > previousCount;
    },
    { key: SAVE_KEY, previousCount: before.state?.player?.inventory?.['seed.mossling']?.count ?? 0 }
  );

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThan(before.state?.player?.inventory?.['seed.mossling']?.count ?? 0);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBeLessThan(before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0);
});

test('right click closes location selection without mutating save', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await openLocationSelection(page);
  await page.locator('canvas').click({ button: 'right' });
  await waitForDebugState(page, { locationSelectionActive: false });

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('right click closes location selection before any secondary world tool can fire', async ({ page }) => {
  await installSave(page, 'shop-panel-stable');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('2');
  await page.waitForTimeout(40);
  await openLocationSelection(page);

  const before = await readSave(page);
  expect(findTile(before, 7, 4)?.wateredToday).toBe(false);

  await page.locator('canvas').click({ button: 'right' });
  await waitForDebugState(page, { locationSelectionActive: false });

  const after = await readSave(page);
  expect(findTile(after, 7, 4)?.wateredToday).toBe(false);

  const debug = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __AEON_DEBUG__?: { locationSelectionActive?: boolean };
        }
      ).__AEON_DEBUG__
  );
  expect(debug?.locationSelectionActive).toBe(false);
});

test('B toggles inventory while Shift+Tab remains the location-service entry key', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('b');
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: { inventoryVisible?: boolean } }).__AEON_DEBUG__?.inventoryVisible === true);
  await page.keyboard.press('b');
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: { inventoryVisible?: boolean } }).__AEON_DEBUG__?.inventoryVisible === false);

  const afterInventoryToggle = await readSave(page);
  expect(afterInventoryToggle).toEqual(before);

  await preselectMarketShop(page);
  await confirmSelectedService(page, 'shop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThanOrEqual(1);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(2);
});

test('first restock purchase closes the shop and advances onboarding to the second sow objective', async ({ page }) => {
  await installSave(page, 'first-restock-ready');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeSeedCount = before.state?.player?.inventory?.['seed.mossling']?.count ?? 0;
  const beforeSpiritStones = before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0;

  await preselectMarketShop(page);
  await confirmSelectedService(page, 'shop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousSeedCount, previousSpiritStones }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) > previousSeedCount && (parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0) < previousSpiritStones;
    },
    { key: SAVE_KEY, previousSeedCount: beforeSeedCount, previousSpiritStones: beforeSpiritStones }
  );

  const debug = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __AEON_DEBUG__?: { hotbarIdx?: number; locationSelectionActive?: boolean; locationIdx?: number; locationServiceIdx?: number; interactionPanelKind?: string };
        }
      ).__AEON_DEBUG__
  );
  expect(debug?.interactionPanelKind).toBe('none');
  expect(debug?.locationSelectionActive).toBe(false);
  expect(debug?.hotbarIdx).toBe(4);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThan(beforeSeedCount);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBeLessThan(beforeSpiritStones);
  expect(parsed.state?.player?.flags ?? []).toContain('onboarding-first-market-restock');
  expect(parsed.state?.player?.flags ?? []).not.toContain('onboarding-first-second-sow');
  expect(parsed.state?.player?.flags ?? []).toContain('onboarding-first-shipping-settlement');

  const objective = await page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    const flags = new Set(parsed.state?.player?.flags ?? []);
    if (flags.has('onboarding-first-second-water')) return 'first-loop-complete';
    if (flags.has('onboarding-first-second-sow')) return 'first-second-water';
    if (flags.has('onboarding-first-market-restock')) return 'first-second-sow';
    if (flags.has('onboarding-first-shipping-settlement')) return 'first-market-restock';
    return null;
  }, SAVE_KEY);
  expect(objective).toBe('first-second-sow');
});

test('after the first restock purchase, the journey action immediately sows the second loop crop on the front tile', async ({ page }) => {
  await installSave(page, 'first-restock-ready');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);

  const before = await readSave(page);
  const beforeSeedCount = before.state?.player?.inventory?.['seed.mossling']?.count ?? 0;

  await preselectMarketShop(page);
  await confirmSelectedService(page, 'shop');
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousSeedCount }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) > previousSeedCount;
    },
    { key: SAVE_KEY, previousSeedCount: beforeSeedCount }
  );

  const journey = page.locator('#world-journey-action');
  await journey.click();
  await page.waitForFunction(
    ({ key, previousSeedCount }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      const targetTile = parsed.state?.tiles?.find(tile => tile.x === 7 && tile.y === 4);
      const flags = parsed.state?.player?.flags ?? [];
      return targetTile?.cropId != null && (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) === previousSeedCount && flags.includes('onboarding-first-second-sow');
    },
    { key: SAVE_KEY, previousSeedCount: beforeSeedCount }
  );

  const debug = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __AEON_DEBUG__?: { hotbarIdx?: number; interactionPanelKind?: string; locationSelectionActive?: boolean };
        }
      ).__AEON_DEBUG__
  );
  expect(debug?.hotbarIdx).toBe(1);
  expect(debug?.interactionPanelKind).toBe('none');
  expect(debug?.locationSelectionActive).toBe(false);

  const after = await readSave(page);
  const frontTile = findTile(after, 7, 4);
  expect(frontTile?.tilled).toBe(true);
  expect(frontTile?.cropId).not.toBeNull();
  expect(after.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(beforeSeedCount);
  expect(after.state?.player?.flags ?? []).toContain('onboarding-first-second-sow');
  expect(after.state?.player?.flags ?? []).not.toContain('onboarding-first-second-water');

  const objectiveAfterSow = await page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    const flags = new Set(parsed.state?.player?.flags ?? []);
    if (flags.has('onboarding-first-second-water')) return 'first-loop-complete';
    if (flags.has('onboarding-first-second-sow')) return 'first-second-water';
    if (flags.has('onboarding-first-market-restock')) return 'first-second-sow';
    return null;
  }, SAVE_KEY);
  expect(objectiveAfterSow).toBe('first-second-water');

  await journey.click();
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    const targetTile = parsed.state?.tiles?.find(tile => tile.x === 7 && tile.y === 4);
    return targetTile?.wateredToday === true;
  }, SAVE_KEY);

  const watered = await readSave(page);
  expect(findTile(watered, 7, 4)?.wateredToday).toBe(true);
  expect(watered.state?.player?.flags ?? []).not.toContain('onboarding-first-second-water');
});

test('during the second sow onboarding step, the journey action auto-tills before sowing when the target tile is still raw', async ({ page }) => {
  await installSave(page, 'second-sow-raw-front');
  await openGameWithLoadedSave(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);

  const journey = page.locator('#world-journey-action');
  await journey.click();
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    const targetTile = parsed.state?.tiles?.find(tile => tile.x === 7 && tile.y === 4);
    const flags = parsed.state?.player?.flags ?? [];
    return targetTile?.tilled === true && targetTile?.cropId != null && flags.includes('onboarding-first-second-sow');
  }, SAVE_KEY);

  const debug = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __AEON_DEBUG__?: { hotbarIdx?: number };
        }
      ).__AEON_DEBUG__
  );
  expect(debug?.hotbarIdx).toBe(1);

  const afterSow = await readSave(page);
  const frontTile = findTile(afterSow, 7, 4);
  expect(frontTile?.tilled).toBe(true);
  expect(frontTile?.cropId).not.toBeNull();

  await journey.click();
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.wateredToday) ?? false;
  }, SAVE_KEY);

  const watered = await readSave(page);
  expect(findTile(watered, 7, 4)?.wateredToday).toBe(true);
});

test('Enter does not advance the day while location selection is open and only works after the directory is dismissed', async ({ page }) => {
  await installSave(page, 'end-day-ready');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeDay = before.state?.day ?? 0;

  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const whileLocationSelectionOpen = await readSave(page);
  expect(whileLocationSelectionOpen.state?.day ?? 0).toBe(beforeDay);
  expect(whileLocationSelectionOpen.state?.player?.flags).toEqual(before.state?.player?.flags);

  await clearBlockingDialogue(page);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousDay }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.day ?? 0) > previousDay;
    },
    { key: SAVE_KEY, previousDay: beforeDay }
  );

  const afterEndDay = await readSave(page);
  expect(afterEndDay.state?.day ?? 0).toBeGreaterThan(beforeDay);
});

test('Escape closes interaction panel without confirming action or mutating save', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F5');
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('right click closes interaction panel without confirming action or mutating save', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F5');
  await page.waitForTimeout(40);
  await page.locator('canvas').click({ button: 'right' });
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('right click closes interaction panels before any secondary world tool can fire', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);
  await clearNarrativeBeat(page, 'first-till');

  await page.keyboard.press('5');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.cropId != null) ?? false;
  }, SAVE_KEY);

  await page.keyboard.press('2');
  await page.waitForTimeout(40);
  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(60);

  const before = await readSave(page);
  expect(findTile(before, 7, 4)?.wateredToday).toBe(false);

  await page.locator('canvas').click({ button: 'right' });
  await page.waitForTimeout(80);

  const after = await readSave(page);
  expect(findTile(after, 7, 4)?.wateredToday).toBe(false);

  const debug = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __AEON_DEBUG__?: { interactionPanelKind?: string };
        }
      ).__AEON_DEBUG__
  );
  expect(debug?.interactionPanelKind).toBe('none');
});

test('interaction panels dismiss same-key world actions instead of letting them leak through on the same press', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);
  await clearNarrativeBeat(page, 'first-till');

  await page.keyboard.press('5');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.cropId != null) ?? false;
  }, SAVE_KEY);

  await page.keyboard.press('2');
  await page.waitForTimeout(40);
  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(60);

  const before = await readSave(page);
  expect(findTile(before, 7, 4)?.wateredToday).toBe(false);

  await page.keyboard.press('x');
  await page.waitForTimeout(80);

  const afterDismiss = await readSave(page);
  expect(findTile(afterDismiss, 7, 4)?.wateredToday).toBe(false);
  const debugAfterDismiss = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __AEON_DEBUG__?: { interactionPanelKind?: string };
        }
      ).__AEON_DEBUG__
  );
  expect(debugAfterDismiss?.interactionPanelKind).toBe('none');

  await page.keyboard.press('x');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.wateredToday) ?? false;
  }, SAVE_KEY);

  const afterWater = await readSave(page);
  expect(findTile(afterWater, 7, 4)?.wateredToday).toBe(true);
});

test('legacy PageDown no longer confirms build panel and Enter remains the real confirm key', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F5');
  await page.waitForTimeout(40);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(120);

  const afterPageDown = await readSave(page);
  expect(afterPageDown).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { facilities?: Array<unknown> } };
    return (parsed.state?.facilities?.length ?? 0) > 0;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.facilities?.length ?? 0).toBe(1);
  expect(parsed.state?.facilities?.[0]?.[1]?.kind).toBe('drying-rack');
});

test('legacy F7 now only preselects drying in farm action panel until Enter advances the flow', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F7');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);
});

test('legacy F8 now only preselects drying in farm action panel until Enter advances the flow', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F8');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);
});

test('legacy Insert now only preselects quality shipping in farm action panel until Enter advances the flow', async ({ page }) => {
  await installSave(page, 'shipping-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Insert');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);
});

test('legacy Delete now only preselects quality shipping in farm action panel until Enter advances the flow', async ({ page }) => {
  await installSave(page, 'shipping-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Delete');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);
});

test('Escape closes inventory after B opens it without mutating save', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('b');
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('Enter does not advance the day while inventory is open and the rest button works after the overlay is closed', async ({ page }) => {
  await installSave(page, 'end-day-ready');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeDay = before.state?.day ?? 0;

  await page.keyboard.press('b');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const whileInventoryOpen = await readSave(page);
  expect(whileInventoryOpen.state?.day ?? 0).toBe(beforeDay);
  expect(whileInventoryOpen).toEqual(before);

  if (await page.locator('[data-app-surface="inventory"]').isVisible()) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(40);
  }
  await page.locator('#world-command-bar [data-game-command="end-day"]').click();
  await page.waitForFunction(
    ({ key, previousDay }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.day ?? 0) > previousDay;
    },
    { key: SAVE_KEY, previousDay: beforeDay }
  );

  const afterEndDay = await readSave(page);
  expect(afterEndDay.state?.day ?? 0).toBeGreaterThan(beforeDay);
});

test('the inventory close button closes the overlay without mutating save', async ({ page }) => {
  await installSave(page, 'shop-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('b');
  await page.waitForTimeout(40);
  await page.locator('#flow-inventory-close').click();
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('inventory overlay blocks keyboard farm actions until it is closed and the visible journey action resumes play', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);

  const before = await readSave(page);
  expect(findTile(before, 7, 4)?.tilled).toBe(false);
  expect(before.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(3);

  await page.keyboard.press('b');
  await page.waitForTimeout(40);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press(' ');
  await page.waitForTimeout(80);

  const blocked = await readSave(page);
  expect(findTile(blocked, 7, 4)?.tilled).toBe(false);
  expect(blocked.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(3);

  const stillInInventory = await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: { inventoryVisible?: boolean } }).__AEON_DEBUG__?.inventoryVisible === true);
  if (stillInInventory) {
    await page.keyboard.press('b');
    await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: { inventoryVisible?: boolean } }).__AEON_DEBUG__?.inventoryVisible === false);
  }
  await page.locator('#world-journey-action').click();
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const afterClose = await readSave(page);
  expect(findTile(afterClose, 7, 4)?.tilled).toBe(true);
  expect(afterClose.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(3);
});

test('P pauses input and Escape resumes without mutating save until play continues', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('P');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);

  const stillPaused = await readSave(page);
  expect(stillPaused).toEqual(before);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const afterResume = await readSave(page);
  expect(findTile(afterResume, 7, 4)?.tilled).toBe(true);
});

test('Enter does not advance the day while paused and only works again after play resumes', async ({ page }) => {
  await installSave(page, 'end-day-ready');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeDay = before.state?.day ?? 0;

  await page.keyboard.press('P');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const whilePaused = await readSave(page);
  expect(whilePaused.state?.day ?? 0).toBe(beforeDay);
  expect(whilePaused).toEqual(before);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousDay }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.day ?? 0) > previousDay;
    },
    { key: SAVE_KEY, previousDay: beforeDay }
  );

  const afterEndDay = await readSave(page);
  expect(afterEndDay.state?.day ?? 0).toBeGreaterThan(beforeDay);
});

test('Escape toggles scene pause only after dismissible surfaces are closed', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);

  const stillPaused = await readSave(page);
  expect(stillPaused).toEqual(before);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  const afterInventoryDismiss = await readSave(page);
  expect(afterInventoryDismiss).toEqual(before);
});

test('C opens cultivation overview and Escape closes it without mutating save', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('C');
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('Enter does not advance the day while cultivation overview is open and only works after the overlay is closed', async ({ page }) => {
  await installSave(page, 'end-day-ready');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeDay = before.state?.day ?? 0;

  await page.keyboard.press('C');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const whileCultivationOpen = await readSave(page);
  expect(whileCultivationOpen.state?.day ?? 0).toBe(beforeDay);
  expect(whileCultivationOpen).toEqual(before);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousDay }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.day ?? 0) > previousDay;
    },
    { key: SAVE_KEY, previousDay: beforeDay }
  );

  const afterEndDay = await readSave(page);
  expect(afterEndDay.state?.day ?? 0).toBeGreaterThan(beforeDay);
});

test('cultivation overview blocks left-click world confirm until it is dismissed', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);

  const before = await readSave(page);
  expect(findTile(before, 7, 4)?.tilled).toBe(false);

  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('C');
  await page.waitForTimeout(40);
  await clickCanvasTile(page, 7, 4);
  await page.waitForTimeout(80);

  const blocked = await readSave(page);
  expect(findTile(blocked, 7, 4)?.tilled).toBe(false);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await clickCanvasTile(page, 7, 4);
  await page.waitForTimeout(80);

  const afterClose = await readSave(page);
  expect(findTile(afterClose, 7, 4)?.tilled).toBe(true);
});

test('right click uses the current watering tool on the front tile before falling back to cancel semantics', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);
  await clearNarrativeBeat(page, 'first-till');

  await page.keyboard.press('5');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.cropId != null) ?? false;
  }, SAVE_KEY);

  await page.keyboard.press('2');
  await page.waitForTimeout(40);
  await page.locator('canvas').click({ button: 'right' });
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.wateredToday) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(findTile(parsed, 7, 4)?.wateredToday).toBe(true);
});

test('right click still pauses the scene when no dismissible UI or secondary farm tool is active', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);

  await page.locator('canvas').click({ button: 'right' });
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);

  const stillPaused = await readSave(page);
  expect(findTile(stillPaused, 7, 4)?.tilled).toBe(false);

  await page.locator('canvas').click({ button: 'right' });
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(findTile(parsed, 7, 4)?.tilled).toBe(true);
});

test('mouse wheel does not cycle the hotbar while paused and resumes from the same slot after unpausing', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.locator('canvas').hover();
  await page.keyboard.press('P');
  await page.waitForTimeout(40);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(findTile(parsed, 7, 4)?.tilled).toBe(true);
  expect(findTile(parsed, 7, 4)?.wateredToday).toBe(false);
});

test('mouse wheel does not cycle the hotbar while inventory is open and resumes from the same slot after closing it', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.locator('canvas').hover();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(40);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(findTile(parsed, 7, 4)?.tilled).toBe(true);
  expect(findTile(parsed, 7, 4)?.wateredToday).toBe(false);
});

test('mouse wheel does not cycle the hotbar while cultivation overview is open and resumes from the same slot after closing it', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.locator('canvas').hover();
  await page.keyboard.press('C');
  await page.waitForTimeout(40);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(findTile(parsed, 7, 4)?.tilled).toBe(true);
  expect(findTile(parsed, 7, 4)?.wateredToday).toBe(false);
});

test('mouse wheel does not cycle the hotbar while location selection is open and Space still confirms the preselected service', async ({ page }) => {
  await installSave(page, 'shop-panel-stable');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await preselectMarketShop(page);
  await page.locator('canvas').hover();
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await waitForDebugState(page, { interactionPanelKind: 'shop' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousCount }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) > previousCount;
    },
    { key: SAVE_KEY, previousCount: before.state?.player?.inventory?.['seed.mossling']?.count ?? 0 }
  );

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBeGreaterThan(before.state?.player?.inventory?.['seed.mossling']?.count ?? 0);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBeLessThan(before.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0);
});

test('mouse wheel does not cycle the hotbar while a storage interaction panel is open and resumes from the same slot after closing it', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.locator('canvas').hover();
  await page.keyboard.press('F2');
  await page.waitForTimeout(40);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(findTile(parsed, 7, 4)?.tilled).toBe(true);
  expect(findTile(parsed, 7, 4)?.wateredToday).toBe(false);
  expect(parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0).toBe(0);
});

test('farm action storage deposit path remains the primary flow and persists moving one item into storage', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(40);
  await page.keyboard.press('3');
  await page.waitForTimeout(120);

  const beforeConfirm = await readSave(page);
  const beforeInventoryCount = beforeConfirm.state?.player?.inventory?.['seed.mossling']?.count ?? 0;
  const beforeStorageCount = beforeConfirm.state?.storage?.inventory?.['seed.mossling']?.count ?? 0;

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(beforeInventoryCount);
  expect(afterAdvance.state?.storage?.inventory?.['seed.mossling']?.count ?? 0).toBe(beforeStorageCount);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(2);
});

test('M no longer double-functions as confirm and now only opens the farm action menu', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(40);
  await page.keyboard.press('3');
  await page.waitForTimeout(40);
  await page.keyboard.press('M');
  await page.waitForTimeout(120);

  const afterM = await readSave(page);
  expect(afterM).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(2);
});

test('storage withdraw hotkey flow persists moving one item back to inventory', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(40);
  await page.keyboard.press('4');
  await page.waitForTimeout(120);

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.dewroot']?.count ?? 0) === 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.dewroot']?.count ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(1);
});

test('farm action shipping path remains the primary flow and persists moving one item into shipping bin', async ({ page }) => {
  await installSave(page, 'shipping-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('Shift+M');
  await page.waitForTimeout(40);
  await page.keyboard.press('8');
  await page.waitForTimeout(120);

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.shippingBin?.['seed.mossling'] ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.shippingBin?.['seed.mossling'] ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(1);
});

test('legacy F2 now only preselects storage deposit in farm action panel until Enter advances and confirms', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F2');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(2);
});

test('legacy F3 now only opens storage deposit panel until Enter confirms', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F3');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.mossling']?.count ?? 0).toBe(1);
});

test('legacy F6 now only preselects storage withdraw in farm action panel until Enter advances and confirms', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F6');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.dewroot']?.count ?? 0) === 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.dewroot']?.count ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(1);
});

test('Escape closes storage deposit panel without mutating save', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F2');
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('Enter does not advance the day while a storage interaction panel is open and only works after the panel is closed', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);
  const beforeDay = before.state?.day ?? 0;

  await page.keyboard.press('F2');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const whilePanelOpen = await readSave(page);
  expect(whilePanelOpen.state?.day ?? 0).toBe(beforeDay);
  expect(whilePanelOpen.state?.player?.flags).toEqual(before.state?.player?.flags);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousDay }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.day ?? 0) > previousDay;
    },
    { key: SAVE_KEY, previousDay: beforeDay }
  );

  const afterEndDay = await readSave(page);
  expect(afterEndDay.state?.day ?? 0).toBeGreaterThan(beforeDay);
});

test('legacy F1 now only preselects facility collect in farm action panel until Enter advances and confirms', async ({ page }) => {
  await installSave(page, 'facility-collect-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F1');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['item.dried-herb']?.count ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['item.dried-herb']?.count ?? 0).toBe(1);
  expect(parsed.state?.facilities?.[0]?.[1]?.job ?? null).toBeNull();
});

test('legacy F4 now only preselects storage withdraw in farm action panel until Enter advances and confirms', async ({ page }) => {
  await installSave(page, 'storage-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F4');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.storage?.inventory?.['seed.dewroot']?.count ?? 0) === 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.storage?.inventory?.['seed.dewroot']?.count ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(1);
});

test('legacy F9 now only preselects shipping in farm action panel until Enter advances and confirms', async ({ page }) => {
  await installSave(page, 'shipping-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F9');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.shippingBin?.['seed.mossling'] ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.shippingBin?.['seed.mossling'] ?? 0).toBe(1);
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(1);
});

test('legacy F10 now only opens shipping panel until Enter confirms', async ({ page }) => {
  await installSave(page, 'shipping-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F10');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.shippingBin?.['seed.mossling'] ?? 0) >= 1;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.shippingBin?.['seed.mossling'] ?? 0).toBe(1);
});

test('legacy F12 now only preselects build in farm action panel until Enter advances the flow', async ({ page }) => {
  await installSave(page, 'build-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F12');
  await page.waitForTimeout(120);

  const afterOpen = await readSave(page);
  expect(afterOpen).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);

  const afterAdvance = await readSave(page);
  expect(afterAdvance).toEqual(before);
});

test('Escape closes shipping panel without mutating save', async ({ page }) => {
  await installSave(page, 'shipping-panel');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  const before = await readSave(page);

  await page.keyboard.press('F9');
  await page.waitForTimeout(40);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);

  const after = await readSave(page);
  expect(after).toEqual(before);
});

test('hotbar digit selection plus Space persists till and sow on the front tile', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);
  await clearNarrativeBeat(page, 'first-till');

  await page.keyboard.press('5');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    const tile = parsed.state?.tiles?.find(entry => entry.x === 7 && entry.y === 4);
    return tile?.cropId != null && (parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0) === 2;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  const frontTile = findTile(parsed, 7, 4);
  expect(frontTile).toBeDefined();
  expect(frontTile?.tilled).toBe(true);
  expect(frontTile?.cropId).not.toBeNull();
  expect(parsed.state?.player?.inventory?.['seed.mossling']?.count ?? 0).toBe(2);
});

test('E mirrors Space as the default farm interaction key and Q cycles the hotbar', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);
  await clearNarrativeBeat(page, 'first-till');

  await page.keyboard.press('5');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.cropId != null) ?? false;
  }, SAVE_KEY);

  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Q');
  await page.waitForTimeout(40);
  await page.keyboard.press('E');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.wateredToday) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  const frontTile = findTile(parsed, 7, 4);
  expect(frontTile?.wateredToday).toBe(true);
});

test('E also advances narrative modal beats as part of the default confirm flow', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const before = await readSave(page);
  expect(before.state?.player?.flags?.includes('narr-first-till') ?? false).toBe(false);

  await page.keyboard.press('e');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.player?.flags?.includes('narr-first-till') ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.flags?.includes('narr-first-till')).toBe(true);
});

test('Enter advances a narrative modal without advancing the day and only resumes end-day after the modal closes', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const beforeDialogueConfirm = await readSave(page);
  const beforeDay = beforeDialogueConfirm.state?.day ?? 0;
  expect(beforeDialogueConfirm.state?.player?.flags?.includes('narr-first-till') ?? false).toBe(false);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.player?.flags?.includes('narr-first-till') ?? false;
  }, SAVE_KEY);

  const afterDialogueConfirm = await readSave(page);
  expect(afterDialogueConfirm.state?.player?.flags?.includes('narr-first-till')).toBe(true);
  expect(afterDialogueConfirm.state?.day ?? 0).toBe(beforeDay);

  await page.keyboard.press('Enter');
  await page.waitForFunction(
    ({ key, previousDay }) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveSnapshot;
      return (parsed.state?.day ?? 0) > previousDay;
    },
    { key: SAVE_KEY, previousDay: beforeDay }
  );

  const afterEndDay = await readSave(page);
  expect(afterEndDay.state?.day ?? 0).toBeGreaterThan(beforeDay);
});

test('mouse wheel does not cycle the hotbar while a narrative modal is open and resumes from the same slot after it closes', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.locator('canvas').hover();
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);

  const beforeDialogueConfirm = await readSave(page);
  expect(beforeDialogueConfirm.state?.player?.flags?.includes('narr-first-till') ?? false).toBe(false);

  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.player?.flags?.includes('narr-first-till') ?? false;
  }, SAVE_KEY);

  const afterDialogueConfirm = await readSave(page);
  expect(afterDialogueConfirm.state?.player?.flags?.includes('narr-first-till')).toBe(true);
  expect(findTile(afterDialogueConfirm, 7, 4)?.tilled).toBe(true);
  expect(findTile(afterDialogueConfirm, 7, 4)?.wateredToday).toBe(false);
});

test('Shift+E still triggers ascend pill flow without consuming the default interact key', async ({ page }) => {
  await installSave(page, 'ascension-pill');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');
  await page.keyboard.press('Shift+E');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.postAscension?.mode === 'choice-pending';
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.postAscension?.mode).toBe('choice-pending');
  expect(parsed.state?.gameOver).toBe(false);
});

test('ascension choice 1 enters Ending and preserves the terminal save until New Game starts a new journey', async ({ page }) => {
  const saveFixture = await installSave(page, 'ascension-choice');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.keyboard.press('1');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.postAscension?.mode === 'ascended-away' && parsed.state?.postAscension?.victoryRecorded === true && parsed.state?.ending === 'ascension' && parsed.state?.gameOver === true;
  }, SAVE_KEY);

  const terminalSave = await page.evaluate(key => window.localStorage.getItem(key), SAVE_KEY);
  expect(terminalSave).not.toBeNull();
  await expect(page.locator('[data-app-surface="ending"]')).toBeVisible();
  await expect(page.locator('canvas')).toBeHidden();

  await page.keyboard.press('Enter');
  const afterNonRestartKey = await page.evaluate(key => window.localStorage.getItem(key), SAVE_KEY);
  expect(afterNonRestartKey).toBe(terminalSave);

  await page.reload();
  await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
  const restored = await readSave(page);
  expect(restored.state?.postAscension?.mode).toBe('ascended-away');
  expect(restored.state?.postAscension?.victoryRecorded).toBe(true);
  expect(restored.state?.ending).toBe('ascension');
  expect(restored.state?.gameOver).toBe(true);
  // 终局存档经测试门入世界：saveState 副作用会把 gameOver 状态转到 Ending 表面。
  await page.evaluate(() => {
    const target = (window as typeof window & { __AEON_TEST__?: { enterLoadedLegacyWorld: () => boolean } }).__AEON_TEST__;
    if (!target?.enterLoadedLegacyWorld()) throw new Error('enterLoadedLegacyWorld failed');
  });
  await expect(page.locator('[data-app-surface="ending"]')).toBeVisible();
  await waitForDebugState(page, { postAscensionMode: 'ascended-away' });
  await saveFixture.dispose();

  await page.locator('#flow-ending-return').click();
  // 当前接线：开始新的偷天换劫一世不清除旧世界终局存档（回滚保留）。
  await page.locator('#flow-title-new-game').click();
  await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible();
  const terminalAfter = await readSave(page);
  expect(terminalAfter.state?.gameOver ?? false).toBe(true);
  expect(terminalAfter.state?.ending ?? null).toBe('ascension');
});

test('ascension choice 2 persists stayed-in-world save for post-ending play', async ({ page }) => {
  await installSave(page, 'ascension-choice');
  await openGameWithLoadedSave(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await waitForDebugState(page, { postAscensionMode: 'choice-pending' });
  await page.keyboard.press('2');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.postAscension?.mode === 'stayed-in-world' && parsed.state?.postAscension?.victoryRecorded === true && parsed.state?.gameOver === false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.postAscension?.mode).toBe('stayed-in-world');
  expect(parsed.state?.postAscension?.victoryRecorded).toBe(true);
  expect(parsed.state?.gameOver).toBe(false);
  expect(parsed.state?.ending ?? null).toBeNull();
});

test('Enter does not resolve or advance past the ascension choice modal and only explicit digit choices progress it', async ({ page }) => {
  await installSave(page, 'ascension-choice');
  await openGameWithLoadedSave(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await waitForDebugState(page, { postAscensionMode: 'choice-pending' });
  const before = await readSave(page);
  const beforeDay = before.state?.day ?? 0;
  expect(before.state?.postAscension?.mode).toBe('choice-pending');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterEnter = await readSave(page);
  expect(afterEnter.state?.day ?? 0).toBe(beforeDay);
  expect(afterEnter.state?.postAscension?.mode).toBe('choice-pending');
  expect(afterEnter.state?.gameOver).toBe(false);

  await page.keyboard.press('2');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.postAscension?.mode === 'stayed-in-world' && parsed.state?.postAscension?.victoryRecorded === true && parsed.state?.gameOver === false;
  }, SAVE_KEY);

  const afterChoice = await readSave(page);
  expect(afterChoice.state?.postAscension?.mode).toBe('stayed-in-world');
  expect(afterChoice.state?.day ?? 0).toBe(beforeDay);
});

test('mouse wheel does not cycle the hotbar while the ascension choice modal is open and only explicit choice input resolves it', async ({ page }) => {
  await installSave(page, 'ascension-choice');
  await openGameWithLoadedSave(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await waitForDebugState(page, { postAscensionMode: 'choice-pending' });
  await page.locator('canvas').hover();

  const before = await readSave(page);
  const beforeDay = before.state?.day ?? 0;
  expect(before.state?.postAscension?.mode).toBe('choice-pending');

  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);

  const afterWheel = await readSave(page);
  expect(afterWheel.state?.day ?? 0).toBe(beforeDay);
  expect(afterWheel.state?.postAscension?.mode).toBe('choice-pending');
  expect(afterWheel.state?.gameOver).toBe(false);

  await page.keyboard.press('2');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.postAscension?.mode === 'stayed-in-world' && parsed.state?.postAscension?.victoryRecorded === true && parsed.state?.gameOver === false;
  }, SAVE_KEY);

  const afterChoice = await readSave(page);
  expect(afterChoice.state?.postAscension?.mode).toBe('stayed-in-world');
  expect(afterChoice.state?.day ?? 0).toBe(beforeDay);
});

test('post-ascension commission board persists staying-world ward commission completion', async ({ page }) => {
  await installSave(page, 'post-ascension-commission');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await openLocationSelection(page);
  await preselectLocationService(page, '4', 'ruin-gate', '4', 'show-commission');
  await page.keyboard.press('Enter');
  // 现行确认方式：面板提示「点击交付 · Esc 返回」，需在可见预览区内点击交付。
  await clickCanvasLogical(page, 810, 380);
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0) === 16 && (parsed.state?.player?.inventory?.['item.beast-core']?.count ?? 0) === 0 && (parsed.state?.flags?.includes('commission.6.commission.human-ward-patrol') ?? false);
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(16);
  expect(parsed.state?.player?.inventory?.['item.beast-core']?.count ?? 0).toBe(0);
  expect(parsed.state?.flags?.includes('commission.6.commission.human-ward-patrol')).toBe(true);
});

test('legacy PageDown remains a commission-only compatibility path', async ({ page }) => {
  await installSave(page, 'post-ascension-commission');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(40);
  await page.keyboard.press('PageDown');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0) === 16 && (parsed.state?.player?.inventory?.['item.beast-core']?.count ?? 0) === 0 && (parsed.state?.flags?.includes('commission.6.commission.human-ward-patrol') ?? false);
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(16);
  expect(parsed.state?.player?.inventory?.['item.beast-core']?.count ?? 0).toBe(0);
  expect(parsed.state?.flags?.includes('commission.6.commission.human-ward-patrol')).toBe(true);
});

test('post-ascension tea shed service persists one calm-life rest visit', async ({ page }) => {
  await installSave(page, 'post-ascension-tea-shed');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await openLocationSelection(page);
  await preselectLocationService(page, '6', 'tea-shed', '2', 'show-tea-shed');
  await page.keyboard.press('Enter');
  // 同 commission：茶棚面板为「点击歇脚听闻 · Esc 返回」的点击确认。
  await clickCanvasLogical(page, 810, 380);
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.flags?.includes('tea-shed-visit.1') ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('tea-shed-visit.1')).toBe(true);
});

test('post-ascension greenhouse service persists one nursery upkeep visit', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await page.keyboard.press('Alt+E');
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.flags?.includes('greenhouse-tended.1') ?? false) && (parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0) >= 2;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('greenhouse-tended.1')).toBe(true);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBeGreaterThanOrEqual(2);
});

test('post-ascension greenhouse upkeep survives a page reload without granting a second same-day visit', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await page.keyboard.press('Alt+E');
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse' });
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.flags?.includes('greenhouse-tended.1') ?? false) && (parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0) >= 2;
  }, SAVE_KEY);

  const afterVisit = await readSave(page);
  const seedCountAfterVisit = afterVisit.state?.player?.inventory?.['seed.dewroot']?.count ?? 0;

  await page.reload();
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);

  await page.keyboard.press('Alt+E');
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse' });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const afterReload = await readSave(page);
  expect(afterReload.state?.flags?.includes('greenhouse-tended.1')).toBe(true);
  expect(afterReload.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(seedCountAfterVisit);
});

test('location selection digit direct-select plus Space opens daily service panel before confirmation', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await openLocationSelection(page);
  await preselectLocationService(page, '7', 'greenhouse', '2', 'show-greenhouse');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse', locationSelectionActive: false });

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('greenhouse-tended.1')).toBe(false);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(0);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const confirmed = JSON.parse(raw) as SaveSnapshot;
    return (confirmed.state?.flags?.includes('greenhouse-tended.1') ?? false) && (confirmed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0) >= 2;
  }, SAVE_KEY);
});

test('location selection supports E opening the preselected service panel without spending the daily visit', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await openLocationSelection(page);
  await preselectLocationService(page, '7', 'greenhouse', '2', 'show-greenhouse');
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse', locationSelectionActive: false });

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('greenhouse-tended.1')).toBe(false);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(0);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const confirmed = JSON.parse(raw) as SaveSnapshot;
    return (confirmed.state?.flags?.includes('greenhouse-tended.1') ?? false) && (confirmed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0) >= 2;
  }, SAVE_KEY);
});

test('location selection Enter opens the daily service panel before the second confirm spends the visit', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await openLocationSelection(page);
  await preselectLocationService(page, '7', 'greenhouse', '2', 'show-greenhouse');

  const before = await readSave(page);
  expect(before.state?.flags?.includes('greenhouse-tended.1')).toBe(false);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse', locationSelectionActive: false });

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('greenhouse-tended.1')).toBe(false);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(0);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const confirmed = JSON.parse(raw) as SaveSnapshot;
    return (confirmed.state?.flags?.includes('greenhouse-tended.1') ?? false) && (confirmed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0) >= 2;
  }, SAVE_KEY);
  const confirmed = await readSave(page);
  expect(confirmed.state?.flags?.includes('greenhouse-tended.1')).toBe(true);
  expect(confirmed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBeGreaterThanOrEqual(2);
});

test('legacy Ctrl+Enter still allows a second explicit confirm from the opened service panel', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await openLocationSelection(page);
  await preselectLocationService(page, '7', 'greenhouse', '2', 'show-greenhouse');

  const before = await readSave(page);
  expect(before.state?.flags?.includes('greenhouse-tended.1')).toBe(false);

  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(300);
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse', locationSelectionActive: false });
  const opened = await readSave(page);
  expect(opened.state?.flags?.includes('greenhouse-tended.1')).toBe(false);
  expect(opened.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(0);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.flags?.includes('greenhouse-tended.1') ?? false) && (parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0) >= 2;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('greenhouse-tended.1')).toBe(true);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBeGreaterThanOrEqual(2);
});

test('legacy period confirm opens the daily service panel before explicit confirmation', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await openLocationSelection(page);
  await preselectLocationService(page, '7', 'greenhouse', '2', 'show-greenhouse');

  const before = await readSave(page);
  expect(before.state?.flags?.includes('greenhouse-tended.1')).toBe(false);

  await page.keyboard.press('.');
  await page.waitForTimeout(300);
  await waitForDebugState(page, { interactionPanelKind: 'greenhouse', locationSelectionActive: false });
  const opened = await readSave(page);
  expect(opened.state?.flags?.includes('greenhouse-tended.1')).toBe(false);
  expect(opened.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBe(0);

  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.flags?.includes('greenhouse-tended.1') ?? false) && (parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0) >= 2;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('greenhouse-tended.1')).toBe(true);
  expect(parsed.state?.player?.inventory?.['seed.dewroot']?.count ?? 0).toBeGreaterThanOrEqual(2);
});

test('location selection blocks same-key world actions until the directory is dismissed', async ({ page }) => {
  await installSave(page, 'hotbar-primary');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await page.waitForTimeout(40);
  await page.keyboard.press('1');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.tilled) ?? false;
  }, SAVE_KEY);
  await clearNarrativeBeat(page, 'first-till');
  await page.keyboard.press('5');
  await page.waitForTimeout(40);
  await page.keyboard.press('Space');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.cropId != null) ?? false;
  }, SAVE_KEY);
  await page.keyboard.press('2');
  await page.waitForTimeout(40);

  const before = await readSave(page);
  expect(findTile(before, 7, 4)?.wateredToday).toBe(false);

  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(40);
  await page.keyboard.press('x');
  await page.waitForTimeout(120);

  const afterDismiss = await readSave(page);
  expect(findTile(afterDismiss, 7, 4)?.wateredToday).toBe(false);
  expect(afterDismiss).toEqual(before);

  await page.keyboard.press('x');
  await page.waitForTimeout(40);
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.tiles?.some(tile => tile.x === 7 && tile.y === 4 && tile.wateredToday) ?? false;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(findTile(parsed, 7, 4)?.wateredToday).toBe(true);
});

test('staying-world quick access keys open commission, tea shed, and greenhouse daily services', async ({ page }) => {
  await installSave(page, 'post-ascension-quick-access');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  await page.keyboard.press('Alt+Q');
  await page.waitForTimeout(40);
  await page.waitForTimeout(120);
  await clearCommissionDialogue(page);
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.flags?.includes('commission.6.commission.human-ward-patrol') ?? false;
  }, SAVE_KEY);

  await page.keyboard.press('Alt+W');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return parsed.state?.flags?.includes('tea-shed-visit.6') ?? false;
  }, SAVE_KEY);

  await page.keyboard.press('Alt+E');
  await page.waitForTimeout(40);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.flags?.includes('commission.6.commission.human-ward-patrol') ?? false) && (parsed.state?.flags?.includes('tea-shed-visit.6') ?? false) && (parsed.state?.flags?.includes('greenhouse-tended.6') ?? false);
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('commission.6.commission.human-ward-patrol')).toBe(true);
  expect(parsed.state?.flags?.includes('tea-shed-visit.6')).toBe(true);
  expect(parsed.state?.flags?.includes('greenhouse-tended.6')).toBe(true);
});

test('= now only preselects upgrade before Enter opens and confirms greenhouse nursery expansion', async ({ page }) => {
  await installSave(page, 'post-ascension-greenhouse-upgrade');
  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();

  await clearIntroDialogue(page);
  await clearNarrativeBeat(page, 'stage-3');
  await clearNarrativeBeat(page, 'stage-5');
  await clearNarrativeBeat(page, 'stage-7');

  const before = await readSave(page);

  await page.keyboard.press('=');
  await page.waitForTimeout(120);

  const afterPreselect = await readSave(page);
  expect(afterPreselect).toEqual(before);

  await page.keyboard.press('Enter');
  await page.waitForTimeout(40);
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(40);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as SaveSnapshot;
    return (parsed.state?.flags?.includes('upgrade.greenhouse-nursery-1') ?? false) && (parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0) === 0;
  }, SAVE_KEY);

  const parsed = await readSave(page);
  expect(parsed.state?.flags?.includes('upgrade.greenhouse-nursery-1')).toBe(true);
  expect(parsed.state?.player?.inventory?.['item.spirit-stone']?.count ?? 0).toBe(0);
});
