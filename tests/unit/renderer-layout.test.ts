import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import {
  briefingBoxHeight,
  createLayers,
  cultivationSurfaceAlphaScale,
  drawLocationPreview,
  estimateLocationPreviewLineCount,
  facilityWorldBadgeAssetId,
  FARMSTEAD_PASSIVE_FARM_PLOT_ALPHA,
  farmsteadPropBadgeAssetId,
  farmsteadValleyCueState,
  isBriefingHeroAsset,
  itemPreviewBoxHeight,
  locationPreviewBoxHeight,
  locationPreviewEstimatedTextHeight,
  locationPreviewMaxTextHeight,
  locationPreviewMaxTextLines,
  locationPreviewTextContent,
  locationWorldBadgeLayout,
  locationServiceWorldBadgeAssetId,
  locationTaskWorldBadgeAssetId,
  LOGICAL_RENDER_REGIONS,
  PLAYER_MAP_SPRITE_ALPHA,
  RENDER_ROOT_LABELS,
  screenPointForTile,
  setTextIfChanged,
  setToast,
  TILE,
  tileCoordinatesFromScreenPoint,
  toastLayoutForText,
  TOAST_BOTTOM_UI_TOP
} from '@render/renderer';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { applyFarmsteadSceneLayout, firstFarmsteadFarmPlotTile } from '@app/farmsteadScene';

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
    expect(layers.worldRoot.children).toEqual([layers.tiles, layers.tileSprites, layers.terrainSemanticOverlay, layers.qiFlow, layers.entities, layers.sceneSprites, layers.characterOverlay, layers.npcMarkers]);
    expect(layers.worldRoot.getChildIndex(layers.terrainSemanticOverlay)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.tileSprites));
    expect(layers.worldRoot.getChildIndex(layers.qiFlow)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.terrainSemanticOverlay));
    expect(layers.worldRoot.getChildIndex(layers.qiFlow)).toBeLessThan(layers.worldRoot.getChildIndex(layers.entities));
    expect(layers.worldRoot.getChildIndex(layers.characterOverlay)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.sceneSprites));
    expect(layers.worldRoot.getChildIndex(layers.npcMarkers)).toBeGreaterThan(layers.worldRoot.getChildIndex(layers.characterOverlay));
    expect(layers.screenFxRoot.children).toEqual([layers.seasonTint, layers.particles, layers.floatTextLayer, layers.tribFlash]);
    expect(layers.hudRoot.children).toEqual([layers.hotbarIconBg, layers.hotbarIcon, layers.hud, layers.briefingBg, layers.briefingImage, layers.briefingIcon, layers.briefing, layers.help, layers.hotbar, layers.bars, ...layers.barLabels]);
    expect(layers.focusRoot.children).toEqual([layers.panelPreviewBg, layers.panelPreviewIcon, layers.panelPreviewText, layers.locationPreviewBg, layers.locationPreviewImage, layers.locationPreviewNpcPrimary, layers.locationPreviewNpcSecondary, layers.locationPreviewText, layers.ending, layers.inv, layers.invIcons, layers.cultivation, layers.dialogueBg, layers.dialoguePortrait, layers.dialogue]);
    expect(layers.toastRoot.children).toEqual([layers.toastIconBg, layers.toastIcon, layers.toast]);
  });

  it('lifts canvas toast above touch controls in compact landscape', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);

    setToast(layers, '修仙农庄开局');
    expect(layers.toast.y).toBe(416);
    expect(layers.toast.x).toBe(16);
    expect(layers.toast.style.wordWrapWidth).toBe(410);

    setToast(layers, '修仙农庄开局', undefined, 'compact-landscape');
    expect(layers.toast.y).toBe(288);
    expect(layers.toast.x).toBe(16);
    expect(layers.toast.style.wordWrapWidth).toBe(248);
  });

  it('raises long canvas toast above the bottom command reserve instead of letting it run under controls', () => {
    const shortToast = toastLayoutForText('修仙农庄开局', true);
    expect(shortToast.textY).toBe(416);
    expect(shortToast.bgY + shortToast.bgHeight).toBeLessThanOrEqual(TOAST_BOTTOM_UI_TOP);

    const longToast = toastLayoutForText('修仙农庄开局：灵草换灵石，灵石撑备劫。当前目标：先翻出一块地。'.repeat(7), true);
    expect(longToast.textY).toBeLessThan(shortToast.textY);
    expect(longToast.bgY + longToast.bgHeight).toBeLessThanOrEqual(TOAST_BOTTOM_UI_TOP);
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

  it('centers the playable board in the full canvas content while keeping the DOM rail contract', () => {
    const layers = createLayers(createFakeApplication());
    const { content, playfield, world, objectiveRail } = LOGICAL_RENDER_REGIONS;
    const worldRatio = world.width / content.width;
    const railRatio = objectiveRail.width / content.width;
    const firstTileLeft = screenPointForTile(0, 0).x - TILE / 2;
    const lastTileRight = screenPointForTile(13, 0).x + TILE / 2;
    const contentRight = content.x + content.width;

    expect(worldRatio).toBeGreaterThanOrEqual(0.72);
    expect(worldRatio).toBeLessThanOrEqual(0.78);
    expect(railRatio).toBeGreaterThanOrEqual(0.22);
    expect(railRatio).toBeLessThanOrEqual(0.28);
    expect(playfield.x).toBe(content.x);
    expect(playfield.width).toBe(content.width);
    expect(world.x + world.width).toBeLessThanOrEqual(objectiveRail.x);
    expect(firstTileLeft).toBeGreaterThanOrEqual(content.x);
    expect(lastTileRight).toBeLessThanOrEqual(contentRight);
    expect(Math.abs(firstTileLeft - content.x - (contentRight - lastTileRight))).toBeLessThanOrEqual(1);
    expect(layers.briefing.x).toBeGreaterThanOrEqual(objectiveRail.x);
    expect(layers.briefing.y).toBeGreaterThanOrEqual(objectiveRail.y);
    expect(layers.briefing.x + layers.briefing.style.wordWrapWidth).toBeLessThanOrEqual(objectiveRail.x + objectiveRail.width);
  });

  it('round-trips logical tile centers back to world coordinates for pointer targeting', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 1, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });

    expect(tileCoordinatesFromScreenPoint(state, screenPointForTile(8, 4))).toEqual({ x: 8, y: 4 });
    expect(tileCoordinatesFromScreenPoint(state, screenPointForTile(0, 0))).toEqual({ x: 0, y: 0 });
    expect(tileCoordinatesFromScreenPoint(state, { x: screenPointForTile(13, 8).x + TILE, y: screenPointForTile(13, 8).y })).toBeNull();
  });

  it('keeps passive farmstead herb plots quiet until the player targets or invests in them', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 20260710, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    applyFarmsteadSceneLayout(state, { resetHerbPlot: true });
    const point = firstFarmsteadFarmPlotTile(state);
    expect(point).not.toBeNull();
    const tile = state.tiles.find(entry => entry.x === point!.x && entry.y === point!.y)!;

    expect(cultivationSurfaceAlphaScale(state, tile, undefined)).toBe(FARMSTEAD_PASSIVE_FARM_PLOT_ALPHA);
    expect(cultivationSurfaceAlphaScale(state, tile, undefined, { pointerTile: point })).toBe(1);

    tile.tilled = true;
    expect(cultivationSurfaceAlphaScale(state, tile, undefined)).toBe(1);
  });

  it('keeps the generated world player sprite nearly opaque while leaving room for warm underlay bands', () => {
    expect(PLAYER_MAP_SPRITE_ALPHA).toBeGreaterThanOrEqual(0.92);
    expect(PLAYER_MAP_SPRITE_ALPHA).toBeLessThanOrEqual(0.95);
  });

  it('adds valley ambience to non-farm farmstead zones without decorating the herb plot', () => {
    const tile = { id: 42, x: 2, y: 1 };

    expect(farmsteadValleyCueState('herb-plot', tile)).toEqual({
      hasValleyCue: false,
      stoneAlpha: 0,
      pathBandAlpha: 0,
      grassAlpha: 0,
      mistAlpha: 0,
      workyardSparkAlpha: 0,
      homesteadFloorAlpha: 0
    });
    expect(farmsteadValleyCueState('wild', tile)).toMatchObject({
      hasValleyCue: true,
      grassAlpha: expect.any(Number),
      mistAlpha: expect.any(Number)
    });
    expect(farmsteadValleyCueState('gate', tile).pathBandAlpha).toBeGreaterThan(0);
    expect(farmsteadValleyCueState('courtyard', tile).stoneAlpha).toBeGreaterThan(0);
    expect(farmsteadValleyCueState('workyard', tile).workyardSparkAlpha).toBeGreaterThan(0);
    expect(farmsteadValleyCueState('homestead', tile).homesteadFloorAlpha).toBeGreaterThan(0);
    expect(farmsteadValleyCueState('wild', tile)).toEqual(farmsteadValleyCueState('wild', tile));
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

  it('clamps long location preview copy to the panel text budget', () => {
    const text = locationPreviewTextContent('山谷墟市', '今日人声很杂，散修摊位、药材行情、委托传闻和归谷路线都挤在一处。'.repeat(20), 144);
    expect(estimateLocationPreviewLineCount(text, 144)).toBeLessThanOrEqual(locationPreviewMaxTextLines());
    expect(text).toContain('…');
  });

  it('keeps rendered location preview text inside the max-height panel', () => {
    const app = createFakeApplication();
    const layers = createLayers(app);
    drawLocationPreview(layers, '山谷墟市', '今日人声很杂，散修摊位、药材行情、委托传闻和归谷路线都挤在一处。'.repeat(28));

    expect(layers.locationPreviewBg.visible).toBe(true);
    expect(layers.locationPreviewText.visible).toBe(true);
    expect(locationPreviewEstimatedTextHeight(layers.locationPreviewText.text, Number(layers.locationPreviewText.style.wordWrapWidth))).toBeLessThanOrEqual(locationPreviewMaxTextHeight());
    expect(locationPreviewBoxHeight(locationPreviewEstimatedTextHeight(layers.locationPreviewText.text, Number(layers.locationPreviewText.style.wordWrapWidth)))).toBeLessThanOrEqual(370);
  });

  it('treats location, npc, and facility assets as hero art in today briefing', () => {
    expect(isBriefingHeroAsset('loc.farmstead')).toBe(true);
    expect(isBriefingHeroAsset('sprite.npc.herb-gatherer')).toBe(true);
    expect(isBriefingHeroAsset('map-sprite.herb-gatherer-v1')).toBe(true);
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

  it('accepts service badges backed by npc/map sprites or icons and ignores location art', () => {
    expect(locationServiceWorldBadgeAssetId('sprite.npc.tea-shed-elder')).toBe('sprite.npc.tea-shed-elder');
    expect(locationServiceWorldBadgeAssetId('sprite.npc.market-merchant')).toBe('sprite.npc.market-merchant');
    expect(locationServiceWorldBadgeAssetId('map-sprite.market-merchant-v1')).toBe('map-sprite.market-merchant-v1');
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
