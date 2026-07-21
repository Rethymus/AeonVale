export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

export interface GridPathRequest {
  readonly width: number;
  readonly height: number;
  readonly start: GridPoint;
  readonly goals: readonly GridPoint[];
  readonly isPassable: (point: GridPoint) => boolean;
}

export interface PlayerMovementAnimation {
  readonly from: GridPoint;
  readonly to: GridPoint;
  readonly startedAtMs: number;
  readonly durationMs: number;
}

export interface PlayerMovementVisual {
  readonly x: number;
  readonly y: number;
  readonly progress: number;
  readonly moving: boolean;
  readonly from: GridPoint | null;
  readonly to: GridPoint | null;
}

export const CARDINAL_DIRECTIONS: readonly { readonly direction: MoveDirection; readonly dx: number; readonly dy: number }[] = [
  { direction: 'up', dx: 0, dy: -1 },
  { direction: 'right', dx: 1, dy: 0 },
  { direction: 'down', dx: 0, dy: 1 },
  { direction: 'left', dx: -1, dy: 0 }
];

function pointKey(point: GridPoint): string {
  return `${point.x},${point.y}`;
}

function withinBounds(point: GridPoint, width: number, height: number): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
}

export function sameGridPoint(a: GridPoint, b: GridPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isAdjacentCardinal(a: GridPoint, b: GridPoint): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function directionBetween(from: GridPoint, to: GridPoint): MoveDirection | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === -1) return 'up';
  if (dx === 1 && dy === 0) return 'right';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === -1 && dy === 0) return 'left';
  return null;
}

export function neighboringCardinalPoints(point: GridPoint): GridPoint[] {
  return CARDINAL_DIRECTIONS.map(step => ({ x: point.x + step.dx, y: point.y + step.dy }));
}

export function interactionAdjacentGoals(request: {
  readonly target: GridPoint;
  readonly width: number;
  readonly height: number;
  readonly isPassable: (point: GridPoint) => boolean;
}): GridPoint[] {
  return neighboringCardinalPoints(request.target).filter(point => withinBounds(point, request.width, request.height) && request.isPassable(point));
}

export function findGridPath(request: GridPathRequest): GridPoint[] | null {
  const goals = request.goals.filter(goal => withinBounds(goal, request.width, request.height) && request.isPassable(goal));
  if (goals.length === 0) return null;

  const goalKeys = new Set(goals.map(pointKey));
  if (goalKeys.has(pointKey(request.start))) return [];

  const visited = new Set<string>([pointKey(request.start)]);
  const previous = new Map<string, GridPoint>();
  const queue: GridPoint[] = [{ ...request.start }];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index]!;
    for (const step of CARDINAL_DIRECTIONS) {
      const next = { x: current.x + step.dx, y: current.y + step.dy };
      const key = pointKey(next);
      if (visited.has(key) || !withinBounds(next, request.width, request.height) || !request.isPassable(next)) continue;
      visited.add(key);
      previous.set(key, current);
      if (goalKeys.has(key)) {
        const path: GridPoint[] = [next];
        let cursor = current;
        while (!sameGridPoint(cursor, request.start)) {
          path.unshift(cursor);
          cursor = previous.get(pointKey(cursor))!;
        }
        return path;
      }
      queue.push(next);
    }
  }

  return null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}

export function playerMovementVisualPosition(
  restingPosition: GridPoint,
  animation: PlayerMovementAnimation | null,
  nowMs: number,
  reducedMotion: boolean
): PlayerMovementVisual {
  if (!animation || reducedMotion || animation.durationMs <= 0) {
    return {
      x: restingPosition.x,
      y: restingPosition.y,
      progress: 1,
      moving: false,
      from: null,
      to: null
    };
  }

  const progress = clamp01((nowMs - animation.startedAtMs) / animation.durationMs);
  const eased = smoothStep(progress);
  return {
    x: animation.from.x + (animation.to.x - animation.from.x) * eased,
    y: animation.from.y + (animation.to.y - animation.from.y) * eased,
    progress,
    moving: progress < 1,
    from: animation.from,
    to: animation.to
  };
}
