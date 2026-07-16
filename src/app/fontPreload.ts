import type { AssetStore } from '@io/assets';
import { assetUrlForId } from '@io/assets';

export const UI_FONT_ASSET_ID = 'font.lxgw-wenkai';
export const UI_FONT_FAMILY = 'LXGW WenKai';

function documentFontSet(): FontFaceSet | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.fonts;
}

/**
 * 首帧前确保 UI 中文字体已注册并可用于 PIXI.Text，避免先闪系统回退或方块字。
 */
export async function preloadUiFont(store: AssetStore): Promise<void> {
  const fonts = documentFontSet();
  if (!fonts) return;

  const url = assetUrlForId(store, UI_FONT_ASSET_ID);
  if (url && typeof FontFace !== 'undefined' && !fonts.check(`1em "${UI_FONT_FAMILY}"`)) {
    const face = new FontFace(UI_FONT_FAMILY, `url(${JSON.stringify(url).slice(1, -1)}) format('woff2')`, {
      weight: '400',
      style: 'normal',
      display: 'swap'
    });
    await face.load();
    fonts.add(face);
  }

  await fonts.load(`1em "${UI_FONT_FAMILY}"`);
}
