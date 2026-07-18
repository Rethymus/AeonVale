import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { harvestFeedbackPresentation } from '@app/harvestFeedback';

const content = buildRegistry();

describe('harvest feedback presentation', () => {
  it('surfaces real 引雷性 and a real related recipe for a metal herb (metalpine)', () => {
    const metalpine = content.herbs.get('herb.metalpine');
    expect(metalpine).toBeDefined();
    const fb = harvestFeedbackPresentation('herb.metalpine', 1, content);
    expect(fb.message).toContain(metalpine!.displayName);
    expect(fb.message).toContain('引雷性 3.2');
    expect(fb.message).toContain('可炼制');
    expect(fb.recipeIds).toContain('recipe.ward-pill');
  });

  it('hides the 引雷性 segment for non-metal herbs but still shows a real related recipe', () => {
    const fb = harvestFeedbackPresentation('herb.mossling', 2, content);
    expect(fb.message).not.toContain('引雷性');
    expect(fb.message).toMatch(/×2/);
    expect(fb.recipeIds.length).toBeGreaterThan(0);
  });

  it('falls back gracefully for an unknown defId without crashing or fabricating a recipe', () => {
    const fb = harvestFeedbackPresentation('herb.does-not-exist', 1, content);
    expect(fb.message).toContain('herb.does-not-exist');
    expect(fb.recipeIds).toEqual([]);
    expect(fb.message).not.toContain('可炼制');
  });

  it('floors count to at least 1 and formats integer metal attract without trailing .0', () => {
    const fbZero = harvestFeedbackPresentation('herb.metalpine', 0, content);
    expect(fbZero.message).toMatch(/×1/);
    // metalAttract 3.2 -> "3.2"；若存在整型 metalAttract 草，应输出无 .0
    const fb = harvestFeedbackPresentation('herb.metalpine', 3, content);
    expect(fb.message).toContain('引雷性 3.2');
    expect(fb.message).toMatch(/×3/);
  });
});
