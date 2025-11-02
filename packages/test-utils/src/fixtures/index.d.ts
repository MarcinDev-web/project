/**
 * Test fixtures - pre-configured test data
 */
/**
 * Common vector fixtures
 */
export declare const vec3Fixtures: {
    zero: readonly [0, 0, 0];
    one: readonly [1, 1, 1];
    unitX: readonly [1, 0, 0];
    unitY: readonly [0, 1, 0];
    unitZ: readonly [0, 0, 1];
    up: readonly [0, 1, 0];
    down: readonly [0, -1, 0];
    forward: readonly [0, 0, -1];
    back: readonly [0, 0, 1];
    left: readonly [-1, 0, 0];
    right: readonly [1, 0, 0];
};
/**
 * Common transform fixtures
 */
export declare const transformFixtures: {
    identity: {
        position: readonly [0, 0, 0];
        rotation: readonly [0, 0, 0, 1];
        scale: readonly [1, 1, 1];
    };
    atOrigin: {
        position: readonly [0, 0, 0];
        rotation: readonly [0, 0, 0, 1];
        scale: readonly [1, 1, 1];
    };
    offset: {
        position: readonly [10, 5, -3];
        rotation: readonly [0, 0, 0, 1];
        scale: readonly [1, 1, 1];
    };
    scaled: {
        position: readonly [0, 0, 0];
        rotation: readonly [0, 0, 0, 1];
        scale: readonly [2, 2, 2];
    };
};
/**
 * Common entity fixtures
 */
export interface EntityFixture {
    id: number;
    name: string;
    components?: Record<string, unknown>;
}
export declare const entityFixtures: {
    simple: () => EntityFixture;
    withTransform: () => EntityFixture;
    withMesh: () => EntityFixture;
};
/**
 * Common scene fixtures
 */
export declare const sceneFixtures: {
    empty: () => {
        entities: never[];
        name: string;
    };
    withEntities: (count?: number) => {
        entities: {
            id: number;
            name: string;
        }[];
        name: string;
    };
    hierarchy: () => {
        entities: ({
            id: number;
            name: string;
            parentId: null;
        } | {
            id: number;
            name: string;
            parentId: number;
        })[];
        name: string;
    };
};
/**
 * Performance test fixtures
 */
export declare const performanceFixtures: {
    /**
     * Generate large array of entities for performance testing
     */
    largeEntitySet: (count?: number) => {
        id: number;
        name: string;
        position: number[];
    }[];
    /**
     * Generate stress test mesh data
     */
    largeMesh: (vertexCount?: number) => {
        vertices: Float32Array<ArrayBuffer>;
        indices: Uint16Array<ArrayBuffer>;
    };
};
//# sourceMappingURL=index.d.ts.map