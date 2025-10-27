/**
 * Test fixtures - pre-configured test data
 */

/**
 * Common vector fixtures
 */
export const vec3Fixtures = {
  zero: [0, 0, 0] as const,
  one: [1, 1, 1] as const,
  unitX: [1, 0, 0] as const,
  unitY: [0, 1, 0] as const,
  unitZ: [0, 0, 1] as const,
  up: [0, 1, 0] as const,
  down: [0, -1, 0] as const,
  forward: [0, 0, -1] as const,
  back: [0, 0, 1] as const,
  left: [-1, 0, 0] as const,
  right: [1, 0, 0] as const,
};

/**
 * Common transform fixtures
 */
export const transformFixtures = {
  identity: {
    position: [0, 0, 0] as const,
    rotation: [0, 0, 0, 1] as const,
    scale: [1, 1, 1] as const,
  },
  atOrigin: {
    position: [0, 0, 0] as const,
    rotation: [0, 0, 0, 1] as const,
    scale: [1, 1, 1] as const,
  },
  offset: {
    position: [10, 5, -3] as const,
    rotation: [0, 0, 0, 1] as const,
    scale: [1, 1, 1] as const,
  },
  scaled: {
    position: [0, 0, 0] as const,
    rotation: [0, 0, 0, 1] as const,
    scale: [2, 2, 2] as const,
  },
};

/**
 * Common entity fixtures
 */
export interface EntityFixture {
  id: number;
  name: string;
  components?: Record<string, unknown>;
}

export const entityFixtures = {
  simple: (): EntityFixture => ({
    id: 1,
    name: 'TestEntity',
  }),
  withTransform: (): EntityFixture => ({
    id: 2,
    name: 'TransformEntity',
    components: {
      transform: transformFixtures.identity,
    },
  }),
  withMesh: (): EntityFixture => ({
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
  largeEntitySet: (count = 10000) =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      name: `Entity${i}`,
      position: [Math.random() * 100 - 50, Math.random() * 100 - 50, Math.random() * 100 - 50],
    })),

  /**
   * Generate stress test mesh data
   */
  largeMesh: (vertexCount = 10000) => ({
    vertices: new Float32Array(vertexCount * 3).map(() => Math.random() * 10 - 5),
    indices: new Uint16Array(vertexCount).map((_, i) => i),
  }),
};
