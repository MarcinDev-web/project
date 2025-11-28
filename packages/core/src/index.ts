/**
 * @engine/core - Foundation Layer
 *
 * Low-level utilities used throughout the engine.
 * Zero dependencies on other @engine/* packages.
 */

export * from './math';
export * from './ecs';
export * from './event';
export * from './job';
export * from './utils';
export * from './script';
export * from './memory';
export * from './result';
export * from './plugin';

// Explicit re-exports for better bundler compatibility
export {
  getGlobalRNG,
  initGlobalRNG,
  resetGlobalRNG,
  isGlobalRNGInitialized,
  SeededRNG,
} from './utils/SeededRNG';
