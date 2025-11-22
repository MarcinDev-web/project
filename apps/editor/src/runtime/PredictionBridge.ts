import type { Scene } from '@engine/world';
import type { AuthoritativeStateDiff } from '@engine/world/sim/AuthoritativeWorld';
import { type Vec3, type Quat, quatToEuler, quatFromEulerOut } from '@engine/core/math';

interface PredictionBridgeConfig {
  scene: Scene;
  maxHistory?: number;
  correctionThreshold?: number;
}

type Snapshot = Map<string, { position: Vec3; rotation: Vec3 }>;

export class PredictionBridge {
  private readonly scene: Scene;
  private readonly history = new Map<number, Snapshot>();
  private readonly maxHistory: number;
  private readonly correctionThreshold: number;

  constructor(config: PredictionBridgeConfig) {
    this.scene = config.scene;
    this.maxHistory = config.maxHistory ?? 120;
    this.correctionThreshold = config.correctionThreshold ?? 0.1;
  }

  captureLocalState(tick: number): void {
    const snapshot: Snapshot = new Map();
    for (const entity of this.scene.getActiveEntities()) {
      snapshot.set(entity.id, {
        position: [...(entity.transform.position as Vec3)] as Vec3,
        rotation: [...quatToEuler(entity.transform.rotation as Quat)] as Vec3,
      });
    }
    this.history.set(tick, snapshot);
    if (this.history.size > this.maxHistory) {
      const oldestTick = Math.min(...this.history.keys());
      this.history.delete(oldestTick);
    }
  }

  applyAuthoritativeDiff(diff: AuthoritativeStateDiff): void {
    for (const entry of diff.entities) {
      const entity = this.scene.findEntityById(entry.id);
      if (!entity) continue;
      this.blendTransform(entity.transform.position as Vec3, entry.position);
      this.blendRotation(entity.transform.rotation as Quat, entry.rotation);
    }
  }

  private blendRotation(current: Quat, target: Vec3): void {
    const currentEuler = quatToEuler(current);
    const delta =
      Math.abs(currentEuler[0] - target[0]) +
      Math.abs(currentEuler[1] - target[1]) +
      Math.abs(currentEuler[2] - target[2]);

    if (delta < this.correctionThreshold) {
      return;
    }
    currentEuler[0] = (currentEuler[0] + target[0]) / 2;
    currentEuler[1] = (currentEuler[1] + target[1]) / 2;
    currentEuler[2] = (currentEuler[2] + target[2]) / 2;
    quatFromEulerOut(current, currentEuler);
  }

  private blendTransform(current: Vec3, target: Vec3): void {
    const delta =
      Math.abs(current[0] - target[0]) +
      Math.abs(current[1] - target[1]) +
      Math.abs(current[2] - target[2]);
    if (delta < this.correctionThreshold) {
      return;
    }
    current[0] = (current[0] + target[0]) / 2;
    current[1] = (current[1] + target[1]) / 2;
    current[2] = (current[2] + target[2]) / 2;
  }
}

