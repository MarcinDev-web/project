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
export declare class HistoryManager {
    private maxSize;
    private entries;
    private index;
    private frozen;
    constructor(maxSize?: number);
    get limit(): number;
    export(): SceneSnapshot[];
    /**
     * Returns the current snapshot (or null when history is empty).
     */
    get current(): SceneSnapshot | null;
    /**
     * Adds a snapshot to the history, clearing any redo stack.
     */
    push(snapshot: SceneSnapshot): void;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): SceneSnapshot | null;
    redo(): SceneSnapshot | null;
    clear(): void;
    size(): number;
    freeze(): void;
    unfreeze(): void;
    isFrozen(): boolean;
    replace(snapshots: SceneSnapshot[]): void;
    setLimit(limit: number): void;
    /** Temporarily toggles recording. */
    private static cloneSnapshot;
    private static clamp;
}
export declare function snapshotsEqual(a: SceneSnapshot | null, b: SceneSnapshot | null): boolean;
//# sourceMappingURL=HistoryManager.d.ts.map