export interface ThumbnailCacheInit {
  dbName?: string;
  storeName?: string;
  metaStoreName?: string;
  versionTag: string; // used to invalidate cache between builds
}

/**
 * Lightweight IndexedDB-backed cache for thumbnail data URLs.
 * Gracefully no-ops when IndexedDB is unavailable.
 */
export class ThumbnailCache {
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly metaStoreName: string;
  private readonly versionTag: string;

  constructor(init: ThumbnailCacheInit) {
    this.dbName = init.dbName ?? 'ugc-thumb-cache';
    this.storeName = init.storeName ?? 'images';
    this.metaStoreName = init.metaStoreName ?? 'meta';
    this.versionTag = init.versionTag;
  }

  async initialize(): Promise<void> {
    if (this.db || typeof indexedDB === 'undefined') return;
    this.db = await this.openDb();
    try {
      const current = await this.getMeta('version');
      if (current !== this.versionTag) {
        await this.clearStore(this.storeName);
        await this.setMeta('version', this.versionTag);
      }
    } catch {
      // Ignore version check failures
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  async set(key: string, dataUrl: string): Promise<void> {
    if (!this.db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(dataUrl, key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
          if (!db.objectStoreNames.contains(this.metaStoreName)) {
            db.createObjectStore(this.metaStoreName);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  private async getMeta(key: string): Promise<string | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(this.metaStoreName, 'readonly');
        const store = tx.objectStore(this.metaStoreName);
        const req = store.get(key);
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async setMeta(key: string, value: string): Promise<void> {
    if (!this.db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(this.metaStoreName, 'readwrite');
        const store = tx.objectStore(this.metaStoreName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async clearStore(storeName: string): Promise<void> {
    if (!this.db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
