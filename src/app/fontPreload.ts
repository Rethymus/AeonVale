import type { AssetStore } from '@io/assets';
import { assetUrlForId } from '@io/assets';

export const UI_FONT_ASSET_ID = 'font.lxgw-wenkai';
export const UI_FONT_FAMILY = 'LXGW WenKai';

function documentFontSet(): FontFaceSet | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.fonts;
}

/**
 * document.fonts 是否已真正注册指定 family 的 FontFace。
 *
 * 注意：不能用 FontFaceSet.check() 做这个判断——它在「该 family 没有任何已注册 face」时
 * 会返回 true（规范级假阳性：没有待加载字体即视为满足）。线上正是因此被 `!check(...)` 跳过
 * 了 FontFace 构造，导致 UI 字体从不加载、整站按系统回退字体渲染、字宽错位、文本溢出文本框。
 * 只有遍历已注册 face 才是可靠信号。
 */
function hasRegisteredFamily(fonts: FontFaceSet, family: string): boolean {
  try {
    for (const face of fonts) {
      const registered = (face as { family?: unknown }).family;
      if (registered === family || registered === `"${family}"`) return true;
    }
  } catch {
    /* 迭代不可用时保守视为未注册，确保仍会尝试加载 */
  }
  return false;
}

/**
 * 首帧前确保 UI 中文字体已注册并可用于 PIXI.Text，避免先闪系统回退或方块字。
 */
export async function preloadUiFont(store: AssetStore): Promise<void> {
  const fonts = documentFontSet();
  if (!fonts) return;

  const url = assetUrlForId(store, UI_FONT_ASSET_ID);
  if (url && typeof FontFace !== 'undefined' && !hasRegisteredFamily(fonts, UI_FONT_FAMILY)) {
    const face = new FontFace(UI_FONT_FAMILY, `url(${JSON.stringify(url).slice(1, -1)}) format('woff2')`, {
      weight: '400',
      style: 'normal',
      display: 'swap'
    });
    try {
      await face.load();
      fonts.add(face);
    } catch {
      /* 字体资源加载失败时回退系统字体，不阻塞启动 */
    }
  }

  try {
    await fonts.load(`1em "${UI_FONT_FAMILY}"`);
  } catch {
    /* 系统无该字体且注册失败时忽略，避免未处理拒绝 */
  }
}
