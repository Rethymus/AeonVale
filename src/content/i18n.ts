/**
 * 极简 i18n 层（docs/10 §13 / docs/00 C8 全程中文）。
 * 字符串不入业务逻辑；UI/render 层经 t(key) 取中文。
 * 默认 locale = zh-CN；预留 en 扩展（不阻塞）。
 *
 * 自写 ~50 行 map，零依赖（M1）；内容膨胀可迁 i18next（docs/10 §13.6 L1）。
 */
import zhCN from './locales/zh-CN.json';

export type Locale = 'zh-CN' | 'en';

const DICTS: Record<Locale, unknown> = {
  'zh-CN': zhCN,
  'en': {}, // 预留
};

let currentLocale: Locale = 'zh-CN';

export function setLocale(l: Locale): void {
  currentLocale = l;
}

/** 按 dotted key 取字符串，支持 {var} 插值。缺键回退到 key 本身（便于发现漏译）。 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[currentLocale] as Record<string, unknown>;
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key; // 回退
    }
  }
  let s = typeof cur === 'string' ? cur : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}
