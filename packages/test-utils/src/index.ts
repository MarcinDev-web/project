/**
 * @engine/test-utils
 *
 * Reusable test utilities, mocks, fixtures, and helpers
 * for consistent testing across all packages.
 *
 * @module
 *
 * ## Modules
 *
 * - **mocks** - Mock objects for WebGPU, Canvas, EventBus, etc.
 * - **fixtures** - Pre-configured test data (vectors, transforms, entities)
 * - **assertions** - Custom assertions (vectors, matrices, disposal)
 * - **helpers** - Test utilities (waitFor, benchmark, deferred promises)
 * - **snapshots** - Snapshot testing for serialization
 * - **determinism** - Deterministic RNG and state testing
 * - **integration** - Cross-package integration testing framework
 * - **performance** - Performance regression testing with baselines
 * - **visual** - Visual regression testing for renderer
 *
 * @example
 * ```typescript
 * import {
 *   createMockCanvas,
 *   createMockGPUDevice,
 *   expectVec3ToBeCloseTo,
 *   runPerformanceTest,
 *   performanceBudgets,
 * } from '@engine/test-utils';
 * ```
 */

export * from './mocks';
export * from './fixtures';
export * from './assertions';
export * from './helpers';
export * from './snapshots';
export * from './determinism';
export * from './integration';
export * from './performance';
export * from './visual';
export * from './bots/Swarm';
export * from './netsim/LinkSimulator';
