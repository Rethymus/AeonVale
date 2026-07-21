export type MoveDirection = 'up' | 'down' | 'left' | 'right';
export type CycleDirection = 'next' | 'previous';
export type OpenTarget = 'menu' | 'inventory' | 'cultivation' | 'map' | 'furnace' | 'journey' | 'pause' | 'settings';

export type GameCommand = { readonly kind: 'move'; readonly direction: MoveDirection } | { readonly kind: 'confirm' } | { readonly kind: 'cancel' } | { readonly kind: 'cycle'; readonly direction: CycleDirection } | { readonly kind: 'hotbar'; readonly index: number } | { readonly kind: 'open'; readonly target: OpenTarget } | { readonly kind: 'end-day' };

export interface KeyboardInput {
  readonly key: string;
  readonly code?: string;
  readonly shiftKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
}

export interface KeyboardCommandContext {
  readonly enterBehavior?: 'confirm' | 'end-day';
  readonly shortcutProfile?: 'full' | 'product';
}

export type TouchInput = { readonly control: 'move'; readonly direction: MoveDirection } | { readonly control: 'confirm' } | { readonly control: 'cancel' } | { readonly control: 'cycle'; readonly direction: CycleDirection } | { readonly control: 'hotbar'; readonly index: number } | { readonly control: 'open'; readonly target: OpenTarget } | { readonly control: 'end-day' };

const MOVE_BY_KEY: Readonly<Record<string, MoveDirection>> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right'
};

const OPEN_BY_KEY: Readonly<Partial<Record<string, OpenTarget>>> = {
  b: 'inventory',
  c: 'cultivation',
  j: 'journey',
  m: 'map',
  p: 'pause'
};

function hotbarIndex(input: KeyboardInput): number | null {
  if (input.shiftKey) return null;
  const codeDigit = input.code?.match(/^Digit([0-9])$/)?.[1];
  const keyDigit = input.key.match(/^[0-9]$/)?.[0];
  const digit = codeDigit ?? keyDigit;
  if (digit == null) return null;
  return digit === '0' ? 9 : Number(digit) - 1;
}

function hasCommandModifier(input: KeyboardInput): boolean {
  return input.ctrlKey === true || input.altKey === true || input.metaKey === true;
}

export function gameCommandFromKeyboard(input: KeyboardInput, context: KeyboardCommandContext = {}): GameCommand | null {
  if (hasCommandModifier(input)) return null;

  const key = input.key.toLowerCase();
  const move = MOVE_BY_KEY[key];
  if (move) return { kind: 'move', direction: move };

  if (key === 'escape') return { kind: 'cancel' };
  if (key === 'enter') return { kind: context.enterBehavior ?? 'confirm' };

  if (context.shortcutProfile === 'product') {
    return key === 'b' ? { kind: 'open', target: 'inventory' } : null;
  }

  const target = OPEN_BY_KEY[key];
  if (target) return { kind: 'open', target };

  if (key === 'tab') return { kind: 'cycle', direction: input.shiftKey ? 'previous' : 'next' };
  if (key === ' ' || key === 'space' || key === 'spacebar' || input.code === 'Space') return { kind: 'confirm' };
  if (key === 'e' && !input.shiftKey) return { kind: 'confirm' };

  const index = hotbarIndex(input);
  return index != null ? { kind: 'hotbar', index } : null;
}

export function gameCommandFromTouch(input: TouchInput): GameCommand | null {
  switch (input.control) {
    case 'move':
      return { kind: 'move', direction: input.direction };
    case 'confirm':
      return { kind: 'confirm' };
    case 'cancel':
      return { kind: 'cancel' };
    case 'cycle':
      return { kind: 'cycle', direction: input.direction };
    case 'hotbar':
      return Number.isInteger(input.index) && input.index >= 0 && input.index <= 9 ? { kind: 'hotbar', index: input.index } : null;
    case 'open':
      return { kind: 'open', target: input.target };
    case 'end-day':
      return { kind: 'end-day' };
  }
}
