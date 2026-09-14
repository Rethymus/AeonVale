/**
 * 确定性序列化（修途主模式保留面）。
 *
 * - canonicalSerialize：递归排序 key + 浮点四舍五入（1e-6 量化），保证 JSON 哈希稳定
 *   （JS 对象 key 顺序不保证）。修途 golden replay 的快照哈希基元
 *   （tests/replay/cultivation-harness.ts cultivationSnapshotHash）。
 *
 * 旧世界 GameState ↔ JSON 的 serializeState/deserializeState/saveGame 全家
 * 已随旧世界退役（docs/21 §8.29 就绪快照 → §8.30 执行记录）；旧格式存档
 * （aeonvale-save-v1）由 app/saveHealth 的旧档兼容链按"不再受支持"语义呈现。
 */

/** 递归规范序列化：key 字典序、数组保序、number 取整到 6 位小数。 */
export function canonicalSerialize(obj: unknown): string {
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalSerialize).join(',')}]`;
  }
  if (obj && typeof obj === 'object') {
    if (obj instanceof Map) {
      const entries = [...obj.entries()].sort((a, b) => cmp(a[0], b[0]));
      return `{|${entries.map(([k, v]) => `${JSON.stringify(String(k))}:${canonicalSerialize(v)}`).join(',')}|}`;
    }
    if (obj instanceof Set) {
      const arr = [...obj].sort((a, b) => cmp(a, b));
      return canonicalSerialize(arr);
    }
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map(k => `"${k}":${canonicalSerialize(o[k])}`).join(',')}}`;
  }
  if (typeof obj === 'number') {
    return String(Math.round(obj * 1e6) / 1e6);
  }
  return JSON.stringify(obj);
}

function cmp(a: unknown, b: unknown): number {
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
