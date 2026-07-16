export const SAVE_HEALTH_STATUSES = ['empty', 'ready', 'invalid-fallback', 'storage-unavailable', 'write-failed'] as const;

export type SaveHealthStatus = (typeof SAVE_HEALTH_STATUSES)[number];
export type SaveLoadStatus = Exclude<SaveHealthStatus, 'write-failed'>;

export interface SaveHealth {
  readonly status: SaveHealthStatus;
  readonly hasUsableSave: boolean;
}

export interface DecodedStoredSave<T> {
  readonly status: 'empty' | 'ready' | 'invalid-fallback';
  readonly state: T | null;
}

export interface SaveHealthPresentation {
  readonly continueAvailable: boolean;
  readonly titleNotice: string | null;
  readonly settingsStatus: string;
  readonly pauseStatus: string;
  readonly portraitStatus: string;
  readonly endingStatus: string;
}

export function decodeStoredSave<T>(raw: string | null, isSchemaCompatible: (schemaHash: string | undefined) => boolean, deserialize: (state: unknown) => T, expectedFormatVersion = 1): DecodedStoredSave<T> {
  if (raw === null) return { status: 'empty', state: null };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { status: 'invalid-fallback', state: null };

    const envelope = parsed as Record<string, unknown>;
    const schemaHash = typeof envelope.schemaHash === 'string' ? envelope.schemaHash : undefined;
    if (envelope.formatVersion !== expectedFormatVersion || !isSchemaCompatible(schemaHash) || !Object.prototype.hasOwnProperty.call(envelope, 'state') || envelope.state == null) {
      return { status: 'invalid-fallback', state: null };
    }

    return { status: 'ready', state: deserialize(envelope.state) };
  } catch {
    return { status: 'invalid-fallback', state: null };
  }
}

export function saveHealthAfterLoad(status: SaveLoadStatus): SaveHealth {
  return { status, hasUsableSave: status === 'ready' };
}

export function saveHealthAfterWrite(previous: SaveHealth, succeeded: boolean): SaveHealth {
  return succeeded ? { status: 'ready', hasUsableSave: true } : { status: 'write-failed', hasUsableSave: previous.hasUsableSave };
}

export function saveHealthAfterClear(succeeded: boolean): SaveHealth {
  return succeeded ? { status: 'empty', hasUsableSave: false } : { status: 'write-failed', hasUsableSave: false };
}

export function deriveSaveHealthPresentation(health: SaveHealth): SaveHealthPresentation {
  switch (health.status) {
    case 'empty':
      return {
        continueAvailable: false,
        titleNotice: null,
        settingsStatus: '尚无本地存档。完成序章并成功保存后，“继续旅程”才会启用。',
        pauseStatus: '当前尚无可恢复的本地存档。完成序章后会尝试保存。',
        portraitStatus: '旋转后会自动继续。当前尚无可恢复的本地存档。',
        endingStatus: '本次终局尚未写入本地存档。返回标题不会清除当前会话；请勿刷新页面。'
      };
    case 'ready':
      return {
        continueAvailable: true,
        titleNotice: null,
        settingsStatus: '本地存档可读取，最近进度已成功写入。',
        pauseStatus: '当前进度已成功写入本地存档。',
        portraitStatus: '旋转后会自动继续，当前进度已成功写入本地存档。',
        endingStatus: '本次终局存档已成功保留；返回标题后仍可查看本次结局，选择新游戏才会清除。'
      };
    case 'invalid-fallback':
      return {
        continueAvailable: false,
        titleNotice: '本地存档无法读取，已回退到新旅程。选择“新游戏”后才会清除并替换旧存档。',
        settingsStatus: '检测到无法读取的本地存档，当前已回退到新旅程；旧数据尚未覆盖。',
        pauseStatus: '旧存档无法读取，当前新旅程尚未成功保存；关闭或刷新页面可能丢失进度。',
        portraitStatus: '旋转后会自动继续。旧存档无法读取，当前新旅程尚未成功保存。',
        endingStatus: '本次终局尚未写入本地存档。返回标题不会清档；关闭或刷新页面可能丢失进度。'
      };
    case 'storage-unavailable':
      return {
        continueAvailable: false,
        titleNotice: '浏览器无法访问本地存储；本次旅程只能保留在当前页面。',
        settingsStatus: '浏览器无法访问本地存储；本次进度仅在当前页面有效。',
        pauseStatus: '当前进度无法写入本地存档；关闭或刷新页面可能丢失进度。',
        portraitStatus: '旋转后会自动继续。当前进度无法写入本地存档，关闭或刷新页面可能丢失进度。',
        endingStatus: '本次终局无法写入本地存档。返回标题不会清除当前会话；请勿刷新页面。'
      };
    case 'write-failed':
      if (health.hasUsableSave) {
        return {
          continueAvailable: true,
          titleNotice: '最近一次存档写入失败；上次成功存档仍可继续，但当前进度尚未保存。',
          settingsStatus: '最近一次写入失败；上次成功存档仍可读取，但当前进度仅在当前页面有效。',
          pauseStatus: '当前进度未保存；关闭或刷新后将回到上次成功存档。',
          portraitStatus: '旋转后会自动继续。当前进度未保存，关闭或刷新后将回到上次成功存档。',
          endingStatus: '本次终局的最新进度未保存；返回标题不会清档，刷新后将回到上次成功存档。'
        };
      }
      return {
        continueAvailable: false,
        titleNotice: '最近一次存档写入失败；本次旅程尚无可继续的本地存档。',
        settingsStatus: '最近一次写入失败；本次旅程尚无可继续的本地存档，当前进度仅在当前页面有效。',
        pauseStatus: '当前进度未保存；关闭或刷新页面可能丢失本次旅程。',
        portraitStatus: '旋转后会自动继续。当前进度未保存，关闭或刷新页面可能丢失本次旅程。',
        endingStatus: '本次终局未能写入本地存档。返回标题不会清除当前会话；请勿刷新页面。'
      };
  }
}
