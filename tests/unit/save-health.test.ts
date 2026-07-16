import { describe, expect, it } from 'vitest';
import { decodeStoredSave, deriveSaveHealthPresentation, saveHealthAfterClear, saveHealthAfterLoad, saveHealthAfterWrite, type SaveHealth } from '@app/saveHealth';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { saveGame, deserializeState } from '@sim/serialize';
import { buildRegistry } from '@content/registry';

describe('save health contract', () => {
  it('distinguishes an absent save from a valid stored save', () => {
    expect(
      decodeStoredSave(
        null,
        () => true,
        value => value
      )
    ).toEqual({ status: 'empty', state: null });
    expect(
      decodeStoredSave(
        '{"formatVersion":1,"schemaHash":"current","state":{"day":3}}',
        hash => hash === 'current',
        value => value
      )
    ).toEqual({
      status: 'ready',
      state: { day: 3 }
    });
  });

  it.each([
    ['malformed JSON', '{broken', () => true, (value: unknown) => value],
    ['a non-object envelope', 'null', () => true, (value: unknown) => value],
    ['a missing state', '{"formatVersion":1,"schemaHash":"current"}', () => true, (value: unknown) => value],
    ['a missing format version', '{"schemaHash":"current","state":{}}', () => true, (value: unknown) => value],
    ['an unsupported format version', '{"formatVersion":2,"schemaHash":"current","state":{}}', () => true, (value: unknown) => value],
    ['an incompatible schema', '{"formatVersion":1,"schemaHash":"old","state":{}}', () => false, (value: unknown) => value],
    [
      'a deserialize failure',
      '{"formatVersion":1,"schemaHash":"current","state":{}}',
      () => true,
      () => {
        throw new Error('invalid state');
      }
    ]
  ])('classifies %s as an invalid fallback', (_label, raw, compatible, deserialize) => {
    expect(decodeStoredSave(raw, compatible, deserialize)).toEqual({ status: 'invalid-fallback', state: null });
  });

  it('rejects a structurally incomplete state even when legacy deserialization could coerce it', () => {
    const raw = JSON.stringify({
      formatVersion: 1,
      schemaHash: 'current',
      state: {
        crops: [],
        arrays: [],
        facilities: [],
        player: { flags: [], inventory: {} },
        flags: [],
        rngSnapshot: {}
      }
    });

    expect(decodeStoredSave(raw, hash => hash === 'current', deserializeState)).toEqual({ status: 'invalid-fallback', state: null });
  });

  it('rejects malformed nested inventory slots before the state reaches the runtime', () => {
    const registry = buildRegistry();
    const state = createWorld({ seed: 7, width: 4, height: 4, content: registry, params: DEFAULT_BALANCE });
    const save = saveGame(state, registry.schemaHash);
    const serialized = save.state as { player: { inventory: Record<string, unknown> } };
    serialized.player.inventory['item.corrupt'] = null;

    expect(decodeStoredSave(JSON.stringify(save), hash => hash === registry.schemaHash, deserializeState)).toEqual({ status: 'invalid-fallback', state: null });
  });

  it('tracks whether a usable older snapshot survives a failed write', () => {
    const ready = saveHealthAfterLoad('ready');
    expect(saveHealthAfterWrite(ready, false)).toEqual({ status: 'write-failed', hasUsableSave: true });

    const empty = saveHealthAfterLoad('empty');
    expect(saveHealthAfterWrite(empty, false)).toEqual({ status: 'write-failed', hasUsableSave: false });
    expect(saveHealthAfterWrite(empty, true)).toEqual({ status: 'ready', hasUsableSave: true });
  });

  it('withdraws old Continue eligibility as soon as a new game requests a clear', () => {
    expect(saveHealthAfterClear(true)).toEqual({ status: 'empty', hasUsableSave: false });
    expect(saveHealthAfterClear(false)).toEqual({ status: 'write-failed', hasUsableSave: false });
  });

  it.each<[SaveHealth, boolean, string | null, RegExp]>([
    [{ status: 'empty', hasUsableSave: false }, false, null, /尚无本地存档/],
    [{ status: 'ready', hasUsableSave: true }, true, null, /最近进度已成功写入/],
    [{ status: 'invalid-fallback', hasUsableSave: false }, false, '本地存档无法读取，已回退到新旅程。选择“新游戏”后才会清除并替换旧存档。', /旧数据尚未覆盖/],
    [{ status: 'storage-unavailable', hasUsableSave: false }, false, '浏览器无法访问本地存储；本次旅程只能保留在当前页面。', /无法访问本地存储/],
    [{ status: 'write-failed', hasUsableSave: false }, false, '最近一次存档写入失败；本次旅程尚无可继续的本地存档。', /最近一次写入失败/]
  ])('derives truthful controls and copy for %s', (health, continueAvailable, titleNotice, settingsPattern) => {
    const presentation = deriveSaveHealthPresentation(health);
    expect(presentation.continueAvailable).toBe(continueAvailable);
    expect(presentation.titleNotice).toBe(titleNotice);
    expect(presentation.settingsStatus).toMatch(settingsPattern);

    if (health.status === 'ready') {
      expect(presentation.pauseStatus).toContain('已成功写入本地存档');
      expect(presentation.portraitStatus).toContain('已成功写入本地存档');
      expect(presentation.endingStatus).toContain('终局存档已成功保留');
      expect(presentation.endingStatus).toContain('仍可查看本次结局');
    } else {
      expect(presentation.pauseStatus).not.toContain('当前进度已保留');
      expect(presentation.portraitStatus).not.toContain('安全保留');
      expect(presentation.endingStatus).not.toContain('终局存档已保留');
    }
  });

  it('explains that an older snapshot remains after a later write failure', () => {
    const presentation = deriveSaveHealthPresentation({ status: 'write-failed', hasUsableSave: true });
    expect(presentation.continueAvailable).toBe(true);
    expect(presentation.titleNotice).toContain('上次成功存档仍可继续');
    expect(presentation.settingsStatus).toContain('上次成功存档仍可读取');
    expect(presentation.pauseStatus).toContain('关闭或刷新后将回到上次成功存档');
  });
});
