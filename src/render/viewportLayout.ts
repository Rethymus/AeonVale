export const LOGICAL_ASPECT_RATIO = 16 / 9;
export const DESKTOP_MIN_WIDTH_PX = 900;
export const DESKTOP_MIN_HEIGHT_PX = 506;
export const LANDSCAPE_TOUCH_MIN_SHORT_SIDE_PX = 360;
export const MIN_TOUCH_TARGET_PX = 44;

export type ViewportProfile = 'desktop' | 'compact-landscape' | 'portrait-blocked';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportLayoutInput {
  width: number;
  height: number;
  touchCapable: boolean;
  safeArea?: Partial<SafeAreaInsets>;
}

export interface ViewportRegions {
  statusBar: Rect;
  content: Rect;
  world: Rect;
  objectiveRail: Rect;
  actionBar: Rect;
}

export type TouchTargetId = 'moveUp' | 'moveLeft' | 'moveDown' | 'moveRight' | 'primaryAction' | 'secondaryAction';

export interface TouchLayout {
  minimumTargetSize: number;
  targets: Record<TouchTargetId, Rect>;
}

export interface ViewportLayout {
  profile: ViewportProfile;
  viewport: Rect;
  safeArea: SafeAreaInsets;
  safeBounds: Rect;
  canvas: Rect | null;
  regions: ViewportRegions | null;
  touch: TouchLayout | null;
  orientationGate: Rect | null;
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number, got ${value}.`);
  }
  return value;
}

function finiteInset(value: number | undefined, label: string): number {
  const resolved = value ?? 0;
  if (!Number.isFinite(resolved) || resolved < 0) {
    throw new RangeError(`${label} must be a finite non-negative number, got ${resolved}.`);
  }
  return resolved;
}

function resolveSafeArea(input: ViewportLayoutInput): { safeArea: SafeAreaInsets; safeBounds: Rect } {
  const width = finitePositive(input.width, 'Viewport width');
  const height = finitePositive(input.height, 'Viewport height');
  const safeArea: SafeAreaInsets = {
    top: finiteInset(input.safeArea?.top, 'Safe-area top inset'),
    right: finiteInset(input.safeArea?.right, 'Safe-area right inset'),
    bottom: finiteInset(input.safeArea?.bottom, 'Safe-area bottom inset'),
    left: finiteInset(input.safeArea?.left, 'Safe-area left inset')
  };
  const safeWidth = width - safeArea.left - safeArea.right;
  const safeHeight = height - safeArea.top - safeArea.bottom;
  if (safeWidth <= 0 || safeHeight <= 0) {
    throw new RangeError(`Safe area must leave positive content bounds, got ${safeWidth}x${safeHeight}.`);
  }
  return {
    safeArea,
    safeBounds: { x: safeArea.left, y: safeArea.top, width: safeWidth, height: safeHeight }
  };
}

function fitSixteenByNine(bounds: Rect): Rect {
  let width: number;
  let height: number;
  if (bounds.width * 9 <= bounds.height * 16) {
    width = bounds.width;
    height = (width * 9) / 16;
  } else {
    height = bounds.height;
    width = (height * 16) / 9;
  }
  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildRegions(canvas: Rect, profile: Exclude<ViewportProfile, 'portrait-blocked'>): ViewportRegions {
  const scale = canvas.height / 540;
  const padding = profile === 'desktop' ? clamp(12 * scale, 12, 18) : clamp(10 * scale, 8, 12);
  const gap = profile === 'desktop' ? clamp(12 * scale, 12, 18) : clamp(10 * scale, 8, 12);
  const statusHeight = profile === 'desktop' ? clamp(48 * scale, 48, 72) : clamp(52 * scale, 44, 52);
  const actionHeight = profile === 'desktop' ? clamp(72 * scale, 72, 108) : clamp(76 * scale, 64, 76);
  const innerX = canvas.x + padding;
  const innerWidth = canvas.width - padding * 2;
  const statusBar: Rect = { x: innerX, y: canvas.y + padding, width: innerWidth, height: statusHeight };
  const actionBar: Rect = {
    x: innerX,
    y: canvas.y + canvas.height - padding - actionHeight,
    width: innerWidth,
    height: actionHeight
  };
  const content: Rect = {
    x: innerX,
    y: statusBar.y + statusBar.height + gap,
    width: innerWidth,
    height: actionBar.y - gap - (statusBar.y + statusBar.height)
  };
  const railRatio = profile === 'desktop' ? 0.24 : 0.26;
  const objectiveWidth = content.width * railRatio;
  const world: Rect = {
    x: content.x,
    y: content.y,
    width: content.width - objectiveWidth - gap,
    height: content.height
  };
  const objectiveRail: Rect = {
    x: world.x + world.width + gap,
    y: content.y,
    width: objectiveWidth,
    height: content.height
  };
  return { statusBar, content, world, objectiveRail, actionBar };
}

function buildTouchLayout(safeBounds: Rect): TouchLayout {
  const dpadSize = 48;
  const dpadGap = 8;
  const dpadSpan = dpadSize * 3 + dpadGap * 2;
  const edgeGap = 12;
  const dpadX = safeBounds.x + edgeGap;
  const dpadY = safeBounds.y + safeBounds.height - edgeGap - dpadSpan;
  const dpadStep = dpadSize + dpadGap;
  const actionSize = clamp(safeBounds.height * 0.14, MIN_TOUCH_TARGET_PX, 56);
  const primaryX = safeBounds.x + safeBounds.width - edgeGap - actionSize;
  const actionY = safeBounds.y + safeBounds.height - edgeGap - actionSize;
  const secondaryX = primaryX - dpadGap - actionSize;

  return {
    minimumTargetSize: MIN_TOUCH_TARGET_PX,
    targets: {
      moveUp: { x: dpadX + dpadStep, y: dpadY, width: dpadSize, height: dpadSize },
      moveLeft: { x: dpadX, y: dpadY + dpadStep, width: dpadSize, height: dpadSize },
      moveDown: { x: dpadX + dpadStep, y: dpadY + dpadStep * 2, width: dpadSize, height: dpadSize },
      moveRight: { x: dpadX + dpadStep * 2, y: dpadY + dpadStep, width: dpadSize, height: dpadSize },
      primaryAction: { x: primaryX, y: actionY, width: actionSize, height: actionSize },
      secondaryAction: { x: secondaryX, y: actionY, width: actionSize, height: actionSize }
    }
  };
}

export function computeViewportLayout(input: ViewportLayoutInput): ViewportLayout {
  const { safeArea, safeBounds } = resolveSafeArea(input);
  const viewport: Rect = { x: 0, y: 0, width: input.width, height: input.height };

  if (safeBounds.height > safeBounds.width) {
    return {
      profile: 'portrait-blocked',
      viewport,
      safeArea,
      safeBounds,
      canvas: null,
      regions: null,
      touch: null,
      orientationGate: safeBounds
    };
  }

  const profile: Exclude<ViewportProfile, 'portrait-blocked'> = safeBounds.width >= DESKTOP_MIN_WIDTH_PX && safeBounds.height >= DESKTOP_MIN_HEIGHT_PX ? 'desktop' : 'compact-landscape';
  const canvas = fitSixteenByNine(safeBounds);
  const touch = input.touchCapable && safeBounds.height >= LANDSCAPE_TOUCH_MIN_SHORT_SIDE_PX ? buildTouchLayout(safeBounds) : null;

  return {
    profile,
    viewport,
    safeArea,
    safeBounds,
    canvas,
    regions: buildRegions(canvas, profile),
    touch,
    orientationGate: null
  };
}
