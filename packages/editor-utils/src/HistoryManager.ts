export interface SceneSnapshot {
  /** Serialized scene data (JSON string) */
  sceneJSON: string;
  /** Hierarchical index path to the selected entity (root -> child -> ...). */
  selectedPath: number[] | null;
  /** Optional description for debugging/UI purposes. */
  description?: string;
  /** Timestamp (ms) when the snapshot was created. */
  timestamp: number;
}

export class HistoryManager {
  private entries: SceneSnapshot[] = [];
  private index = -1;
  private frozen = false;

  constructor(private maxSize = 100) {}

  get limit(): number {
    return this.maxSize;
  }

  export(): SceneSnapshot[] {
    return this.entries.map(HistoryManager.cloneSnapshot);
  }

  /**
   * Returns the current snapshot (or null when history is empty).
   */
  get current(): SceneSnapshot | null {
    return this.entries[this.index] ?? null;
  }

  /**
   * Adds a snapshot to the history, clearing any redo stack.
   */
  push(snapshot: SceneSnapshot): void {
    if (this.frozen) {
      return;
    }
    const normalized = HistoryManager.cloneSnapshot(snapshot);

    if (this.index < this.entries.length - 1) {
      this.entries.splice(this.index + 1);
    }

    this.entries.push(normalized);
    if (this.entries.length > this.maxSize) {
      this.entries.shift();
      this.index = HistoryManager.clamp(this.index - 1, -1, this.entries.length - 1);
    }

    this.index = this.entries.length - 1;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index >= 0 && this.index < this.entries.length - 1;
  }

  undo(): SceneSnapshot | null {
    if (!this.canUndo()) {
      return null;
    }
    this.index -= 1;
    return HistoryManager.cloneSnapshot(this.entries[this.index]!);
  }

  redo(): SceneSnapshot | null {
    if (!this.canRedo()) {
      return null;
    }
    this.index += 1;
    return HistoryManager.cloneSnapshot(this.entries[this.index]!);
  }

  clear(): void {
    this.entries = [];
    this.index = -1;
  }

  size(): number {
    return this.entries.length;
  }

  /**
   * Returns the current history index (-1 if empty, 0-based).
   */
  getCurrentIndex(): number {
    return this.index;
  }

  /**
   * Gets a snapshot at a specific index (0-based).
   * Returns null if index is out of bounds.
   */
  getSnapshotAt(index: number): SceneSnapshot | null {
    if (index < 0 || index >= this.entries.length) {
      return null;
    }
    return HistoryManager.cloneSnapshot(this.entries[index]!);
  }

  /**
   * Jumps to a specific index in history and returns the snapshot.
   * This is used for "jump to history index" functionality.
   * Returns null if index is out of bounds.
   */
  jumpTo(index: number): SceneSnapshot | null {
    if (index < 0 || index >= this.entries.length) {
      return null;
    }
    this.index = index;
    return HistoryManager.cloneSnapshot(this.entries[index]!);
  }

  freeze(): void {
    this.frozen = true;
  }

  unfreeze(): void {
    this.frozen = false;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  replace(snapshots: SceneSnapshot[]): void {
    this.entries = snapshots.map(HistoryManager.cloneSnapshot).slice(-this.maxSize);
    this.index = this.entries.length - 1;
  }

  setLimit(limit: number): void {
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error('History limit must be positive');
    }
    const rounded = Math.floor(limit);
    if (rounded === this.maxSize) return;

    const snapshots = this.export();
    this.maxSize = rounded;
    this.entries = snapshots.slice(-this.maxSize);
    this.index = this.entries.length - 1;
  }

  /** Temporarily toggles recording. */
  private static cloneSnapshot(snapshot: SceneSnapshot): SceneSnapshot {
    return {
      sceneJSON: snapshot.sceneJSON,
      selectedPath: snapshot.selectedPath ? [...snapshot.selectedPath] : null,
      ...(snapshot.description !== undefined ? { description: snapshot.description } : {}),
      timestamp: snapshot.timestamp,
    };
  }

  private static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}

export function snapshotsEqual(a: SceneSnapshot | null, b: SceneSnapshot | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.sceneJSON !== b.sceneJSON) return false;
  const pathA = a.selectedPath ?? [];
  const pathB = b.selectedPath ?? [];
  if (pathA.length !== pathB.length) return false;
  for (let i = 0; i < pathA.length; i += 1) {
    if (pathA[i] !== pathB[i]) return false;
  }
  return true;
}

