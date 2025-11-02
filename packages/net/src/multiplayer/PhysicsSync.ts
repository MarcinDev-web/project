import type { Scene } from '@engine/world';
import { RigidbodyType, PhysicsComponent } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import { ReplicationClient } from '../ReplicationClient';
import type { PhysicsStateMessage, RigidBodyState } from '../types/replication';

/**
 * Configuration for PhysicsSync.
 */
export interface PhysicsSyncConfig {
  /** Physics world to sync. */
  physicsWorld: PhysicsWorld;
  /** Scene containing entities. */
  scene: Scene;
  /** Replication client for network communication. */
  replicationClient: ReplicationClient;
  /** How often to send physics updates (in milliseconds). */
  sendInterval?: number; // Default: 100ms (10 updates per second)
  /** Enable server authority (client predicts, server corrects). */
  enableServerAuthority?: boolean; // Default: false (client-authoritative for now)
  /** Interpolation time for remote physics objects (in milliseconds). */
  interpolationTime?: number; // Default: 100ms
}

/**
 * Synchronizes physics state across network.
 * Handles:
 * - Sending local physics state (rigid bodies positions/velocities)
 * - Receiving and applying remote physics states
 * - Interpolation for smooth movement
 * - Deterministic simulation sync (via frame numbers)
 * 
 * Note: Full deterministic physics requires fixed timestep on all clients.
 */
export class PhysicsSync {
  private readonly config: Required<PhysicsSyncConfig>;
  private sendTimer = 0;
  private frameNumber = 0;
  private remotePhysicsStates = new Map<string, PhysicsStateMessage>(); // entityId -> latest state message
  private lastSentSnapshot: PhysicsStateMessage | null = null;

  constructor(config: PhysicsSyncConfig) {
    this.config = {
      sendInterval: config.sendInterval ?? 100,
      enableServerAuthority: config.enableServerAuthority ?? false,
      interpolationTime: config.interpolationTime ?? 100,
      ...config,
    };

    // Subscribe to physics state messages from network
    this.config.replicationClient.onPhysicsState((message) => {
      this.handleRemotePhysicsState(message);
    });
  }

  /**
   * Update physics synchronization (call every frame after physics update).
   */
  update(deltaTime: number): void {
    // Increment frame number for deterministic simulation
    this.frameNumber++;

    // Send physics state at interval
    this.sendTimer += deltaTime * 1000; // Convert to milliseconds
    if (this.sendTimer >= this.config.sendInterval) {
      this.sendPhysicsState();
      this.sendTimer = 0;
    }

    // Apply remote physics states with interpolation
    this.applyRemotePhysicsStates(deltaTime);
  }

  /**
   * Send current physics state to server.
   */
  private sendPhysicsState(): void {
    const bodies: RigidBodyState[] = [];

    // Collect all dynamic rigid bodies
    const entities = this.config.scene.queryEntities(PhysicsComponent);
    
    for (const entity of entities) {
      const physics = entity.getComponent(PhysicsComponent);
      if (!physics) continue;

      // Only sync dynamic rigid bodies (not static or kinematic)
      if (physics.rigidbodyType !== RigidbodyType.Dynamic) continue;

      // Skip local player entities
      if (this.isLocalPlayerEntity(entity.id)) continue;

      const position = entity.transform.position;
      const rotation = entity.transform.rotation;

      bodies.push({
        entityId: entity.id,
        position: [position[0], position[1], position[2]],
        rotation: [rotation[0], rotation[1], rotation[2], rotation[3]],
        ...(physics.velocity && { velocity: [physics.velocity[0], physics.velocity[1], physics.velocity[2]] as [number, number, number] }),
        ...(physics.angularVelocity && { angularVelocity: [physics.angularVelocity[0], physics.angularVelocity[1], physics.angularVelocity[2]] as [number, number, number] }),
        timestamp: Date.now(),
      });
    }

    // Only send if there are bodies and state changed
    if (bodies.length === 0) return;

    const snapshot: Omit<PhysicsStateMessage, 'type' | 'timestamp' | 'sessionId' | 'userId'> = {
      frameNumber: this.frameNumber,
      bodies,
    };

    // Check if state changed significantly
    if (this.lastSentSnapshot && this.isStateSimilar(this.lastSentSnapshot, snapshot)) {
      return;
    }

    // Send as dedicated physics state message
    this.config.replicationClient.sendPhysicsState(snapshot);

    // Store last sent snapshot for comparison
    this.lastSentSnapshot = {
      type: 'physics-state',
      timestamp: Date.now(),
      ...snapshot,
    };
  }

