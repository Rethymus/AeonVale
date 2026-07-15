import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { furnacePanelIconEntries } from '@render/furnacePanel';

describe('furnace panel icon entries', () => {
 it('returns output pill icon followed by herb input icons', () => {
 const reg = buildRegistry();
 const recipe = reg.recipes.get('recipe.ward-pill');

expect(recipe).toBeDefined;

const entries = furnacePanelIconEntries(recipe!, reg);

expect(entries[0]).toEqual({
 itemId: recipe!.outputPillId,
 iconId: 'icon.pill.ward-basic',
 count: 1,
 slot: 'output',
 });
 expect(entries.slice(1)).toEqual(
 recipe!.inputs.map((input) => ({
 itemId: input.herbId,
 iconId: `icon.herb.${input.herbId.slice('herb.'.length)}`,
 count: input.qty,
 slot: 'input',
 })),
 );
 });

it('skips inputs whose icon asset id cannot be resolved', () => {
 const reg = buildRegistry();
 const recipe = {
 id: 'recipe.test-missing-icons',
 displayName: '缺图测试丹',
 inputs: [{ herbId: 'unknown.herb', qty: 2 }, { herbId: 'herb.dewroot', qty: 1 }],
 idealHeatRange: [20_000, 40_000] as [number, number],
 targetProperty: { cold: 1000, hot: 1000, warm: 1000, neutral: 1000 },
 outputPillId: 'unknown.pill',
 difficulty: 1,
 reveal: 'known' as const,
 };

const entries = furnacePanelIconEntries(recipe, reg);

expect(entries).toEqual([
 {
 itemId: 'herb.dewroot',
 iconId: 'icon.herb.dewroot',
 count: 1,
 slot: 'input',
 },
 ]);
 });
});
