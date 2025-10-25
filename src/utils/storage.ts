import { Logger } from '../app/utils/logger';

const STORAGE_PREFIX = 'editor:';

export function storageSave(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    Logger.warn('storageSave failed', error as unknown as Error);
  }
}

export function storageLoad<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error) {
    Logger.warn('storageLoad failed', error as unknown as Error);
    return null;
  }
}
