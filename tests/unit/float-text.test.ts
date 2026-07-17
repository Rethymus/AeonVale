import { describe, expect, it } from 'vitest';
import { Container, Text, type Application } from 'pixi.js';
import { createLayers, spawnFloatText, updateFloatTexts } from '@render/renderer';

function createFakeApplication(): Application {
  return {
    stage: new Container(),
    screen: { width: 960, height: 540 }
  } as unknown as Application;
}

describe('float text juice', () => {
  it('spawnFloatText holds (no rise, full alpha, punch) then rises and expires', () => {
    const layers = createLayers(createFakeApplication());
    spawnFloatText(layers, 100, 200, '收获', 0xffe066);
    expect(layers.floatTexts).toHaveLength(1);
    expect(layers.floatTexts[0]).toMatchObject({ text: '收获', x: 100, y: 200 });
    const y0 = layers.floatTexts[0]!.y;
    // 定格期：前 18 帧不上飘、alpha 满值、punch 放大（让玩家读清动作反馈）
    for (let i = 0; i < 18; i++) updateFloatTexts(layers);
    const held = layers.floatTextLayer.children[0] as unknown as Text;
    expect(layers.floatTextLayer.children).toHaveLength(1);
    expect(layers.floatTexts[0]!.y).toBe(y0);
    expect(held.alpha).toBe(1);
    expect(held.scale.x).toBeGreaterThan(1);
    // 定格结束后开始上飘
    updateFloatTexts(layers);
    updateFloatTexts(layers);
    expect(layers.floatTexts[0]!.y).toBeLessThan(y0);
    // 跑完寿命（定格 + 上飘淡出）
    for (let i = 0; i < 80; i++) updateFloatTexts(layers);
    expect(layers.floatTexts).toHaveLength(0);
    expect(layers.floatTextLayer.children).toHaveLength(0);
  });

  it('caps active float texts to avoid unbounded growth', () => {
    const layers = createLayers(createFakeApplication());
    for (let i = 0; i < 40; i++) spawnFloatText(layers, i, i, `t${i}`);
    expect(layers.floatTexts.length).toBeLessThanOrEqual(25);
  });
});
