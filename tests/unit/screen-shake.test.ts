import { describe, expect, it } from 'vitest';
import { Container, type Application } from 'pixi.js';
import { createLayers, triggerShake } from '@render/renderer';

function createFakeApplication(): Application {
  return {
    stage: new Container(),
    screen: { width: 960, height: 540 }
  } as unknown as Application;
}

describe('world screen shake', () => {
  it('triggerShake sets ttl/magnitude; stronger shake wins magnitude and keeps longer ttl', () => {
    const layers = createLayers(createFakeApplication());
    expect(layers.shakeTtl).toBe(0);
    triggerShake(layers, 8, 3);
    expect(layers.shakeTtl).toBe(8);
    expect(layers.shakeMagnitude).toBe(3);
    triggerShake(layers, 4, 5);
    expect(layers.shakeTtl).toBe(8);
    expect(layers.shakeMagnitude).toBe(5);
  });
});
