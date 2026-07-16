import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createSimContext, createWorld, DEFAULT_BALANCE, FIRST_SECOND_WATER_FLAG, greenhouseVisitFlag, participateFestival, teaShedVisitFlag } from '@sim';
import { farmsteadPropPlacements, locationWorldPreviewPlacements, npcWorldPreviewPlacements } from '@render/npcWorldPreview';
import { locationServiceActorAssetId } from '@app/locationPreview';
import { mutateItem } from '@sim/world/player';
import { stageQiCap } from '@sim/progression/progression';

function findLocationPlacement(state: Parameters<typeof locationWorldPreviewPlacements>[0], locationId: string) {
  return locationWorldPreviewPlacements(state).find(entry => entry.locationId === locationId);
}

describe('npc world preview placements', () => {
  it('maps daily npc schedules into deterministic in-world preview placements', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 31, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.season = 'spring';
    state.seasonDay = 6;

    expect(npcWorldPreviewPlacements(state)).toEqual([
      {
        npcId: 'npc.array-smith',
        npcName: '阵匠老陆',
        assetId: 'sprite.npc.array-smith',
        locationId: 'array-shed',
        x: 9,
        y: 2,
        birthday: false,
        hasQuest: false,
        questReady: false
      },
      {
        npcId: 'sprite.npc.processing-artisan',
        npcName: '晒坊匠人',
        assetId: 'sprite.npc.processing-artisan',
        locationId: 'farmstead',
        x: 2,
        y: 2,
        birthday: false,
        hasQuest: false,
        questReady: false
      },
      {
        npcId: 'npc.herb-gatherer',
        npcName: '采药女',
        assetId: 'sprite.npc.herb-gatherer',
        locationId: 'herb-plot',
        x: 3,
        y: 2,
        birthday: false,
        hasQuest: false,
        questReady: false
      },
      {
        npcId: 'sprite.npc.patrol-guard',
        npcName: '巡谷守卫',
        assetId: 'sprite.npc.patrol-guard',
        locationId: 'ruin-gate',
        x: 12,
        y: 5,
        birthday: false,
        hasQuest: false,
        questReady: false
      },
      {
        npcId: 'sprite.npc.patrol-guard',
        npcName: '巡谷守卫',
        assetId: 'sprite.npc.patrol-guard',
        locationId: 'spirit-vein',
        x: 12,
        y: 6,
        birthday: false,
        hasQuest: false,
        questReady: false
      },
      {
        npcId: 'npc.wandering-cultivator',
        npcName: '游方散修',
        assetId: 'sprite.npc.wandering-cultivator',
        locationId: 'valley-market',
        x: 12,
        y: 1,
        birthday: false,
        hasQuest: false,
        questReady: false
      },
      {
        npcId: 'sprite.npc.market-merchant',
        npcName: '集市商贩',
        assetId: 'sprite.npc.market-merchant',
        locationId: 'valley-market',
        x: 13,
        y: 1,
        birthday: false,
        hasQuest: false,
        questReady: false
      },
      {
        npcId: 'sprite.npc.patrol-guard',
        npcName: '巡谷守卫',
        assetId: 'sprite.npc.patrol-guard',
        locationId: 'valley-outskirts',
        x: 1,
        y: 4,
        birthday: false,
        hasQuest: false,
        questReady: false
      }
    ]);
  });

  it('surfaces birthday and personal-quest readiness flags in preview placements', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 32, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.season = 'summer';
    state.seasonDay = 8;
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 4 };
    state.player.inventory['herb.mistfern'] = { itemId: 'herb.mistfern', count: 2 };
    state.player.bodyFoundation = 1200;

    const herbPreview = npcWorldPreviewPlacements(state).find(entry => entry.npcId === 'npc.herb-gatherer');

    expect(herbPreview).toMatchObject({
      locationId: 'creek-field',
      birthday: true,
      hasQuest: true,
      questReady: true
    });
  });

  it('clusters all daily schedules at the festival ground during festivals while keeping unique tiles', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 33, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春祭',
      daysLeft: 2,
      growthMod: 1,
      qiMod: 1
    };

    const placements = npcWorldPreviewPlacements(state);

    expect(placements.map(entry => entry.locationId)).toEqual(['farmstead', 'festival-ground', 'festival-ground', 'festival-ground', 'festival-ground', 'ruin-gate', 'spirit-vein', 'valley-market', 'valley-outskirts']);
    const festivalPlacements = placements.filter(entry => entry.locationId === 'festival-ground');
    expect(new Set(festivalPlacements.map(entry => `${entry.x},${entry.y}`)).size).toBe(4);
    expect(festivalPlacements.some(entry => entry.assetId === 'sprite.npc.market-merchant')).toBe(true);
  });

  it('adds ambient location npc art only for active showcase locations without inventing quest markers', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 36, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.postAscension.mode = 'stayed-in-world';

    const placements = npcWorldPreviewPlacements(state);
    const teaShed = placements.find(entry => entry.assetId === 'sprite.npc.tea-shed-elder');
    const marketMerchant = placements.find(entry => entry.assetId === 'sprite.npc.market-merchant');
    const farmsteadArtisan = placements.find(entry => entry.assetId === 'sprite.npc.processing-artisan' && entry.locationId === 'farmstead');
    const greenhouseGatherer = placements.find(entry => entry.assetId === 'sprite.npc.herb-gatherer' && entry.locationId === 'greenhouse');
    const arrayShedSmith = placements.find(entry => entry.assetId === 'sprite.npc.array-smith' && entry.locationId === 'array-shed');

    expect(teaShed).toMatchObject({
      npcId: 'sprite.npc.tea-shed-elder',
      npcName: '茶棚老人',
      locationId: 'tea-shed',
      birthday: false,
      hasQuest: false,
      questReady: false
    });
    expect(marketMerchant).toMatchObject({
      npcId: 'sprite.npc.market-merchant',
      npcName: '集市商贩',
      locationId: 'valley-market',
      birthday: false,
      hasQuest: false,
      questReady: false
    });
    expect(farmsteadArtisan).toMatchObject({
      npcId: 'sprite.npc.processing-artisan',
      npcName: '晒坊匠人',
      locationId: 'farmstead',
      birthday: false,
      hasQuest: false,
      questReady: false
    });
    expect(greenhouseGatherer).toMatchObject({
      npcId: 'sprite.npc.herb-gatherer',
      npcName: '采药女',
      locationId: 'greenhouse',
      birthday: false,
      hasQuest: false,
      questReady: false
    });
    expect(arrayShedSmith).toMatchObject({
      npcId: 'npc.array-smith',
      npcName: '阵匠老陆',
      locationId: 'array-shed',
      birthday: false,
      hasQuest: false,
      questReady: false
    });
  });

  it('does not duplicate ambient portraits when a sim-backed npc is already scheduled at that location', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 31, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.season = 'spring';
    state.seasonDay = 6;

    const placements = npcWorldPreviewPlacements(state);

    expect(placements.filter(entry => entry.locationId === 'herb-plot' && entry.assetId === 'sprite.npc.herb-gatherer')).toHaveLength(1);
    expect(placements.filter(entry => entry.locationId === 'array-shed' && entry.assetId === 'sprite.npc.array-smith')).toHaveLength(1);
  });

  it('projects active schedule locations into lightweight world landmark placements', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 34, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.season = 'spring';
    state.seasonDay = 6;

    expect(locationWorldPreviewPlacements(state)).toEqual([
      {
        locationId: 'array-shed',
        assetId: 'loc.array-shed',
        taskAssetId: undefined,
        x: 9,
        y: 2,
        npcCount: 1,
        birthday: false,
        hasQuest: false,
        questReady: false,
        serviceReady: false,
        serviceDone: false,
        taskReady: false
      },
      {
        locationId: 'farmstead',
        assetId: 'loc.farmstead',
        taskAssetId: undefined,
        x: 2,
        y: 2,
        npcCount: 1,
        birthday: false,
        hasQuest: false,
        questReady: false,
        serviceReady: false,
        serviceDone: false,
        taskReady: false
      },
      {
        locationId: 'herb-plot',
        assetId: 'loc.herb-plot',
        taskAssetId: undefined,
        x: 3,
        y: 2,
        npcCount: 1,
        birthday: false,
        hasQuest: false,
        questReady: false,
        serviceReady: false,
        serviceDone: false,
        taskReady: false
      },
      {
        locationId: 'valley-market',
        assetId: 'loc.valley-market',
        taskAssetId: undefined,
        x: 12,
        y: 1,
        npcCount: 1,
        birthday: false,
        hasQuest: false,
        questReady: false,
        serviceReady: false,
        serviceDone: false,
        taskReady: false
      }
    ]);
  });

  it('summarizes clustered festival schedules into a single landmark with npc count', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 35, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春祭',
      daysLeft: 2,
      growthMod: 1,
      qiMod: 1
    };

    expect(locationWorldPreviewPlacements(state)).toEqual([
      {
        locationId: 'farmstead',
        assetId: 'loc.farmstead',
        taskAssetId: undefined,
        x: 2,
        y: 2,
        npcCount: 1,
        birthday: false,
        hasQuest: false,
        questReady: false,
        serviceReady: false,
        serviceDone: false,
        taskReady: false
      },
      {
        locationId: 'festival-ground',
        assetId: 'loc.festival-ground',
        taskAssetId: undefined,
        serviceAssetId: 'sprite.npc.market-merchant',
        x: 11,
        y: 4,
        npcCount: 3,
        birthday: false,
        hasQuest: false,
        questReady: false,
        serviceReady: true,
        serviceDone: false,
        taskReady: false
      }
    ]);
  });

  it('counts ambient showcase occupants on location landmarks without double-counting scheduled portraits', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 31, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.season = 'spring';
    state.seasonDay = 6;

    expect(findLocationPlacement(state, 'array-shed')).toMatchObject({
      locationId: 'array-shed',
      npcCount: 1
    });
    expect(findLocationPlacement(state, 'herb-plot')).toMatchObject({
      locationId: 'herb-plot',
      npcCount: 1
    });
    expect(findLocationPlacement(state, 'farmstead')).toMatchObject({
      locationId: 'farmstead',
      npcCount: 1
    });
    expect(findLocationPlacement(state, 'valley-market')).toMatchObject({
      locationId: 'valley-market',
      npcCount: 2
    });
  });

  it('keeps currently active directory locations visible even when no npc schedule is present there yet', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 37, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });

    expect(locationWorldPreviewPlacements(state)).toContainEqual({
      locationId: 'farmstead',
      assetId: 'loc.farmstead',
      taskAssetId: undefined,
      x: 2,
      y: 2,
      npcCount: 1,
      birthday: false,
      hasQuest: false,
      questReady: false,
      serviceReady: false,
      serviceDone: false,
      taskReady: false
    });
  });

  it('projects storage chest and shipping bin into the farmstead world layer with live readiness flags', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 39, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });

    expect(farmsteadPropPlacements(state)).toEqual([
      {
        assetId: 'facility.storage-chest',
        x: 3,
        y: 2,
        status: 'idle'
      },
      {
        assetId: 'facility.shipping-bin',
        x: 2,
        y: 3,
        status: 'idle'
      }
    ]);

    state.storage.capacity = 1;
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 5 };
    state.shippingBin['herb.mossling'] = 2;

    expect(farmsteadPropPlacements(state)).toEqual([
      {
        assetId: 'facility.storage-chest',
        x: 3,
        y: 2,
        status: 'ready'
      },
      {
        assetId: 'facility.shipping-bin',
        x: 2,
        y: 3,
        status: 'ready'
      }
    ]);
  });

  it('surfaces birthday and npc quest readiness on the location landmark itself', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 38, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.season = 'summer';
    state.seasonDay = 8;
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 4 };
    state.player.inventory['herb.mistfern'] = { itemId: 'herb.mistfern', count: 2 };
    state.player.bodyFoundation = 1200;

    expect(locationWorldPreviewPlacements(state)).toContainEqual({
      locationId: 'creek-field',
      assetId: 'loc.creek-field',
      taskAssetId: undefined,
      x: 3,
      y: 6,
      npcCount: 1,
      birthday: true,
      hasQuest: true,
      questReady: true,
      serviceReady: false,
      serviceDone: false,
      taskReady: false
    });
  });

  it('marks the real herb gatherer turn-in location instead of collapsing ready commissions to the market landmark', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 40, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    mutateItem(state.player, 'herb.dewroot', 3);

    expect(locationWorldPreviewPlacements(state)).toContainEqual({
      locationId: 'herb-plot',
      assetId: 'loc.herb-plot',
      taskAssetId: 'icon.herb.dewroot',
      x: 3,
      y: 2,
      npcCount: 1,
      birthday: false,
      hasQuest: false,
      questReady: false,
      serviceReady: false,
      serviceDone: false,
      taskReady: true
    });
    expect(findLocationPlacement(state, 'valley-market')?.taskReady).toBe(false);
  });

  it('marks ruin gate when the array smith commission is ready to turn in', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 3, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.day = 3;
    state.player.stage = 1;
    mutateItem(state.player, 'item.broken-talisman', 2);

    expect(findLocationPlacement(state, 'ruin-gate')).toMatchObject({
      locationId: 'ruin-gate',
      taskReady: true,
      taskAssetId: 'icon.item.broken-talisman'
    });
  });

  it('keeps the array-shed world landmark visible when breakthrough is ready even if it is not in the active directory', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 45, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.stage = 1;
    state.player.bodyFoundation = stageQiCap(1, DEFAULT_BALANCE);
    state.player.cultivation = state.player.bodyFoundation;

    expect(findLocationPlacement(state, 'array-shed')).toMatchObject({
      locationId: 'array-shed',
      assetId: 'loc.array-shed',
      x: 9,
      y: 2
    });
  });

  it('marks the array-shed landmark as service-ready when breakthrough is ready', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 46, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.stage = 1;
    state.player.bodyFoundation = stageQiCap(1, DEFAULT_BALANCE);
    state.player.cultivation = state.player.bodyFoundation;

    expect(findLocationPlacement(state, 'array-shed')).toMatchObject({
      locationId: 'array-shed',
      serviceReady: true,
      serviceDone: false,
      serviceAssetId: 'sprite.npc.array-smith',
      taskReady: false
    });
  });

  it('surfaces concrete task badges for farmstead, incidents, and ruin-gate archive lines', () => {
    const reg = buildRegistry();

    const farmsteadState = createWorld({ seed: 42, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    farmsteadState.shippingBin['herb.mossling'] = 2;
    expect(findLocationPlacement(farmsteadState, 'farmstead')).toMatchObject({
      locationId: 'farmstead',
      taskReady: true,
      taskAssetId: 'icon.herb.mossling'
    });

    const incidentState = createWorld({ seed: 43, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    incidentState.postAscension.mode = 'stayed-in-world';
    incidentState.day = 1;
    expect(findLocationPlacement(incidentState, 'spirit-vein')).toMatchObject({
      locationId: 'spirit-vein',
      taskReady: true,
      taskAssetId: 'icon.item.beast-core'
    });

    const ruinState = createWorld({ seed: 44, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    ruinState.player.flags.add(FIRST_SECOND_WATER_FLAG);
    mutateItem(ruinState.player, 'item.recipe-fragment', 1);
    expect(findLocationPlacement(ruinState, 'ruin-gate')).toMatchObject({
      locationId: 'ruin-gate',
      taskReady: true,
      taskAssetId: 'icon.item.recipe-fragment'
    });
  });

  it('prefers concrete farmstead output and logistics item badges over generic facility badges when known', () => {
    const reg = buildRegistry();

    const finishedFacilityState = createWorld({ seed: 142, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    finishedFacilityState.facilities.set(9001, {
      id: 9001,
      kind: 'drying-rack',
      tileId: 1,
      job: {
        inputItemId: 'herb.mossling',
        outputItemId: 'item.dried-herb',
        outputCount: 1,
        daysRemaining: 0
      }
    });
    expect(findLocationPlacement(finishedFacilityState, 'farmstead')).toMatchObject({
      locationId: 'farmstead',
      taskReady: true,
      taskAssetId: 'icon.item.dried-herb'
    });

    const storageState = createWorld({ seed: 143, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    storageState.storage.capacity = 1;
    storageState.storage.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 2 };
    expect(findLocationPlacement(storageState, 'farmstead')).toMatchObject({
      locationId: 'farmstead',
      taskReady: true,
      taskAssetId: 'icon.herb.dewroot'
    });
  });

  it('marks tea shed and greenhouse as worth visiting before their daily service is consumed', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 39, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.postAscension.mode = 'stayed-in-world';
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);

    const placements = locationWorldPreviewPlacements(state);

    expect(placements).toContainEqual({
      locationId: 'greenhouse',
      assetId: 'loc.greenhouse',
      serviceAssetId: locationServiceActorAssetId('show-greenhouse'),
      x: 10,
      y: 7,
      npcCount: 1,
      birthday: false,
      hasQuest: false,
      questReady: false,
      serviceReady: true,
      serviceDone: false,
      taskReady: false
    });
    expect(placements).toContainEqual({
      locationId: 'tea-shed',
      assetId: 'loc.tea-shed',
      serviceAssetId: locationServiceActorAssetId('show-tea-shed'),
      x: 2,
      y: 7,
      npcCount: 1,
      birthday: false,
      hasQuest: false,
      questReady: false,
      serviceReady: true,
      serviceDone: false,
      taskReady: false
    });
  });

  it('marks the farmstead landmark when logistics or facility work needs immediate attention', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 41, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.shippingBin['herb.mossling'] = 2;

    expect(findLocationPlacement(state, 'farmstead')).toMatchObject({
      locationId: 'farmstead',
      serviceReady: false,
      serviceDone: false,
      taskReady: true
    });
  });

  it('marks the real turn-in landmark when a daily commission can be turned in or a special order is ready to claim', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 42, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 2 };

    expect(findLocationPlacement(state, 'herb-plot')).toMatchObject({
      locationId: 'herb-plot',
      taskReady: true
    });
    expect(findLocationPlacement(state, 'valley-market')?.taskReady).toBe(false);

    delete state.player.inventory['herb.dewroot'];
    state.season = 'summer';
    state.specialOrders['special-order.herb-stockpile'] = {
      id: 'special-order.herb-stockpile',
      progress: 10,
      daysLeft: 4,
      acceptedDay: state.day
    };

    expect(findLocationPlacement(state, 'creek-field')).toMatchObject({
      locationId: 'creek-field',
      taskReady: true
    });
    expect(findLocationPlacement(state, 'valley-market')?.taskReady).toBe(false);
  });

  it('marks the ruin gate landmark when archive or ruin-thread rewards are immediately actionable', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 43, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.player.inventory['item.recipe-fragment'] = { itemId: 'item.recipe-fragment', count: 1 };

    expect(findLocationPlacement(state, 'ruin-gate')).toMatchObject({
      locationId: 'ruin-gate',
      taskReady: true
    });

    delete state.player.inventory['item.recipe-fragment'];
    state.flags.add('archive-donation:archive.recipe-fragment-primer');

    expect(findLocationPlacement(state, 'ruin-gate')).toMatchObject({
      locationId: 'ruin-gate',
      taskReady: true
    });
  });

  it('routes unresolved staying-world incidents onto their actual world landmarks', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 44, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.postAscension.mode = 'stayed-in-world';
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);

    expect(findLocationPlacement(state, 'spirit-vein')).toMatchObject({
      locationId: 'spirit-vein',
      taskReady: true
    });

    state.day = 2;
    expect(findLocationPlacement(state, 'ruin-gate')).toMatchObject({
      locationId: 'ruin-gate',
      taskReady: true
    });

    state.day = 3;
    expect(findLocationPlacement(state, 'creek-field')).toMatchObject({
      locationId: 'creek-field',
      taskReady: true
    });
  });

  it('marks tea shed, greenhouse, and current festival as done after the player handles them today', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 40, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    const ctx = createSimContext(state.masterSeed, reg, DEFAULT_BALANCE);
    state.postAscension.mode = 'stayed-in-world';
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春祭',
      daysLeft: 2,
      growthMod: 1,
      qiMod: 1
    };
    state.flags.add(teaShedVisitFlag(state.day));
    state.flags.add(greenhouseVisitFlag(state.day));

    expect(participateFestival(state, ctx)).toMatchObject({ ok: true, eventId: 'event.spring-festival' });
    expect(locationWorldPreviewPlacements(state)).toContainEqual({
      locationId: 'tea-shed',
      assetId: 'loc.tea-shed',
      serviceAssetId: locationServiceActorAssetId('show-tea-shed'),
      x: 2,
      y: 7,
      npcCount: 1,
      birthday: false,
      hasQuest: false,
      questReady: false,
      serviceReady: false,
      serviceDone: true,
      taskReady: false
    });
    expect(locationWorldPreviewPlacements(state)).toContainEqual({
      locationId: 'greenhouse',
      assetId: 'loc.greenhouse',
      serviceAssetId: locationServiceActorAssetId('show-greenhouse'),
      x: 10,
      y: 7,
      npcCount: 1,
      birthday: false,
      hasQuest: false,
      questReady: false,
      serviceReady: false,
      serviceDone: true,
      taskReady: false
    });
    expect(locationWorldPreviewPlacements(state)).toContainEqual({
      locationId: 'festival-ground',
      assetId: 'loc.festival-ground',
      serviceAssetId: locationServiceActorAssetId('browse-festival-stall'),
      x: 11,
      y: 4,
      npcCount: 4,
      birthday: false,
      hasQuest: false,
      questReady: false,
      serviceReady: false,
      serviceDone: true,
      taskReady: false
    });
  });

  it('reuses the shared service actor mapping for world-layer location service badges', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 45, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.postAscension.mode = 'stayed-in-world';
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春祭',
      daysLeft: 2,
      growthMod: 1,
      qiMod: 1
    };

    expect(findLocationPlacement(state, 'tea-shed')?.serviceAssetId).toBe(locationServiceActorAssetId('show-tea-shed'));
    expect(findLocationPlacement(state, 'greenhouse')?.serviceAssetId).toBe(locationServiceActorAssetId('show-greenhouse'));
    expect(findLocationPlacement(state, 'festival-ground')?.serviceAssetId).toBe(locationServiceActorAssetId('browse-festival-stall'));
  });
});
