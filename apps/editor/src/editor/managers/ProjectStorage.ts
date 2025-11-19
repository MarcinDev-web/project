import type { SceneData } from '@engine/world';

import type { GameProjectConfig } from '@shared/types/project';

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  description?: string;
  thumbnail?: string; // data URL of scene preview
}

export interface ProjectData {
  metadata: ProjectMetadata;
  scene: SceneData;
  config?: GameProjectConfig;
}

/**
 * IndexedDB-backed persistent storage for projects.
 * Handles save/load/delete operations for entire scenes.
 */
export class ProjectStorage {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'ugc-editor-projects';
  private readonly storeName = 'projects';
  private readonly version = 1;

  async initialize(): Promise<void> {
    if (this.db || typeof indexedDB === 'undefined') return;

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            const store = db.createObjectStore(this.storeName, { keyPath: 'metadata.id' });
            // Index for sorting by update time
            store.createIndex('updatedAt', 'metadata.updatedAt', { unique: false });
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Saves a project to IndexedDB.
   */
  async saveProject(project: ProjectData): Promise<void> {
    if (!this.db) throw new Error('ProjectStorage not initialized');

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.put(project);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Loads a project by ID.
   */
  async loadProject(id: string): Promise<ProjectData | null> {
    if (!this.db) throw new Error('ProjectStorage not initialized');

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.get(id);

        request.onsuccess = () => {
          resolve((request.result as ProjectData | undefined) ?? null);
        };
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Lists all projects, sorted by last update time (newest first).
   */
  async listProjects(): Promise<ProjectMetadata[]> {
    if (!this.db) throw new Error('ProjectStorage not initialized');

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const index = store.index('updatedAt');
        const request = index.openCursor(null, 'prev'); // newest first

        const results: ProjectMetadata[] = [];
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const project = cursor.value as ProjectData;
            results.push(project.metadata);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Deletes a project by ID.
   */
  async deleteProject(id: string): Promise<void> {
    if (!this.db) throw new Error('ProjectStorage not initialized');

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Checks if a project exists.
   */
  async hasProject(id: string): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.count(id);

        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
}
