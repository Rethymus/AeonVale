/**
 * 布局防溢出的纯函数辅助（ECC：规则进代码，供 unit / 未来 Playwright 复用）。
 * 不依赖 DOM；对文案与预留宽度做保守估算。
 */

/** CJK 约等于 fontSize 宽；英文约 0.55em。 */
export function estimateTextWidthPx(text: string, fontSize: number): number {
  let width = 0;
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') continue;
    // 全角/ CJK 区间粗判
    const code = ch.codePointAt(0) ?? 0;
    const fullWidth = code > 0xff || (code >= 0x3000 && code <= 0x9fff) || (code >= 0xff00 && code <= 0xffef);
    width += fullWidth ? fontSize : fontSize * 0.55;
  }
  return width;
}

export function textFitsWidth(text: string, fontSize: number, maxWidthPx: number, paddingPx = 0): boolean {
  const lines = text.split(/\n/);
  return lines.every(line => estimateTextWidthPx(line, fontSize) + paddingPx <= maxWidthPx);
}

/** 关键 HUD/教学面板的字号与可用宽（与 renderer / index 布局对齐的保守值）。 */
export const UI_COPY_BUDGETS = {
  tribulationWarning: { fontSize: 15, maxWidth: 520 },
  tribulationPrimary: { fontSize: 15, maxWidth: 280 },
  farmToast: { fontSize: 14, maxWidth: 900 },
  journeyCta: { fontSize: 14, maxWidth: 360 },
  alchemyPairing: { fontSize: 14, maxWidth: 420 }
} as const;
