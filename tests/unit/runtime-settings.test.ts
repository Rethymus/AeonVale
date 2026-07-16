import { describe, expect, it } from 'vitest';
import { DEFAULT_RUNTIME_SETTINGS, RUNTIME_SETTINGS_STORAGE_KEY, decodeRuntimeSettings, runtimeSettingsPersistenceText, serializeRuntimeSettings } from '@app/runtimeSettings';

describe('runtime settings contract', () => {
  it('uses an independent key and the requested defaults', () => {
    expect(RUNTIME_SETTINGS_STORAGE_KEY).toBe('aeonvale-settings-v1');
    expect(DEFAULT_RUNTIME_SETTINGS).toEqual({ masterVolume: 35, reducedMotion: false });
  });

  it('decodes persisted settings and clamps the volume range', () => {
    expect(decodeRuntimeSettings('{"masterVolume":72,"reducedMotion":true}')).toEqual({ masterVolume: 72, reducedMotion: true });
    expect(decodeRuntimeSettings('{"masterVolume":-5,"reducedMotion":false}')).toEqual({ masterVolume: 0, reducedMotion: false });
    expect(decodeRuntimeSettings('{"masterVolume":130,"reducedMotion":true}')).toEqual({ masterVolume: 100, reducedMotion: true });
  });

  it('falls back field-by-field for missing, malformed, or invalid values', () => {
    expect(decodeRuntimeSettings(null)).toEqual(DEFAULT_RUNTIME_SETTINGS);
    expect(decodeRuntimeSettings('{broken')).toEqual(DEFAULT_RUNTIME_SETTINGS);
    expect(decodeRuntimeSettings('null')).toEqual(DEFAULT_RUNTIME_SETTINGS);
    expect(decodeRuntimeSettings('{"masterVolume":"loud","reducedMotion":"yes"}')).toEqual(DEFAULT_RUNTIME_SETTINGS);
  });

  it('serializes only the stable runtime settings fields', () => {
    expect(serializeRuntimeSettings({ masterVolume: 48, reducedMotion: true })).toBe('{"masterVolume":48,"reducedMotion":true}');
  });

  it('describes persistence independently from game-save health', () => {
    expect(runtimeSettingsPersistenceText(true)).toContain('保存在此浏览器');
    expect(runtimeSettingsPersistenceText(false)).toContain('仅在当前会话有效');
  });
});
