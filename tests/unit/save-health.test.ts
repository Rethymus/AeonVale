import { describe, expect, it } from 'vitest';
import { decodeStoredSave, deriveSaveHealthPresentation, saveHealthAfterClear, saveHealthAfterLoad, saveHealthAfterWrite, type SaveHealth } from '@app/saveHealth';

describe('saveHealth 纯函数', () => {
  it('saveHealthAfterLoad 映射各装载状态', () => {
    expect(saveHealthAfterLoad('empty')).toEqual({ status: 'empty', hasUsableSave: false });
    expect(saveHealthAfterLoad('ready')).toEqual({ status: 'ready', hasUsableSave: true });
    expect(saveHealthAfterLoad('invalid-fallback').hasUsableSave).toBe(false);
    expect(saveHealthAfterLoad('storage-unavailable').hasUsableSave).toBe(false);
  });

  it('decodeStoredSave 分类：empty / ready / 非对象 / 格式不符 / hash 不符 / 解析失败', () => {
    const identity = (state: unknown): unknown => state;
    const compatible = (): boolean => true;

    expect(decodeStoredSave(null, compatible, identity).status).toBe('empty');
    expect(decodeStoredSave('not json', compatible, identity).status).toBe('invalid-fallback');
    expect(decodeStoredSave('[]', compatible, identity).status).toBe('invalid-fallback');

    const ok = JSON.stringify({ formatVersion: 1, schemaHash: 'h1', state: { hp: 1 } });
    expect(decodeStoredSave(ok, compatible, identity)).toMatchObject({ status: 'ready', state: { hp: 1 } });

    expect(decodeStoredSave(ok, () => false, identity).status).toBe('invalid-fallback');
    expect(decodeStoredSave(JSON.stringify({ ...JSON.parse(ok), formatVersion: 2 }), compatible, identity).status).toBe('invalid-fallback');
    expect(decodeStoredSave(JSON.stringify({ formatVersion: 1, schemaHash: 'h1' }), compatible, identity).status).toBe('invalid-fallback');
  });

  it('写失败保留上一份可用快照；清档失败不清空', () => {
    const ready: SaveHealth = { status: 'ready', hasUsableSave: true };
    expect(saveHealthAfterWrite(ready, false)).toEqual({ status: 'write-failed', hasUsableSave: true });
    expect(saveHealthAfterWrite(ready, true).status).toBe('ready');
    expect(saveHealthAfterClear(false).hasUsableSave).toBe(false);
    expect(saveHealthAfterClear(true).status).toBe('empty');
  });

  it('呈现层：invalid-fallback 提示回退，storage-unavailable 提示受限', () => {
    const fallback = deriveSaveHealthPresentation(saveHealthAfterLoad('invalid-fallback'));
    expect(fallback.titleNotice).toContain('本地存档无法读取');
    expect(fallback.settingsStatus).toContain('已回退到新旅程');

    const blocked = deriveSaveHealthPresentation(saveHealthAfterLoad('storage-unavailable'));
    expect(blocked.titleNotice).toContain('无法访问本地存储');
    expect(blocked.settingsStatus).toContain('仅在当前页面有效');
  });
});
