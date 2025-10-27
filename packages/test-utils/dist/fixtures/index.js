/**
 * Test fixtures - pre-configured test data
 */
/**
 * Common vector fixtures
 */
export const vec3Fixtures = {
    zero: [0, 0, 0],
    one: [1, 1, 1],
    unitX: [1, 0, 0],
    unitY: [0, 1, 0],
    unitZ: [0, 0, 1],
    up: [0, 1, 0],
    down: [0, -1, 0],
    forward: [0, 0, -1],
    back: [0, 0, 1],
    left: [-1, 0, 0],
    right: [1, 0, 0],
};
/**
 * Common transform fixtures
 */
export const transformFixtures = {
    identity: {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
    },
    atOrigin: {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
    },
    offset: {
        position: [10, 5, -3],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
    },
    scaled: {
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [2, 2, 2],
    },
};
export const entityFixtures = {
    simple: () => ({
        id: 1,
        name: 'TestEntity',
    }),
    withTransform: () => ({
        id: 2,
        name: 'TransformEntity',
        components: {
            transform: transformFixtures.identity,
        },
    }),
    withMesh: () => ({
        id: 3,
        name: 'MeshEntity',
        components: {
            transform: transformFixtures.identity,
            mesh: {
                vertices: new Float32Array([0, 0, 0]),
                indices: new Uint16Array([0]),
            },
        },
    }),
};
/**
 * Common scene fixtures
 */
export const sceneFixtures = {
    empty: () => ({
        entities: [],
        name: 'EmptyScene',
    }),
    withEntities: (count = 3) => ({
        entities: Array.from({ length: count }, (_, i) => ({
            id: i + 1,
            name: `Entity${i + 1}`,
        })),
        name: 'TestScene',
    }),
    hierarchy: () => ({
        entities: [
            { id: 1, name: 'Root', parentId: null },
            { id: 2, name: 'Child1', parentId: 1 },
            { id: 3, name: 'Child2', parentId: 1 },
            { id: 4, name: 'Grandchild', parentId: 2 },
        ],
        name: 'HierarchyScene',
    }),
};
/**
 * Performance test fixtures
 */
export const performanceFixtures = {
    /**
     * Generate large array of entities for performance testing
     */
    largeEntitySet: (count = 10000) => Array.from({ length: count }, (_, i) => ({
        id: i,
        name: `Entity${i}`,
        position: [
            Math.random() * 100 - 50,
            Math.random() * 100 - 50,
            Math.random() * 100 - 50,
        ],
    })),
    /**
     * Generate stress test mesh data
     */
    largeMesh: (vertexCount = 10000) => ({
        vertices: new Float32Array(vertexCount * 3).map(() => Math.random() * 10 - 5),
        indices: new Uint16Array(vertexCount).map((_, i) => i),
    }),
};
//# sourceMappingURL=index.js.map