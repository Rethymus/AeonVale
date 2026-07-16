import { Texture } from 'pixi.js';
import type { ContentRegistry, SpiritHerbDef } from '@content/defs';
import type { PropertyVector } from '@sim/world/types';
import { generateHerbSprite, generateSeedSprite, toRgba, type HerbSpriteOptions } from '@render/sprites';

export type HerbVisualElement = NonNullable<HerbSpriteOptions['element']>;

export interface ProceduralCropTextureSet {
  herbs: Partial<Record<string, Texture>>;
  seeds: Partial<Record<string, Texture>>;
}

export interface ProceduralCropSpriteSpec {
  herbId: string;
  seedId: string;
  tier: SpiritHerbDef['tier'];
  element: HerbVisualElement;
}

const PROPERTY_KEYS = ['cold', 'hot', 'warm', 'neutral'] as const;

export function inferHerbVisualElement(property: PropertyVector): HerbVisualElement {
  let best: (typeof PROPERTY_KEYS)[number] = PROPERTY_KEYS[0];
  let bestValue = property[best];
  let ties = 1;
  for (let i = 1; i < PROPERTY_KEYS.length; i++) {
    const key = PROPERTY_KEYS[i]!;
    const value = property[key];
    if (value > bestValue) {
      best = key;
      bestValue = value;
      ties = 1;
      continue;
    }
    if (value === bestValue) ties += 1;
  }
  if (bestValue <= 0 || ties > 1) return 'qi';
  return best;
}

export function collectProceduralCropSpriteSpecs(content: ContentRegistry): ProceduralCropSpriteSpec[] {
  return Array.from(content.herbs.values()).map(herb => ({
    herbId: herb.id,
    seedId: herb.seedId,
    tier: herb.tier,
    element: inferHerbVisualElement(herb.baseProperty)
  }));
}

function textureFromPixels(width: number, height: number, rgba: Uint8ClampedArray): Texture | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const imageBytes = new Uint8ClampedArray(rgba.length);
  imageBytes.set(rgba);
  ctx.putImageData(new ImageData(imageBytes, width, height), 0, 0);
  return Texture.from(canvas);
}

export function buildProceduralCropTextures(content: ContentRegistry): ProceduralCropTextureSet {
  const herbs: Partial<Record<string, Texture>> = {};
  const seeds: Partial<Record<string, Texture>> = {};
  for (const spec of collectProceduralCropSpriteSpecs(content)) {
    const herbPixels = generateHerbSprite({ id: spec.herbId, tier: spec.tier, element: spec.element });
    const seedPixels = generateSeedSprite({ id: spec.seedId, element: spec.element });
    const herbTexture = textureFromPixels(herbPixels.width, herbPixels.height, toRgba(herbPixels));
    const seedTexture = textureFromPixels(seedPixels.width, seedPixels.height, toRgba(seedPixels));
    if (herbTexture) herbs[spec.herbId] = herbTexture;
    if (seedTexture) seeds[spec.seedId] = seedTexture;
  }
  return { herbs, seeds };
}
