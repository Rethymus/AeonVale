import { describe, expect, it } from 'vitest';
import { Container, type Application } from 'pixi.js';
import { createLayers, spawnFloatText, updateFloatTexts } from '@render/renderer';

function createFakeApplication(): Application {
  return {
    stage: new Container(),
    screen: { width: 960, height: 540 }
  } as unknown as Application;
}

describe('float text juice', () => {
  it('spawnFloatText queues labels and updateFloatTexts advances then expires them', () => {
    const layers = createLayers(createFakeApplication());
    spawnFloatText(layers, 100, 200, '收获', 0xffe066);
    expect(layers.floatTexts).toHaveLength(1);
    expect(layers.floatTexts[0]).toMatchObject({ text: '收获', x: 100, y: 200 });
    updateFloatTexts(layers);
    expect(layers.floatTextLayer.children).toHaveLength(1);
    const y0 = layers.floatTexts[0]!.y;
    updateFloatTexts(layers);
    expect(layers.floatTexts[0]!.y).toBeLessThan(y0);
    // 跑完寿命
    for (let i = 0; i < 50; i++) updateFloatTexts(layers);
    expect(layers.floatTexts).toHaveLength(0);
    expect(layers.floatTextLayer.children).toHaveLength(0);
  });

  it('caps active float texts to avoid unbounded growth', () => {
    const layers = createLayers(createFakeApplication());
    for (let i = 0; i < 40; i++) spawnFloatText(layers, i, i, `t${i}`);
    expect(layers.floatTexts.length).toBeLessThanOrEqual(25);
  });
});
