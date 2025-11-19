import type { Scene } from '../core/Scene.js';
import type { PhysicsWorld } from '../physics/PhysicsWorld.js';
import type { IntentFrame } from '../net/InputChannel.js';
import type { EntityId } from '../core/Entity.js';
import type { Quat, Vec3 } from '@engine/core/math';
import { vec3Equals, quatToEuler } from '@engine/core/math';

export interface AuthoritativeWorldConfig {
  scene: Scene;
  physicsWorld?: PhysicsWorld;
  tickRate?: number;
  logger?: {
    debug: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
  };
}

export type IntentHandler = (frame: IntentFrame, deltaSeconds: number, scene: Scene) => void;

export interface AuthoritativeStateDiff {
  tick: number;
  timestamp: number;
  entities: Array<{
    id: EntityId;
    position: Vec3;
    rotation: Vec3;
  }>;
}

interface TransformSnapshot {
  position: Vec3;
  rotation: Vec3;
}

export class AuthoritativeWorld {
  private readonly scene: Scene;
  private readonly physicsWorld: PhysicsWorld | undefined;
  private readonly logger?: AuthoritativeWorldConfig['logger'];
  private readonly tickDurationMs: number;
  private readonly intentQueues = new Map<string, IntentFrame[]>();
  private readonly handlers = new Map<string, IntentHandler>();
  private readonly subscribers = new Set<(diff: AuthoritativeStateDiff) => void>();
  private readonly transformSnapshot = new Map<EntityId, TransformSnapshot>();
  private accumulator = 0;
  private lastTimestamp = 0;
  private currentTick = 0;

  constructor(config: AuthoritativeWorldConfig) {
    this.scene = config.scene;
    this.physicsWorld = config.physicsWorld;
    this.logger = config.logger;
    const tickRate = config.tickRate ?? 60;
    this.tickDurationMs = 1000 / tickRate;
  }

  registerIntentHandler(playerId: string, handler: IntentHandler): void {
    this.handlers.set(playerId, handler);
  }

  enqueueIntent(frame: IntentFrame): void {
    const queue = this.intentQueues.get(frame.actorId) ?? [];
    queue.push(frame);
    this.intentQueues.set(frame.actorId, queue);
  }

  onStateDiff(listener: (diff: AuthoritativeStateDiff) => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  update(now: number = Date.now()): void {
    if (this.lastTimestamp === 0) {
      this.lastTimestamp = now;
      return;
    }

    this.accumulator += now - this.lastTimestamp;
    this.lastTimestamp = now;

    while (this.accumulator >= this.tickDurationMs) {
      this.step(this.tickDurationMs / 1000);
      this.accumulator -= this.tickDurationMs;
      this.currentTick += 1;
    }
  }

  dispose(): void {
    this.intentQueues.clear();
    this.handlers.clear();
    this.subscribers.clear();
    this.transformSnapshot.clear();
  }

  private step(deltaSeconds: number): void {
    for (const [playerId, handler] of this.handlers.entries()) {
      const queue = this.intentQueues.get(playerId);
      if (!queue || queue.length === 0) {
        continue;
      }
      const frame = queue.shift()!;
      try {
        handler(frame, deltaSeconds, this.scene);
      } catch (error) {
        this.logger?.warn?.('AuthoritativeWorld: handler failure', { playerId, error });
      }
    }

    this.physicsWorld?.update(deltaSeconds);
    const diff = this.captureDiff();
    if (diff.entities.length > 0) {
      this.emit(diff);
    }
  }

  private captureDiff(): AuthoritativeStateDiff {
    const changes: AuthoritativeStateDiff['entities'] = [];
    for (const entity of this.scene.getActiveEntities()) {
      const position = entity.transform.position as Vec3;
      const rotationQuat = entity.transform.rotation as Quat;
      const rotation = quatToEuler(rotationQuat);
      const snapshot = this.transformSnapshot.get(entity.id);
      if (!snapshot || !vec3Equals(snapshot.position, position) || !vec3Equals(snapshot.rotation, rotation)) {
        const nextSnapshot: TransformSnapshot = {
          position: [...position] as Vec3,
          rotation: [...rotation] as Vec3,
        };
        this.transformSnapshot.set(entity.id, nextSnapshot);
        changes.push({
          id: entity.id,
          position: nextSnapshot.position,
          rotation: nextSnapshot.rotation,
        });
      }
    }

    return {
      tick: this.currentTick,
      timestamp: Date.now(),
      entities: changes,
    };
  }

  private emit(diff: AuthoritativeStateDiff): void {
    for (const listener of this.subscribers) {
      try {
        listener(diff);
      } catch (error) {
        this.logger?.warn?.('AuthoritativeWorld: diff listener error', error as Error);
      }
    }
  }
}

