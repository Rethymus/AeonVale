const CULTIVATION_JOURNEY_STORAGE_SLOT = 'aeonvale-cultivation-journey-v1';
const CULTIVATION_JOURNEY_VERSION = 1;

interface CultivationJourneyEnvelope {
  readonly version: typeof CULTIVATION_JOURNEY_VERSION;
  readonly payload: unknown;
}

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
function decodeEnvelope(raw: string | null): CultivationJourneyEnvelope | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const envelope = value as Partial<CultivationJourneyEnvelope>;
    return envelope.version === CULTIVATION_JOURNEY_VERSION && 'payload' in envelope
      ? { version: CULTIVATION_JOURNEY_VERSION, payload: envelope.payload }
      : null;
  } catch {
    return null;
  }
}

export function saveCultivationJourney(payload: unknown): boolean {
  const storage = storageOrNull();
  if (!storage) return false;
  try {
    storage.setItem(CULTIVATION_JOURNEY_STORAGE_SLOT, JSON.stringify({
      version: CULTIVATION_JOURNEY_VERSION,
      payload
    } satisfies CultivationJourneyEnvelope));
    return true;
  } catch {
    return false;
  }
}

export function loadCultivationJourney<T>(): T | null {
  const storage = storageOrNull();
  if (!storage) return null;
  return (decodeEnvelope(storage.getItem(CULTIVATION_JOURNEY_STORAGE_SLOT))?.payload as T | undefined) ?? null;
}

export function hasCultivationJourney(): boolean {
  const storage = storageOrNull();
  return storage ? decodeEnvelope(storage.getItem(CULTIVATION_JOURNEY_STORAGE_SLOT)) !== null : false;
}

export function clearCultivationJourney(): void {
  const storage = storageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(CULTIVATION_JOURNEY_STORAGE_SLOT);
  } catch {
    // Storage can be blocked at runtime; a new in-memory journey still remains playable.
  }
}
