import { describe, expect, it } from 'vitest';
import { generateLightningBolt, strokeLightningBolt } from '@render/lightningBolt';

describe('lightningBolt geometry', () => {
  it('generates a trunk from sky to impact with enough segments', () => {
    let i = 0;
    const random = () => {
      i += 1;
      return (i % 10) / 10;
    };
    const geom = generateLightningBolt({ x: 100, y: -10 }, { x: 120, y: 200 }, { iterations: 4, amplitude: 30, random });
    expect(geom.impact).toEqual({ x: 120, y: 200 });
    expect(geom.trunk.length).toBeGreaterThanOrEqual(3);
    expect(geom.trunk[0]).toEqual({ x: 100, y: -10 });
    expect(geom.trunk[geom.trunk.length - 1]).toEqual({ x: 120, y: 200 });
  });

  it('is deterministic when random is injected', () => {
    const mk = () => {
      let i = 0;
      return generateLightningBolt(
        { x: 50, y: 0 },
        { x: 80, y: 160 },
        {
          iterations: 3,
          amplitude: 20,
          random: () => {
            i += 1;
            return (i * 0.17) % 1;
          }
        }
      );
    };
    expect(mk()).toEqual(mk());
  });

  it('strokeLightningBolt draws trunk and impact without throwing', () => {
    const calls: string[] = [];
    const g = {
      moveTo(x: number, y: number) {
        calls.push(`m:${x},${y}`);
        return g;
      },
      lineTo(x: number, y: number) {
        calls.push(`l:${x},${y}`);
        return g;
      },
      stroke() {
        calls.push('stroke');
        return g;
      },
      circle(x: number, y: number, r: number) {
        calls.push(`c:${x},${y},${r}`);
        return {
          fill() {
            calls.push('fill');
            return g;
          }
        };
      }
    };
    const geom = generateLightningBolt({ x: 0, y: 0 }, { x: 10, y: 40 }, {
      iterations: 2,
      random: () => 0.5
    });
    strokeLightningBolt(g, geom, { alpha: 1 });
    expect(calls.some(c => c.startsWith('m:'))).toBe(true);
    expect(calls.filter(c => c === 'stroke').length).toBeGreaterThanOrEqual(2);
    expect(calls.some(c => c.startsWith('c:10,40'))).toBe(true);
  });

  it('skips drawing when alpha is 0', () => {
    const calls: string[] = [];
    const g = {
      moveTo() {
        calls.push('m');
        return g;
      },
      lineTo() {
        calls.push('l');
        return g;
      },
      stroke() {
        calls.push('s');
        return g;
      },
      circle() {
        return {
          fill() {
            calls.push('f');
            return g;
          }
        };
      }
    };
    strokeLightningBolt(g, { trunk: [{ x: 0, y: 0 }, { x: 1, y: 1 }], impact: { x: 1, y: 1 } }, { alpha: 0 });
    expect(calls).toEqual([]);
  });
});
