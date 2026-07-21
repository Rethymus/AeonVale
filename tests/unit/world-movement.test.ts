import { describe, expect, it } from 'vitest';
import { directionBetween, findGridPath, interactionAdjacentGoals, isAdjacentCardinal, playerMovementVisualPosition } from '@app/worldMovement';

describe('world movement helpers', () => {
  it('finds a deterministic cardinal path around blocked cells', () => {
    const blocked = new Set(['1,0', '1,1']);
    const path = findGridPath({
      width: 4,
      height: 4,
      start: { x: 0, y: 0 },
      goals: [{ x: 2, y: 0 }],
      isPassable: point => !blocked.has(`${point.x},${point.y}`)
    });

    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 2, y: 0 }
    ]);
  });

  it('returns an empty path when already standing on a goal', () => {
    expect(
      findGridPath({
        width: 3,
        height: 3,
        start: { x: 1, y: 1 },
        goals: [{ x: 1, y: 1 }],
        isPassable: () => true
      })
    ).toEqual([]);
  });

  it('builds adjacent interaction goals without walking onto the operated tile', () => {
    const blocked = new Set(['2,1']);
    expect(
      interactionAdjacentGoals({
        target: { x: 1, y: 1 },
        width: 3,
        height: 3,
        isPassable: point => !blocked.has(`${point.x},${point.y}`)
      })
    ).toEqual([
      { x: 1, y: 0 },
      { x: 1, y: 2 },
      { x: 0, y: 1 }
    ]);
  });

  it('rejects unreachable or impassable goals', () => {
    expect(
      findGridPath({
        width: 2,
        height: 2,
        start: { x: 0, y: 0 },
        goals: [{ x: 1, y: 1 }],
        isPassable: point => point.x === 0 && point.y === 0
      })
    ).toBeNull();
  });

  it('derives cardinal adjacency and movement direction', () => {
    expect(isAdjacentCardinal({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe(true);
    expect(isAdjacentCardinal({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false);
    expect(directionBetween({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe('right');
    expect(directionBetween({ x: 2, y: 2 }, { x: 4, y: 2 })).toBeNull();
  });

  it('interpolates player movement without changing the resting grid position', () => {
    const visual = playerMovementVisualPosition(
      { x: 4, y: 2 },
      { from: { x: 3, y: 2 }, to: { x: 4, y: 2 }, startedAtMs: 100, durationMs: 200 },
      200,
      false
    );

    expect(visual.x).toBeCloseTo(3.5, 3);
    expect(visual.y).toBe(2);
    expect(visual.moving).toBe(true);

    expect(playerMovementVisualPosition({ x: 4, y: 2 }, null, 200, false).x).toBe(4);
    expect(playerMovementVisualPosition({ x: 4, y: 2 }, { from: { x: 3, y: 2 }, to: { x: 4, y: 2 }, startedAtMs: 100, durationMs: 200 }, 200, true)).toMatchObject({
      x: 4,
      y: 2,
      moving: false
    });
  });
});
