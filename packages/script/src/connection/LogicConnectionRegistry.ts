import type { Scene } from '@engine/world';
import type { LogicConnectionManager } from '../connection/LogicConnectionManager';

const sceneConnectionManagers = new WeakMap<Scene, LogicConnectionManager>();

export function registerLogicConnectionManager(
  scene: Scene,
  manager: LogicConnectionManager
): void {
  sceneConnectionManagers.set(scene, manager);
}

export function unregisterLogicConnectionManager(
  scene: Scene,
  manager: LogicConnectionManager
): void {
  const current = sceneConnectionManagers.get(scene);
  if (current === manager) {
    sceneConnectionManagers.delete(scene);
  }
}

export function getLogicConnectionManager(
  scene: Scene | null | undefined
): LogicConnectionManager | null {
  if (!scene) {
    return null;
  }
  return sceneConnectionManagers.get(scene) ?? null;
}
