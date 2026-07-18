import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import { briefingBoxHeight, createLayers, facilityWorldBadgeAssetId, farmsteadPropBadgeAssetId, isBriefingHeroAsset, itemPreviewBoxHeight, locationPreviewBoxHeight, locationWorldBadgeLayout, locationServiceWorldBadgeAssetId, locationTaskWorldBadgeAssetId, LOGICAL_RENDER_REGIONS, RENDER_ROOT_LABELS, screenPointForTile, setTextIfChanged, TILE } from '@render/renderer';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { createFurnaceLayer } from '@render/furnacePanel';

function createFakeApplication(): Application {
  return {
    stage: new Container(),
    screen: { width: 960, height: 540 }
  } as unknown as Application;
}

describe('renderer layout sizing', () => {
  it('groups the retained render API into five stable attention roots', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);

    expect(app.stage.children).toEqual([layers.worldRoot, layers.screenFxRoot, layers.hudRoot, layers.focusRoot, layers.toastRoot]);
    expect(app.stage.children.map(child => child.label)).toEqual(Object.values(RENDER_ROOT_LABELS));
    expect(layers.worldRoot.children).toEqual([layers.tiles, layers.tileSprites, layers.terrainSemanticOverlay, layers.qiFlow, layers.entities, layers.sceneSprites, layers.npcMarkers]);
    expect(layers.worldRoot.getChildIndex(layers.terrainSemanticOverlay)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.tileSprites));
    expect(layers.worldRoot.getChildIndex(layers.qiFlow)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.terrainSemanticOverlay));
    expect(layers.worldRoot.getChildIndex(layers.qiFlow)).toBeLessThan(layers.worldRoot.getChildIndex(layers.entities));
    expect(layers.worldRoot.getChildIndex(layers.npcMarkers)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.sceneSprites));
    expect(layers.screenFxRoot.children).toEqual([layers.seasonTint, layers.particles, layers.floatTextLayer, layers.tribFlash]);
    expect(layers.hudRoot.children).toEqual([layers.hotbarIconBg, layers.hotbarIcon, layers.hud, layers.briefingBg, layers.briefingImage, layers.briefingIcon, layers.briefing, layers.help, layers.hotbar, layers.bars, ...layers.barLabels]);
    expect(layers.focusRoot.children).toEqual([layers.panelPreviewBg, layers.panelPreviewIcon, layers.panelPreviewText, layers.locationPreviewBg, layers.locationPreviewImage, layers.locationPreviewNpcPrimary, layers.locationPreviewNpcSecondary, layers.locationPreviewText, layers.ending, layers.inv, layers.invIcons, layers.cultivation, layers.dialogueBg, layers.dialoguePortrait, layers.dialogue]);
    expect(layers.toastRoot.children).toEqual([layers.toastIconBg, layers.toastIcon, layers.toast]);
  });

  it('attaches the furnace to focusRoot without changing the existing factory call', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const furnace = createFurnaceLayer(app);

    expect(furnace.container.parent).toBe(layers.focusRoot);
    expect(furnace.icons.parent).toBe(layers.focusRoot);
    expect(furnace.lines.parent).toBe(layers.focusRoot);
    expect(app.stage.children).toHaveLength(5);
  });

  it('prefers an explicit furnace parent over the labeled focus root', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    const parent = new Container();
    const furnace = createFurnaceLayer(app, parent);

    expect(parent.children).toEqual([furnace.container, furnace.icons, furnace.lines]);
    expect(layers.focusRoot.children).not.toContain(furnace.container);
    expect(app.stage.children).toHaveLength(5);
  });

  it('falls back to the stage when no focus root exists', () => {
    const app = createFakeApplication();
    const furnace = createFurnaceLayer(app);

    expect(app.stage.children).toEqual([furnace.container, furnace.icons, furnace.lines]);
  });

  it('does not assign canvas text when the rendered value is unchanged', () => {
    let value = '稳定文本';
    let writes = 0;
    const target = {
      get text() {
        return value;
      },
      set text(next: string) {
        writes += 1;
        value = next;
      }
    };

    expect(setTextIfChanged(target, '稳定文本')).toBe(false);
    expect(writes).toBe(0);
    expect(setTextIfChanged(target, '新文本')).toBe(true);
    expect(writes).toBe(1);
    expect(value).toBe('新文本');
  });

  it('aligns the logical world and objective rail to the approved world-first proportions', () => {
    const layers = createLayers(createFakeApplication());
    const { content, world, objectiveRail } = LOGICAL_RENDER_REGIONS;
    const worldRatio = world.width / content.width;
    const railRatio = objectiveRail.width / content.width;
    const firstTileLeft = screenPointForTile(0, 0).x - TILE / 2;
    const lastTileRight = screenPointForTile(13, 0).x + TILE / 2;
    const worldRight = world.x + world.width;

    expect(worldRatio).toBeGreaterThanOrEqual(0.72);
    expect(worldRatio).toBeLessThanOrEqual(0.78);
    expect(railRatio).toBeGreaterThanOrEqual(0.22);
    expect(railRatio).toBeLessThanOrEqual(0.28);
    expect(worldRight).toBeLessThanOrEqual(objectiveRail.x);
    expect(firstTileLeft).toBeGreaterThanOrEqual(world.x);
    expect(lastTileRight).toBeLessThanOrEqual(worldRight);
    expect(Math.abs(firstTileLeft - world.x - (worldRight - lastTileRight))).toBeLessThanOrEqual(1);
    expect(layers.briefing.x).toBeGreaterThanOrEqual(objectiveRail.x);
    expect(layers.briefing.y).toBeGreaterThanOrEqual(objectiveRail.y);
    expect(layers.briefing.x + layers.briefing.style.wordWrapWidth).toBeLessThanOrEqual(objectiveRail.x + objectiveRail.width);
  });

  it('keeps today briefing at baseline height for short text and grows for denser copy', () => {
    expect(briefingBoxHeight(40)).toBe(70);
    expect(briefingBoxHeight(72)).toBe(88);
  });

  it('keeps item preview at baseline height for compact details and grows for logistics copy', () => {
    expect(itemPreviewBoxHeight(60)).toBe(112);
    expect(itemPreviewBoxHeight(94)).toBe(130);
  });

  it('grows location previews for route details without entering the bottom command area', () => {
    expect(locationPreviewBoxHeight(120)).toBe(206);
    expect(locationPreviewBoxHeight(260)).toBe(292);
    expect(locationPreviewBoxHeight(500)).toBe(370);
  });

  it('treats location, npc, and facility assets as hero art in today briefing', () => {
    expect(isBriefingHeroAsset('loc.farmstead')).toBe(true);
    expect(isBriefingHeroAsset('sprite.npc.herb-gatherer')).toBe(true);
    expect(isBriefingHeroAsset('facility.shipping-bin')).toBe(true);
    expect(isBriefingHeroAsset('tile.scorched')).toBe(true);
    expect(isBriefingHeroAsset('logo.full')).toBe(true);
    expect(isBriefingHeroAsset('logo.emblem')).toBe(true);
    expect(isBriefingHeroAsset('icon.herb.mossling')).toBe(false);
    expect(isBriefingHeroAsset('icon.item.rust-hoe')).toBe(false);
    expect(isBriefingHeroAsset()).toBe(false);
  });

  it('resolves finished facility world badges to manifest-backed item icons when available', () => {
    expect(facilityWorldBadgeAssetId('item.dried-herb')).toBe('icon.item.dried-herb');
    expect(facilityWorldBadgeAssetId('item.sealed-herb')).toBe('icon.item.sealed-herb');
    expect(facilityWorldBadgeAssetId('item.array-core')).toBe('icon.item.array-core');
    expect(facilityWorldBadgeAssetId('herb.mossling')).toBe('icon.herb.mossling');
    expect(facilityWorldBadgeAssetId).toBeUndefined;
  });

  it('resolves farmstead logistics props to manifest-backed item icons when data exists', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 77, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.shippingBin['item.dried-herb'] = 2;
    state.storage.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: 3 };

    expect(farmsteadPropBadgeAssetId(state, 'facility.shipping-bin')).toBe('icon.item.dried-herb');
    expect(farmsteadPropBadgeAssetId(state, 'facility.storage-chest')).toBe('icon.herb.mossling');
  });

  it('falls back for empty logistics props and can read quality bins', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 78, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    state.qualityShippingBin.spirit = { 'herb.dewroot': 1 };
    state.storage.qualityInventory.treasure = { 'herb.mistfern': 1 };

    expect(farmsteadPropBadgeAssetId(state, 'facility.shipping-bin')).toBe('icon.herb.dewroot');
    expect(farmsteadPropBadgeAssetId(state, 'facility.storage-chest')).toBe('icon.herb.mistfern');

    const emptyState = createWorld({ seed: 79, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    expect(farmsteadPropBadgeAssetId(emptyState, 'facility.shipping-bin')).toBeUndefined;
    expect(farmsteadPropBadgeAssetId(emptyState, 'facility.storage-chest')).toBeUndefined;
  });

  it('accepts icon-backed or facility-backed location task badges and ignores unrelated assets', () => {
    expect(locationTaskWorldBadgeAssetId('icon.herb.dewroot')).toBe('icon.herb.dewroot');
    expect(locationTaskWorldBadgeAssetId('icon.item.dried-herb')).toBe('icon.item.dried-herb');
    expect(locationTaskWorldBadgeAssetId('icon.item.array-core')).toBe('icon.item.array-core');
    expect(locationTaskWorldBadgeAssetId('facility.shipping-bin')).toBe('facility.shipping-bin');
    expect(locationTaskWorldBadgeAssetId('loc.ruin-gate')).toBeUndefined;
    expect(locationTaskWorldBadgeAssetId).toBeUndefined;
  });

  it('accepts service badges backed by npc portraits or icons and ignores location art', () => {
    expect(locationServiceWorldBadgeAssetId('sprite.npc.tea-shed-elder')).toBe('sprite.npc.tea-shed-elder');
    expect(locationServiceWorldBadgeAssetId('sprite.npc.market-merchant')).toBe('sprite.npc.market-merchant');
    expect(locationServiceWorldBadgeAssetId('icon.item.spirit-stone')).toBe('icon.item.spirit-stone');
    expect(locationServiceWorldBadgeAssetId('loc.greenhouse')).toBeUndefined;
    expect(locationServiceWorldBadgeAssetId).toBeUndefined;
  });

  it('separates service and task landmark badges when both are present on the same place', () => {
    expect(
      locationWorldBadgeLayout({
        hasBirthday: false,
        hasQuest: false,
        hasService: true,
        hasTask: true,
        npcCount: 1
      })
    ).toMatchObject({
      service: { x: 10, y: 32 },
      task: { x: 32, y: 32 }
    });
  });

  it('shifts task badge away from the crowd marker when both are present', () => {
    expect(
      locationWorldBadgeLayout({
        hasBirthday: false,
        hasQuest: false,
        hasService: false,
        hasTask: true,
        npcCount: 3
      })
    ).toMatchObject({
      crowd: { x: 27, y: 27 },
      task: { x: 23, y: 32 }
    });
  });
});
