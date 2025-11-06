import type { Scene } from '@engine/world';
import type { LogicCubeSystem } from './LogicCubeSystem.js';

const sceneLogicCubeSystems = new WeakMap<Scene, LogicCubeSystem>();

/**
 * Registers a LogicCubeSystem for a scene
 */
export function registerLogicCubeSystem(scene: Scene, system: LogicCubeSystem): void {
  sceneLogicCubeSystems.set(scene, system);
}

/**
 * Unregisters a LogicCubeSystem from a scene
 */
export function unregisterLogicCubeSystem(scene: Scene, system: LogicCubeSystem): void {
  const current = sceneLogicCubeSystems.get(scene);
  if (current === system) {
    sceneLogicCubeSystems.delete(scene);
  }
}

/**
 * Gets the LogicCubeSystem for a scene
 */
export function getLogicCubeSystem(scene: Scene | null | undefined): LogicCubeSystem | null {
  if (!scene) {
    return null;
  }
  return sceneLogicCubeSystems.get(scene) ?? null;
}

