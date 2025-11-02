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
    replacements?: Record<string, any>;
    /**
     * Sort arrays before snapshotting for consistency
     */
    sortArrays?: boolean;
}
/**
 * Normalize an object for snapshot testing
 * Removes non-deterministic fields and sorts data
 */
export declare function normalizeForSnapshot<T>(obj: T, options?: SnapshotOptions): any;
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
export declare function expectJsonToMatchSnapshot(obj: any, options?: SnapshotOptions): void;
/**
 * Snapshot testing for scene serialization
 */
export declare function expectSceneToMatchSnapshot(scene: any, options?: SnapshotOptions): void;
/**
 * Compare two serializations for equality (useful for versioning tests)
 */
export declare function expectSerializationToEqual(v1: any, v2: any, options?: SnapshotOptions): void;
/**
 * Test that serialization is stable (serialize -> deserialize -> serialize again)
 */
export declare function expectSerializationToBeStable<T>(value: T, serialize: (v: T) => string, deserialize: (s: string) => T): void;
//# sourceMappingURL=index.d.ts.map