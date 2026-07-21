import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE, type GameState } from '@sim';
import { endingCgAssetId, renderEndingSurface } from '@app/endingSurface';

function stateWithEnding(ending: string): GameState {
  const reg = buildRegistry();
  const state = createWorld({ seed: 99, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  state.ending = ending;
  state.gameOver = true;
  state.day = 42;
  state.year = 2;
  return state;
}

describe('ending surface', () => {
  it('maps registered terminal branches to DOM CG asset ids', () => {
    expect(endingCgAssetId('ascension')).toBe('cg.ending-ascension');
    expect(endingCgAssetId('lifespan-death')).toBe('cg.ending-lifespan-death');
    expect(endingCgAssetId('poison-death')).toBe('cg.ending-poison-death');
    expect(endingCgAssetId('tribulation-death')).toBeUndefined();
  });

  it('renders an ending CG through the asset resolver without reviving the Pixi pipeline', () => {
    const html = renderEndingSurface({
      state: stateWithEnding('ascension'),
      endingStatus: '终局存档已成功保留',
      assetUrlForId: id => `resolved/${id}.png`
    });

    expect(html).toContain('ending-result-with-cg');
    expect(html).toContain('data-asset-id="cg.ending-ascension"');
    expect(html).toContain('resolved/cg.ending-ascension.png');
    expect(html).toContain('白日飞升');
    expect(html).toContain('第 42 日 · 2 年');
    expect(html).toContain('终局存档已成功保留');
  });

  it('keeps text readable when a branch has no registered CG yet', () => {
    const html = renderEndingSurface({
      state: stateWithEnding('madness'),
      endingStatus: '本次终局尚未写入本地存档。',
      assetUrlForId: id => `resolved/${id}.png`
    });

    expect(html).toContain('ending-result-no-cg');
    expect(html).toContain('终局留影待补');
    expect(html).toContain('走火入魔');
    expect(html).not.toContain('<img');
  });
});
