import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE, FIRST_SECOND_WATER_FLAG } from '@sim';
import { createLayers, drawWorld, type RuntimeRenderAssets } from '@render/renderer';
import { npcWorldPreviewPlacements } from '@render/npcWorldPreview';
import type { Application } from 'pixi.js';

function createFakeApplication(): Application {
  return {
    stage: new Container(),
    screen: { width: 960, height: 540 }
  } as unknown as Application;
}

function textureMap(defaultTexture: Texture, overrides: Readonly<Record<string, Texture>> = {}): Partial<Record<string, Texture>> {
  const entries: Record<string, Texture> = { ...overrides };
  return new Proxy(entries, {
    get(target, property) {
      if (typeof property !== 'string') return Reflect.get(target, property);
      return target[property] ?? defaultTexture;
    }
  });
}

function createRenderAssets(): {
  assets: RuntimeRenderAssets;
  dryingRack: Texture;
  herbGatherer: Texture;
  marketMerchant: Texture;
  sealingCabinet: Texture;
} {
  const fallback = new Texture({ source: Texture.EMPTY.source });
  const dryingRack = new Texture({ source: Texture.EMPTY.source });
  const herbGatherer = new Texture({ source: Texture.EMPTY.source });
  const marketMerchant = new Texture({ source: Texture.EMPTY.source });
  const sealingCabinet = new Texture({ source: Texture.EMPTY.source });
  return {
    assets: {
      player: fallback,
      guardBeast: fallback,
      guardBeastVariants: textureMap(fallback),
      cropHerbs: textureMap(fallback),
      cropSeeds: textureMap(fallback),
      facilities: textureMap(fallback, {
        'drying-rack': dryingRack,
        'sealing-cabinet': sealingCabinet
      }),
      locations: textureMap(fallback),
      logos: textureMap(fallback),
      hotbarIcons: textureMap(fallback),
      itemIcons: textureMap(fallback),
      npcs: textureMap(fallback, {
        'sprite.npc.herb-gatherer': herbGatherer,
        'sprite.npc.market-merchant': marketMerchant
      }),
      tiles: textureMap(fallback)
    },
    dryingRack,
    herbGatherer,
    marketMerchant,
    sealingCabinet
  };
}

function captureChildrenByLabel(container: Container): Map<string, Container['children'][number]> {
  const entries = container.children.map(child => {
    if (!child.label) throw new Error('Retained world children must have stable labels.');
    return [child.label, child] as const;
  });
  return new Map(entries);
}

function createRetentionFixture() {
  const content = buildRegistry();
  const state = createWorld({ seed: 8_041, width: 14, height: 9, content, params: DEFAULT_BALANCE });
  const cropId = 80_042;
  const cropTile = state.tiles[0]!;
  cropTile.cropId = cropId;
  state.crops.set(cropTile.id, {
    id: cropId,
    defId: 'herb.mossling',
    tileId: cropTile.id,
    growth: 0,
    health: 100_000,
    stage: 'seed',
    plantedDay: state.day,
    property: { cold: 0, hot: 0, warm: 0, neutral: 10_000 },
    tempered: false
  });

  const facilityId = 80_043;
  state.facilities.set(facilityId, {
    id: facilityId,
    kind: 'drying-rack',
    tileId: state.tiles[1]!.id,
    job: null
  });

  return { content, state, cropId, facilityId };
}

