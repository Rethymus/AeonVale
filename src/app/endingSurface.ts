import { t } from '@content/i18n';
import type { AssetId } from '@io/assets';
import type { GameState } from '@sim';

const ENDING_CG_ASSET_IDS: Readonly<Record<string, AssetId>> = {
  ascension: 'cg.ending-ascension',
  'lifespan-death': 'cg.ending-lifespan-death',
  'poison-death': 'cg.ending-poison-death'
};

export interface EndingSurfaceOptions {
  readonly state: GameState;
  readonly endingStatus: string;
  readonly assetUrlForId?: (assetId: AssetId) => string | undefined;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function endingCgAssetId(ending: string | null): AssetId | undefined {
  if (!ending) return undefined;
  return ENDING_CG_ASSET_IDS[ending];
}

function endingLines(ending: string | null): readonly [string, readonly string[]] {
  const raw = t('ending.' + (ending ?? ''));
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
  const title = lines[0] ?? '结局';
  return [title, lines.slice(1)];
}

export function renderEndingSurface(options: EndingSurfaceOptions): string {
  const { state, endingStatus, assetUrlForId } = options;
  const endingId = state.ending ?? '';
  const assetId = endingCgAssetId(state.ending);
  const cgUrl = assetId ? assetUrlForId?.(assetId) : undefined;
  const [title, bodyLines] = endingLines(state.ending);
  const body = bodyLines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
  const media = cgUrl
    ? [
        '<figure class="ending-cg-frame">',
        `<img class="ending-cg-image" src="${escapeHtml(cgUrl)}" alt="" aria-hidden="true" decoding="async" data-asset-id="${escapeHtml(assetId ?? '')}" />`,
        '<figcaption>终局留影</figcaption>',
        '</figure>'
      ].join('')
    : [
        '<div class="ending-cg-fallback" role="img" aria-label="终局留影尚未显现">',
        '<strong>终局留影待补</strong>',
        '<span>当前分支尚未登记 CG，先保留文字结算。</span>',
        '</div>'
      ].join('');

  return [
    `<article class="ending-result${cgUrl ? ' ending-result-with-cg' : ' ending-result-no-cg'}" data-ending-id="${escapeHtml(endingId)}">`,
    media,
    '<div class="ending-copy">',
    '<p class="surface-kicker">终局卷轴</p>',
    `<h2>${escapeHtml(title)}</h2>`,
    body,
    '<dl class="ending-meta">',
    '<div>',
    '<dt>旅程日数</dt>',
    `<dd>第 ${state.day} 日 · ${state.year} 年</dd>`,
    '</div>',
    '<div>',
    '<dt>本地存档</dt>',
    `<dd>${escapeHtml(endingStatus)}</dd>`,
    '</div>',
    '</dl>',
    '</div>',
    '</article>'
  ].join('');
}