  /**
   * Handle remote physics state from network.
   */
  private handleRemotePhysicsState(message: PhysicsStateMessage): void {
    // Store snapshot for each entity
    for (const bodyState of message.bodies) {
      // Skip local player's physics (we control it)
      if (this.isLocalPlayerEntity(bodyState.entityId)) {
        continue;
      }

      this.remotePhysicsStates.set(bodyState.entityId, message);
    }
  }

  /**
   * Apply remote physics states with interpolation.
   */
  private applyRemotePhysicsStates(_deltaTime: number): void {
    for (const [entityId, message] of this.remotePhysicsStates.entries()) {
      // Find the body state for this entity in the message
      const bodyState = message.bodies.find(b => b.entityId === entityId);
      if (!bodyState) continue;

      // Find entity
      const entity = this.config.scene.findEntityById(entityId);
      if (!entity) continue;

      const physics = entity.getComponent(PhysicsComponent);
      if (!physics) continue;

      // Apply position and rotation
      entity.transform.position = bodyState.position;
      if (bodyState.rotation) {
        entity.transform.rotation = bodyState.rotation;
      }

      // Apply velocity if available (for prediction)
      if (bodyState.velocity && physics.rigidbodyType === RigidbodyType.Dynamic) {
        physics.velocity[0] = bodyState.velocity[0];
        physics.velocity[1] = bodyState.velocity[1];
        physics.velocity[2] = bodyState.velocity[2];
      }

      if (bodyState.angularVelocity && physics.rigidbodyType === RigidbodyType.Dynamic) {
        physics.angularVelocity[0] = bodyState.angularVelocity[0];
        physics.angularVelocity[1] = bodyState.angularVelocity[1];
        physics.angularVelocity[2] = bodyState.angularVelocity[2];
      }
    }
  }

  /**
   * Check if physics state is similar enough to skip sending.
   */
  private isStateSimilar(a: PhysicsStateMessage, b: Omit<PhysicsStateMessage, 'type' | 'timestamp' | 'sessionId' | 'userId'>): boolean {
    if (a.bodies.length !== b.bodies.length) {
      return false;
    }

    // Compare each body
    for (let i = 0; i < a.bodies.length; i++) {
      const bodyA = a.bodies[i];
      const bodyB = b.bodies[i];
      if (!bodyA || !bodyB || bodyA.entityId !== bodyB.entityId) {
        return false;
      }

      // Check position difference
      const dx = bodyA.position[0] - bodyB.position[0];
      const dy = bodyA.position[1] - bodyB.position[1];
      const dz = bodyA.position[2] - bodyB.position[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance > 0.05) { // Threshold: 5cm
        return false;
      }

      // Check velocity difference if available
      if (bodyA.velocity && bodyB.velocity) {
        const vx = bodyA.velocity[0] - bodyB.velocity[0];
        const vy = bodyA.velocity[1] - bodyB.velocity[1];
        const vz = bodyA.velocity[2] - bodyB.velocity[2];
        const velDiff = Math.sqrt(vx * vx + vy * vy + vz * vz);

        if (velDiff > 0.1) { // Threshold: 0.1 units/s
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Check if entity is local player (should not sync its physics).
   */
  private isLocalPlayerEntity(entityId: string): boolean {
    const localUserId = this.getLocalUserId();
    if (!localUserId) {
      return false;
    }
    
    // Check if entity belongs to local player
    // This is a simple check - in a full implementation, you might need
    // to track which entities belong to which player
    // For now, we'll assume entities with userData.userId === localUserId are local player's
    const entity = this.config.scene.findEntityById(entityId);
    if (entity && entity.userData?.userId === localUserId) {
      return true;
    }
    
    return false;
  }

  /**
   * Get local user ID (should be provided by ReplicationClient or auth system).
   */
  private getLocalUserId(): string | null {
    return this.config.replicationClient.getLocalUserId();
  }

  /**
   * Get current frame number (for deterministic simulation).
   */
  getFrameNumber(): number {
    return this.frameNumber;
  }

  /**
   * Reset frame number (call when synchronizing with server).
   */
  resetFrameNumber(frameNumber: number): void {
    this.frameNumber = frameNumber;
  }

  /**
   * Cleanup - call when physics sync is no longer needed.
   */
  dispose(): void {
    this.remotePhysicsStates.clear();
    this.lastSentSnapshot = null;
  }
}

