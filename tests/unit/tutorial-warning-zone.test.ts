import { describe, expect, it } from 'vitest';
import { alchemyHeatBand, tutorialWarningPulse, tutorialWarningZoneTiles } from '@render/tutorialWarningZone';

describe('tutorialWarningZone', () => {
  it('pulses between 0.35 and 0.70', () => {
    for (const t of [0, 210, 420, 630, 840, 1260]) {
      const p = tutorialWarningPulse(t);
      expect(p).toBeGreaterThanOrEqual(0.35);
      expect(p).toBeLessThanOrEqual(0.7 + 1e-9);
    }
    expect(tutorialWarningPulse(Number.NaN)).toBeCloseTo(0.35 + 0.35 * 0.5, 5);
  });

  it('covers Chebyshev r≤1 around center and clips world bounds', () => {
    const full = tutorialWarningZoneTiles(3, 3, 8, 8);
    expect(full).toHaveLength(9);
    expect(full.filter(c => c.isCenter)).toHaveLength(1);
    expect(full.find(c => c.isCenter)).toMatchObject({ x: 3, y: 3 });

    const corner = tutorialWarningZoneTiles(0, 0, 4, 4);
    expect(corner).toHaveLength(4);
    expect(corner.every(c => c.x >= 0 && c.y >= 0)).toBe(true);
  });

  it('maps heat percent into low / ideal / high bands', () => {
    expect(alchemyHeatBand(0, 40, 55)).toBe('low');
    expect(alchemyHeatBand(39, 40, 55)).toBe('low');
    expect(alchemyHeatBand(40, 40, 55)).toBe('ideal');
    expect(alchemyHeatBand(47, 40, 55)).toBe('ideal');
    expect(alchemyHeatBand(55, 40, 55)).toBe('ideal');
    expect(alchemyHeatBand(56, 40, 55)).toBe('high');
    expect(alchemyHeatBand(100, 40, 55)).toBe('high');
  });
});
