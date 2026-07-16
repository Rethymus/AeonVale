import { DEFAULT_MASTER_VOLUME, clampMasterVolume } from '@io/audio';

export const RUNTIME_SETTINGS_STORAGE_KEY = 'aeonvale-settings-v1';

export interface RuntimeSettings {
  readonly masterVolume: number;
  readonly reducedMotion: boolean;
}

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = Object.freeze({
  masterVolume: DEFAULT_MASTER_VOLUME,
  reducedMotion: false
});

export function decodeRuntimeSettings(raw: string | null): RuntimeSettings {
  if (raw === null) return DEFAULT_RUNTIME_SETTINGS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_RUNTIME_SETTINGS;
    const record = parsed as Record<string, unknown>;
    return {
      masterVolume: typeof record.masterVolume === 'number' ? clampMasterVolume(record.masterVolume) : DEFAULT_RUNTIME_SETTINGS.masterVolume,
      reducedMotion: typeof record.reducedMotion === 'boolean' ? record.reducedMotion : DEFAULT_RUNTIME_SETTINGS.reducedMotion
    };
  } catch {
    return DEFAULT_RUNTIME_SETTINGS;
  }
}

export function serializeRuntimeSettings(settings: RuntimeSettings): string {
  return JSON.stringify({
    masterVolume: clampMasterVolume(settings.masterVolume),
    reducedMotion: settings.reducedMotion
  });
}

export function runtimeSettingsPersistenceText(available: boolean): string {
  return available ? '运行时设置会保存在此浏览器。' : '运行时设置仅在当前会话有效；关闭或刷新页面后会恢复上次可读取的设置。';
}