describe('renderer retained world objects', () => {
  it('hides every world semantic layer on game over and restores the world afterwards', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state } = createRetentionFixture();
    const { assets } = createRenderAssets();

    drawWorld(layers, state, content, undefined, assets);
    expect(layers.worldRoot.visible).toBe(true);

    state.gameOver = true;
    drawWorld(layers, state, content, undefined, assets);
    expect(layers.worldRoot.visible).toBe(false);

    state.gameOver = false;
    drawWorld(layers, state, content, undefined, assets);
    expect(layers.worldRoot.visible).toBe(true);
  });

  it('preserves every labeled tile and scene display object across identical draws', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state, cropId, facilityId } = createRetentionFixture();
    const { assets } = createRenderAssets();

    drawWorld(layers, state, content, undefined, assets);
    const firstTiles = captureChildrenByLabel(layers.tileSprites);
    const firstScene = captureChildrenByLabel(layers.sceneSprites);

    expect(firstTiles.get('world:tile:0')).toBeInstanceOf(Sprite);
    expect(firstScene.get(`world:crop:${cropId}`)).toBeInstanceOf(Sprite);
    expect(firstScene.get(`world:facility:${facilityId}`)).toBeInstanceOf(Sprite);
    const npcLabels = [...firstScene.keys()].filter(key => key.startsWith('world:npc:'));
    expect(npcLabels).toHaveLength(npcWorldPreviewPlacements(state).length);
    expect(new Set(npcLabels).size).toBe(npcLabels.length);

    drawWorld(layers, state, content, undefined, assets);

    expect(captureChildrenByLabel(layers.tileSprites).size).toBe(firstTiles.size);
    expect(captureChildrenByLabel(layers.sceneSprites).size).toBe(firstScene.size);
    for (const [label, child] of firstTiles) expect(layers.tileSprites.getChildByLabel(label)).toBe(child);
    for (const [label, child] of firstScene) expect(layers.sceneSprites.getChildByLabel(label)).toBe(child);
  });

  it('updates a retained facility in place and destroys it only after removal', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state, facilityId } = createRetentionFixture();
    const { assets, dryingRack, sealingCabinet } = createRenderAssets();
    const label = `world:facility:${facilityId}`;

    drawWorld(layers, state, content, undefined, assets);
    const retained = layers.sceneSprites.getChildByLabel(label);
    expect(retained).toBeInstanceOf(Sprite);
    if (!(retained instanceof Sprite)) throw new Error('Expected a retained facility Sprite.');
    expect(retained.texture).toBe(dryingRack);
    const firstX = retained.x;
    const firstCount = layers.sceneSprites.children.length;

    const facility = state.facilities.get(facilityId)!;
    facility.kind = 'sealing-cabinet';
    facility.tileId = state.tiles[2]!.id;
    drawWorld(layers, state, content, undefined, assets);

    expect(layers.sceneSprites.getChildByLabel(label)).toBe(retained);
    expect(retained.texture).toBe(sealingCabinet);
    expect(retained.x).not.toBe(firstX);
    expect(retained.destroyed).toBe(false);

    state.facilities.delete(facilityId);
    drawWorld(layers, state, content, undefined, assets);

    expect(layers.sceneSprites.getChildByLabel(label)).toBeNull();
    expect(layers.sceneSprites.children).toHaveLength(firstCount - 1);
    expect(retained.destroyed).toBe(true);
  });

  it('retains the same scheduled NPC object when the NPC moves between seasonal locations', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state } = createRetentionFixture();
    const { assets, herbGatherer } = createRenderAssets();

    state.season = 'spring';
    state.seasonDay = 6;
    expect(npcWorldPreviewPlacements(state).find(placement => placement.npcId === 'npc.herb-gatherer')?.locationId).toBe('herb-plot');
    drawWorld(layers, state, content, undefined, assets);

    const springMatches = layers.sceneSprites.children.filter(child => child instanceof Sprite && child.texture === herbGatherer);
    expect(springMatches).toHaveLength(1);
    const retained = springMatches[0]!;
    const springX = retained.x;
    const springY = retained.y;

    state.season = 'summer';
    state.seasonDay = 8;
    expect(npcWorldPreviewPlacements(state).find(placement => placement.npcId === 'npc.herb-gatherer')?.locationId).toBe('creek-field');
    drawWorld(layers, state, content, undefined, assets);

    const summerMatches = layers.sceneSprites.children.filter(child => child instanceof Sprite && child.texture === herbGatherer);
    expect(summerMatches).toHaveLength(1);
    expect(summerMatches[0]).toBe(retained);
    expect(retained.destroyed).toBe(false);
    expect({ x: retained.x, y: retained.y }).not.toEqual({ x: springX, y: springY });
  });

  it('retains NPC markers above portrait sprites across identical draws', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state } = createRetentionFixture();
    const { assets } = createRenderAssets();
    state.season = 'summer';
    state.seasonDay = 8;
    state.social['npc.herb-gatherer'] = { affection: 160, lastGiftDay: 0 };
    state.flags.add('rel-event:herb-gatherer-160');
    state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 4 };
    state.player.inventory['herb.mistfern'] = { itemId: 'herb.mistfern', count: 2 };
    state.player.bodyFoundation = 1200;
    expect(npcWorldPreviewPlacements(state).find(placement => placement.npcId === 'npc.herb-gatherer')).toMatchObject({ birthday: true, hasQuest: true, questReady: true });

    drawWorld(layers, state, content, undefined, assets);
    const npcLabel = 'world:npc:scheduled:npc.herb-gatherer';
    const markerLabel = `${npcLabel}:marker`;
    const npc = layers.sceneSprites.getChildByLabel(npcLabel);
    const marker = layers.npcMarkers.getChildByLabel(markerLabel);

    expect(npc).toBeInstanceOf(Sprite);
    expect(marker).toBeInstanceOf(Graphics);
    expect(layers.worldRoot.getChildIndex(layers.npcMarkers)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.sceneSprites));

    drawWorld(layers, state, content, undefined, assets);

    expect(layers.sceneSprites.getChildByLabel(npcLabel)).toBe(npc);
    expect(layers.npcMarkers.getChildByLabel(markerLabel)).toBe(marker);
  });

  it('inserts a newly visible middle-category sprite without replacing or misordering retained siblings', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state, facilityId } = createRetentionFixture();
    const { assets } = createRenderAssets();
    const facilityLabel = `world:facility:${facilityId}`;

    drawWorld(layers, state, content, undefined, assets);
    const retainedFacility = layers.sceneSprites.getChildByLabel(facilityLabel);
    const retainedLocation = layers.sceneSprites.children.find(child => /^world:location:[^:]+$/.test(child.label));
    const retainedPlayer = layers.sceneSprites.getChildByLabel('world:player');
    expect(retainedFacility).toBeInstanceOf(Sprite);
    expect(retainedLocation).toBeInstanceOf(Sprite);
    expect(retainedPlayer).toBeInstanceOf(Sprite);

    state.facilities.get(facilityId)!.job = {
      inputItemId: 'herb.mossling',
      outputItemId: 'item.dried-herb',
      outputCount: 1,
      daysRemaining: 0
    };
    drawWorld(layers, state, content, undefined, assets);

    const badgeLabel = `${facilityLabel}:badge`;
    const labels = layers.sceneSprites.children.map(child => child.label);
    expect(layers.sceneSprites.getChildByLabel(facilityLabel)).toBe(retainedFacility);
    expect(layers.sceneSprites.children.find(child => child.label === retainedLocation?.label)).toBe(retainedLocation);
    expect(layers.sceneSprites.getChildByLabel('world:player')).toBe(retainedPlayer);
    expect(labels.indexOf(facilityLabel)).toBeLessThan(labels.indexOf(badgeLabel));
    expect(labels.indexOf(badgeLabel)).toBeLessThan(labels.indexOf(retainedLocation!.label));
  });

  it('keeps an existing ambient NPC stable when a newly sorted placement uses the same art', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state } = createRetentionFixture();
    const { assets, marketMerchant } = createRenderAssets();

    state.season = 'spring';
    state.seasonDay = 6;
    state.player.flags.add(FIRST_SECOND_WATER_FLAG);
    const initialPlacements = npcWorldPreviewPlacements(state).filter(placement => placement.assetId === 'sprite.npc.market-merchant');
    expect(initialPlacements.map(placement => placement.locationId)).toEqual(['valley-market']);
    drawWorld(layers, state, content, undefined, assets);

    const initialMatches = layers.sceneSprites.children.filter(child => child instanceof Sprite && child.texture === marketMerchant && child.label.startsWith('world:npc:'));
    expect(initialMatches).toHaveLength(1);
    const retained = initialMatches[0]!;
    const initialPosition = { x: retained.x, y: retained.y };

    state.activeEvent = {
      defId: 'event.spring-festival',
      displayName: '春祭',
      daysLeft: 2,
      growthMod: 1,
      qiMod: 1
    };
    const festivalPlacements = npcWorldPreviewPlacements(state).filter(placement => placement.assetId === 'sprite.npc.market-merchant');
    expect(festivalPlacements.map(placement => placement.locationId)).toEqual(['festival-ground', 'valley-market']);
    drawWorld(layers, state, content, undefined, assets);

    const festivalMatches = layers.sceneSprites.children.filter(child => child instanceof Sprite && child.texture === marketMerchant && child.label.startsWith('world:npc:'));
    expect(festivalMatches).toHaveLength(2);
    expect(festivalMatches).toContain(retained);
    expect(retained.destroyed).toBe(false);
    expect({ x: retained.x, y: retained.y }).toEqual(initialPosition);
    expect(festivalMatches.find(sprite => sprite !== retained)).toBeInstanceOf(Sprite);
  });

  it('retains distinct array instances sharing a tile and destroys only the removed instance', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state } = createRetentionFixture();
    const { assets } = createRenderAssets();
    const firstId = 90_041;
    const secondId = 90_042;
    const coreTileId = state.tiles[5]!.id;
    state.arrays.set(firstId, {
      id: firstId,
      defId: 'array.lightning-rod',
      modifier: 4,
      coreTileId,
      coverageTileIds: [coreTileId],
      power: 100,
      active: true
    });
    state.arrays.set(secondId, {
      id: secondId,
      defId: 'array.insulation',
      modifier: 0.3,
      coreTileId,
      coverageTileIds: [coreTileId],
      power: 100,
      active: true
    });

    drawWorld(layers, state, content, undefined, assets);
    const firstLabel = `world:array:${firstId}`;
    const secondLabel = `world:array:${secondId}`;
    const first = layers.sceneSprites.getChildByLabel(firstLabel);
    const second = layers.sceneSprites.getChildByLabel(secondLabel);
    expect(first).toBeInstanceOf(Sprite);
    expect(second).toBeInstanceOf(Sprite);
    expect(first).not.toBe(second);

    state.arrays.get(firstId)!.active = false;
    state.arrays.get(firstId)!.power = 0;
    state.arrays.get(secondId)!.power = 50;
    drawWorld(layers, state, content, undefined, assets);
    expect(layers.sceneSprites.getChildByLabel(firstLabel)).toBe(first);
    expect(layers.sceneSprites.getChildByLabel(secondLabel)).toBe(second);

    state.arrays.delete(firstId);
    drawWorld(layers, state, content, undefined, assets);
    expect(layers.sceneSprites.getChildByLabel(firstLabel)).toBeNull();
    expect(layers.sceneSprites.getChildByLabel(secondLabel)).toBe(second);
    expect(first?.destroyed).toBe(true);
    expect(second?.destroyed).toBe(false);
  });

  it('keeps an existing array object when a newly inserted array sorts before it', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const { content, state } = createRetentionFixture();
    const { assets } = createRenderAssets();
    const existingId = 91_042;
    const insertedId = 91_041;
    const coreTileId = state.tiles[5]!.id;
    state.arrays.set(existingId, {
      id: existingId,
      defId: 'array.insulation',
      modifier: 0.3,
      coreTileId,
      coverageTileIds: [coreTileId],
      power: 100,
      active: true
    });

    drawWorld(layers, state, content, undefined, assets);
    const existingLabel = `world:array:${existingId}`;
    const existing = layers.sceneSprites.getChildByLabel(existingLabel);
    expect(existing).toBeInstanceOf(Sprite);

    state.arrays.set(insertedId, {
      id: insertedId,
      defId: 'array.lightning-rod',
      modifier: 4,
      coreTileId,
      coverageTileIds: [coreTileId],
      power: 100,
      active: true
    });
    drawWorld(layers, state, content, undefined, assets);

    const insertedLabel = `world:array:${insertedId}`;
    const labels = layers.sceneSprites.children.map(child => child.label);
    expect(layers.sceneSprites.getChildByLabel(existingLabel)).toBe(existing);
    expect(layers.sceneSprites.getChildByLabel(insertedLabel)).toBeInstanceOf(Sprite);
    expect(labels.indexOf(insertedLabel)).toBeLessThan(labels.indexOf(existingLabel));
    expect(existing?.destroyed).toBe(false);
  });
});
