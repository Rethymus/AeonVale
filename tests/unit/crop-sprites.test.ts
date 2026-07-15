import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { collectProceduralCropSpriteSpecs, inferHerbVisualElement } from '@app/cropSprites';

describe('crop sprite helpers', () => {
 it('infers the dominant property axis as the visual element', () => {
 expect(inferHerbVisualElement({ cold: 5_000, hot: 0, warm: 0, neutral: 0 })).toBe('cold');
 expect(inferHerbVisualElement({ cold: 0, hot: 4_000, warm: 1_000, neutral: 0 })).toBe('hot');
 expect(inferHerbVisualElement({ cold: 0, hot: 0, warm: 6_000, neutral: 2_000 })).toBe('warm');
 expect(inferHerbVisualElement({ cold: 0, hot: 0, warm: 0, neutral: 3_000 })).toBe('neutral');
 });

it('falls back to qi for ties or empty properties', () => {
 expect(inferHerbVisualElement({ cold: 2_000, hot: 2_000, warm: 0, neutral: 0 })).toBe('qi');
 expect(inferHerbVisualElement({ cold: 0, hot: 0, warm: 0, neutral: 0 })).toBe('qi');
 });

it('collects one procedural sprite spec per herb in the registry', () => {
 const reg = buildRegistry();
 const specs = collectProceduralCropSpriteSpecs(reg);

expect(specs.length).toBe(reg.herbs.size);
 expect(specs).toContainEqual({
 herbId: 'herb.mossling',
 seedId: 'seed.mossling',
 tier: 1,
 element: 'neutral',
 });
 expect(specs).toContainEqual({
 herbId: 'herb.griefvein',
 seedId: 'seed.griefvein',
 tier: 3,
 element: 'cold',
 });
 expect(specs).toContainEqual({
 herbId: 'herb.boneash-lily',
 seedId: 'seed.boneash-lily',
 tier: 4,
 element: 'qi',
 });
 });
});
