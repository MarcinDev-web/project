/**
 * Snapshot testing utilities for serialization
 */
/**
 * Snapshot serialization options
 */
export interface SnapshotOptions {
    /**
     * Properties to exclude from snapshot
     */
    exclude?: string[];
    /**
     * Replace dynamic values (like timestamps, UUIDs)
     */
    replacements?: Record<string, unknown>;
    /**
     * Sort arrays before snapshotting for consistency
     */
    sortArrays?: boolean;
    /**
     * Normalize entity IDs to a placeholder
     */
    normalizeEntityIds?: boolean;
    /**
     * Normalize RNG state to a placeholder
     */
    normalizeRngState?: boolean;
}
/**
 * Normalize an object for snapshot testing
 * Removes non-deterministic fields and sorts data
 */
export declare function normalizeForSnapshot<T>(obj: T, options?: SnapshotOptions): unknown;
/**
 * Create a snapshot matcher for complex objects
 */
export declare function expectToMatchSnapshot<T>(value: T, options?: SnapshotOptions): void;
/**
 * Inline snapshot matcher
 */
export declare function expectToMatchInlineSnapshot<T>(value: T, options?: SnapshotOptions, snapshot?: string): void;
/**
 * Snapshot testing for JSON serialization
 */
export declare function expectJsonToMatchSnapshot(obj: unknown, options?: SnapshotOptions): void;
/**
 * Snapshot testing for scene serialization
 */
export declare function expectSceneToMatchSnapshot(scene: unknown, options?: SnapshotOptions): void;
/**
 * Compare two serializations for equality (useful for versioning tests)
 */
export declare function expectSerializationToEqual<T>(v1: T, v2: T, options?: SnapshotOptions): void;
/**
 * Test that serialization is stable (serialize -> deserialize -> serialize again)
 */
export declare function expectSerializationToBeStable<T>(value: T, serialize: (v: T) => string, deserialize: (s: string) => T): void;
//# sourceMappingURL=index.d.ts.map