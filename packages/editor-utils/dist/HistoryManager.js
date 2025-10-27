export class HistoryManager {
    maxSize;
    entries = [];
    index = -1;
    frozen = false;
    constructor(maxSize = 100) {
        this.maxSize = maxSize;
    }
    get limit() {
        return this.maxSize;
    }
    export() {
        return this.entries.map(HistoryManager.cloneSnapshot);
    }
    /**
     * Returns the current snapshot (or null when history is empty).
     */
    get current() {
        return this.entries[this.index] ?? null;
    }
    /**
     * Adds a snapshot to the history, clearing any redo stack.
     */
    push(snapshot) {
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
    canUndo() {
        return this.index > 0;
    }
    canRedo() {
        return this.index >= 0 && this.index < this.entries.length - 1;
    }
    undo() {
        if (!this.canUndo()) {
            return null;
        }
        this.index -= 1;
        return HistoryManager.cloneSnapshot(this.entries[this.index]);
    }
    redo() {
        if (!this.canRedo()) {
            return null;
        }
        this.index += 1;
        return HistoryManager.cloneSnapshot(this.entries[this.index]);
    }
    clear() {
        this.entries = [];
        this.index = -1;
    }
    size() {
        return this.entries.length;
    }
    freeze() {
        this.frozen = true;
    }
    unfreeze() {
        this.frozen = false;
    }
    isFrozen() {
        return this.frozen;
    }
    replace(snapshots) {
        this.entries = snapshots.map(HistoryManager.cloneSnapshot).slice(-this.maxSize);
        this.index = this.entries.length - 1;
    }
    setLimit(limit) {
        if (!Number.isFinite(limit) || limit <= 0) {
            throw new Error('History limit must be positive');
        }
        const rounded = Math.floor(limit);
        if (rounded === this.maxSize)
            return;
        const snapshots = this.export();
        this.maxSize = rounded;
        this.entries = snapshots.slice(-this.maxSize);
        this.index = this.entries.length - 1;
    }
    /** Temporarily toggles recording. */
    static cloneSnapshot(snapshot) {
        return {
            sceneJSON: snapshot.sceneJSON,
            selectedPath: snapshot.selectedPath ? [...snapshot.selectedPath] : null,
            ...(snapshot.description !== undefined ? { description: snapshot.description } : {}),
            timestamp: snapshot.timestamp,
        };
    }
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
}
export function snapshotsEqual(a, b) {
    if (!a && !b)
        return true;
    if (!a || !b)
        return false;
    if (a.sceneJSON !== b.sceneJSON)
        return false;
    const pathA = a.selectedPath ?? [];
    const pathB = b.selectedPath ?? [];
    if (pathA.length !== pathB.length)
        return false;
    for (let i = 0; i < pathA.length; i += 1) {
        if (pathA[i] !== pathB[i])
            return false;
    }
    return true;
}
//# sourceMappingURL=HistoryManager.js.map