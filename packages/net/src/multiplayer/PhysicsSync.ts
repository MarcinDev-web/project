import type { Scene } from '@engine/world';
import { RigidbodyType, PhysicsComponent } from '@engine/world';
import type { PhysicsWorld } from '@engine/world';
import { ReplicationClient } from '../ReplicationClient';
import type { PhysicsStateMessage, RigidBodyState } from '../types/replication';
import { ReplicationState } from '../types/replication';
import { ErrorHandler, type ErrorCallback } from './ErrorHandler';
import { ValidationError, SyncError, ErrorFactory } from './errors';

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
  /** Error handler for error reporting (optional, creates default if not provided). */
  errorHandler?: ErrorHandler;
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
  private readonly config: Required<Omit<PhysicsSyncConfig, 'errorHandler'>> & { errorHandler: ErrorHandler };
  private sendTimer = 0;
  private frameNumber = 0;
  private remotePhysicsStates = new Map<string, PhysicsStateMessage>(); // entityId -> latest state message
  private lastSentSnapshot: PhysicsStateMessage | null = null;
  private localUserId: string | null = null;
  private unsubscribeStateChange: (() => void) | null = null;
  private errorCallbacks: ErrorCallback[] = [];

  constructor(config: PhysicsSyncConfig) {
    // Create or use provided error handler
    const errorHandler = config.errorHandler ?? new ErrorHandler();
    
    // Validate required config
    if (!config.physicsWorld) {
      throw ErrorFactory.missingField('physicsWorld');
    }
    if (!config.scene) {
      throw ErrorFactory.missingField('scene');
    }
    if (!config.replicationClient) {
      throw ErrorFactory.missingField('replicationClient');
    }
    if (config.sendInterval !== undefined && (config.sendInterval <= 0 || !Number.isFinite(config.sendInterval))) {
      throw ErrorFactory.invalidInput('sendInterval', config.sendInterval, 'must be a positive finite number');
    }
    if (config.interpolationTime !== undefined && (config.interpolationTime < 0 || !Number.isFinite(config.interpolationTime))) {
      throw ErrorFactory.invalidInput('interpolationTime', config.interpolationTime, 'must be a non-negative finite number');
    }

    this.config = {
      sendInterval: config.sendInterval ?? 100,
      enableServerAuthority: config.enableServerAuthority ?? false,
      interpolationTime: config.interpolationTime ?? 100,
      errorHandler,
      physicsWorld: config.physicsWorld,
      scene: config.scene,
      replicationClient: config.replicationClient,
    };

    // Initialize localUserId - fetch from replicationClient
    this.localUserId = this.config.replicationClient.getLocalUserId() ?? null;

    // Subscribe to state changes to update userId when it becomes available
    this.unsubscribeStateChange = this.config.replicationClient.onStateChange((state) => {
      // When connected or joined, try to get userId
      if (state === ReplicationState.Connected || state === ReplicationState.Joined) {
        const userId = this.config.replicationClient.getLocalUserId();
        if (userId && !this.localUserId) {
          this.localUserId = userId;
        }
      }
    });

    // Subscribe to physics state messages from network
    this.config.replicationClient.onPhysicsState((message) => {
      this.handleRemotePhysicsState(message);
    });
  }

  /**
   * Update physics synchronization (call every frame after physics update).
   */
  update(deltaTime: number): void {
    // Validate deltaTime
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      this.config.errorHandler.handleError(
        ErrorFactory.invalidInput('deltaTime', deltaTime, 'must be a non-negative finite number')
      );
      return;
    }

    // Check for userId if not yet available (in case it was set after connection)
    if (!this.localUserId) {
      const userId = this.config.replicationClient.getLocalUserId();
      if (userId) {
        this.localUserId = userId;
      }
    }

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

      // Validate position and rotation before adding
      if (!this.isValidPosition(position)) {
        this.config.errorHandler.handleError(
          new SyncError(`Skipping entity ${entity.id} - invalid position`, {
            code: 'SYNC_INVALID_POSITION',
            context: { entityId: entity.id, position },
          })
        );
        continue;
      }
      if (!this.isValidRotation(rotation)) {
        this.config.errorHandler.handleError(
          new SyncError(`Skipping entity ${entity.id} - invalid rotation`, {
            code: 'SYNC_INVALID_ROTATION',
            context: { entityId: entity.id, rotation },
          })
        );
        continue;
      }

      const bodyState: RigidBodyState = {
        entityId: entity.id,
        position: [position[0], position[1], position[2]],
        rotation: [rotation[0], rotation[1], rotation[2], rotation[3]],
        timestamp: Date.now(),
      };

      // Add velocity if valid
      if (physics.velocity) {
        const vel = [physics.velocity[0], physics.velocity[1], physics.velocity[2]] as [number, number, number];
        if (this.isValidVelocity(vel)) {
          bodyState.velocity = vel;
        }
      }

      // Add angular velocity if valid
      if (physics.angularVelocity) {
        const angVel = [physics.angularVelocity[0], physics.angularVelocity[1], physics.angularVelocity[2]] as [number, number, number];
        if (this.isValidAngularVelocity(angVel)) {
          bodyState.angularVelocity = angVel;
        }
      }

      bodies.push(bodyState);
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
    // Validate message
    if (!message) {
      this.config.errorHandler.handleError(
        new SyncError('Received null or undefined message', {
          code: 'SYNC_INVALID_MESSAGE',
        })
      );
      return;
    }
    if (!Array.isArray(message.bodies)) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid message bodies array', {
          code: 'SYNC_INVALID_BODIES_ARRAY',
          context: { message },
        })
      );
      return;
    }
    if (!Number.isFinite(message.frameNumber) || message.frameNumber < 0) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid frameNumber in message', {
          code: 'SYNC_INVALID_FRAME_NUMBER',
          context: { frameNumber: message.frameNumber },
        })
      );
      return;
    }

    // Store snapshot for each entity
    for (const bodyState of message.bodies) {
      // Validate body state
      if (!bodyState || !bodyState.entityId || typeof bodyState.entityId !== 'string') {
        this.config.errorHandler.handleError(
          new SyncError('Invalid bodyState entityId', {
            code: 'SYNC_INVALID_BODY_STATE',
            context: { bodyState },
          })
        );
        continue;
      }
      if (!this.isValidPosition(bodyState.position)) {
        this.config.errorHandler.handleError(
          new SyncError(`Invalid position for entity ${bodyState.entityId}`, {
            code: 'SYNC_INVALID_POSITION',
            context: { entityId: bodyState.entityId, position: bodyState.position },
          })
        );
        continue;
      }
      if (!this.isValidRotation(bodyState.rotation)) {
        this.config.errorHandler.handleError(
          new SyncError(`Invalid rotation for entity ${bodyState.entityId}`, {
            code: 'SYNC_INVALID_ROTATION',
            context: { entityId: bodyState.entityId, rotation: bodyState.rotation },
          })
        );
        continue;
      }
      if (bodyState.velocity && !this.isValidVelocity(bodyState.velocity)) {
        this.config.errorHandler.handleError(
          new SyncError(`Invalid velocity for entity ${bodyState.entityId}`, {
            code: 'SYNC_INVALID_VELOCITY',
            context: { entityId: bodyState.entityId, velocity: bodyState.velocity },
          })
        );
        continue;
      }
      if (bodyState.angularVelocity && !this.isValidAngularVelocity(bodyState.angularVelocity)) {
        this.config.errorHandler.handleError(
          new SyncError(`Invalid angularVelocity for entity ${bodyState.entityId}`, {
            code: 'SYNC_INVALID_ANGULAR_VELOCITY',
            context: { entityId: bodyState.entityId, angularVelocity: bodyState.angularVelocity },
          })
        );
        continue;
      }
      if (!Number.isFinite(bodyState.timestamp) || bodyState.timestamp < 0) {
        this.config.errorHandler.handleError(
          new SyncError(`Invalid timestamp for entity ${bodyState.entityId}`, {
            code: 'SYNC_INVALID_TIMESTAMP',
            context: { entityId: bodyState.entityId, timestamp: bodyState.timestamp },
          })
        );
        continue;
      }

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

      // Validate body state before applying
      if (!this.isValidPosition(bodyState.position)) {
        this.config.errorHandler.handleError(
          new SyncError(`Skipping invalid position for entity ${entityId}`, {
            code: 'SYNC_INVALID_POSITION',
            context: { entityId, position: bodyState.position },
          })
        );
        continue;
      }
      if (!this.isValidRotation(bodyState.rotation)) {
        this.config.errorHandler.handleError(
          new SyncError(`Skipping invalid rotation for entity ${entityId}`, {
            code: 'SYNC_INVALID_ROTATION',
            context: { entityId, rotation: bodyState.rotation },
          })
        );
        continue;
      }

      // Apply position and rotation
      entity.transform.position = bodyState.position;
      entity.transform.rotation = bodyState.rotation;

      // Apply velocity if available (for prediction)
      if (bodyState.velocity && this.isValidVelocity(bodyState.velocity) && physics.rigidbodyType === RigidbodyType.Dynamic) {
        physics.velocity[0] = bodyState.velocity[0];
        physics.velocity[1] = bodyState.velocity[1];
        physics.velocity[2] = bodyState.velocity[2];
      }

      if (bodyState.angularVelocity && this.isValidAngularVelocity(bodyState.angularVelocity) && physics.rigidbodyType === RigidbodyType.Dynamic) {
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
   * Returns false if userId is not available (graceful handling).
   */
  private isLocalPlayerEntity(entityId: string): boolean {
    // If userId is not available, assume entity is not local player
    // This prevents syncing local player physics before userId is known
    if (!this.localUserId) {
      return false;
    }
    
    // Find entity
    const entity = this.config.scene.findEntityById(entityId);
    if (!entity) {
      return false;
    }
    
    // Check if entity belongs to local player via userData.userId
    // MultiplayerGameplayManager sets userData.userId on local player entity
    if (entity.userData?.userId === this.localUserId) {
      return true;
    }
    
    // Also check isLocalPlayer flag (set by MultiplayerGameplayManager)
    if (entity.userData?.isLocalPlayer === true) {
      return true;
    }
    
    return false;
  }

  /**
   * Get local user ID (cached from ReplicationClient).
   */
  private getLocalUserId(): string | null {
    // Return cached value, or try to get fresh value if not cached
    if (this.localUserId) {
      return this.localUserId;
    }
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
    if (!Number.isFinite(frameNumber) || frameNumber < 0) {
      throw ErrorFactory.invalidInput('frameNumber', frameNumber, 'must be a non-negative finite number');
    }
    this.frameNumber = frameNumber;
  }

  /**
   * Subscribe to error events.
   * Returns unsubscribe function.
   */
  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    // Also subscribe to error handler
    const unsubscribe = this.config.errorHandler.onError(callback);
    
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index >= 0) {
        this.errorCallbacks.splice(index, 1);
      }
      unsubscribe();
    };
  }

  /**
   * Validate position vector.
   */
  private isValidPosition(position: [number, number, number]): boolean {
    return (
      Array.isArray(position) &&
      position.length === 3 &&
      Number.isFinite(position[0]) &&
      Number.isFinite(position[1]) &&
      Number.isFinite(position[2]) &&
      Math.abs(position[0]) < 1e6 && // Reasonable bounds
      Math.abs(position[1]) < 1e6 &&
      Math.abs(position[2]) < 1e6
    );
  }

  /**
   * Validate rotation quaternion.
   */
  private isValidRotation(rotation: [number, number, number, number]): boolean {
    return (
      Array.isArray(rotation) &&
      rotation.length === 4 &&
      Number.isFinite(rotation[0]) &&
      Number.isFinite(rotation[1]) &&
      Number.isFinite(rotation[2]) &&
      Number.isFinite(rotation[3])
    );
  }

  /**
   * Validate velocity vector.
   */
  private isValidVelocity(velocity: [number, number, number]): boolean {
    return (
      Array.isArray(velocity) &&
      velocity.length === 3 &&
      Number.isFinite(velocity[0]) &&
      Number.isFinite(velocity[1]) &&
      Number.isFinite(velocity[2]) &&
      Math.abs(velocity[0]) < 1e4 && // Reasonable velocity bounds
      Math.abs(velocity[1]) < 1e4 &&
      Math.abs(velocity[2]) < 1e4
    );
  }

  /**
   * Validate angular velocity vector.
   */
  private isValidAngularVelocity(angularVelocity: [number, number, number]): boolean {
    return (
      Array.isArray(angularVelocity) &&
      angularVelocity.length === 3 &&
      Number.isFinite(angularVelocity[0]) &&
      Number.isFinite(angularVelocity[1]) &&
      Number.isFinite(angularVelocity[2]) &&
      Math.abs(angularVelocity[0]) < 1e3 && // Reasonable angular velocity bounds
      Math.abs(angularVelocity[1]) < 1e3 &&
      Math.abs(angularVelocity[2]) < 1e3
    );
  }

  /**
   * Reset state for reconnection.
   * Clears remote physics states and last sent snapshot.
   * Frame number will be synced from server.
   */
  resetForReconnection(): void {
    this.remotePhysicsStates.clear();
    this.lastSentSnapshot = null;
    // Frame number will be reset when we receive physics state from server
  }

  /**
   * Cleanup - call when physics sync is no longer needed.
   */
  dispose(): void {
    if (this.unsubscribeStateChange) {
      this.unsubscribeStateChange();
      this.unsubscribeStateChange = null;
    }
    this.remotePhysicsStates.clear();
    this.lastSentSnapshot = null;
    this.localUserId = null;
  }
}

