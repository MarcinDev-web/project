import type { Entity } from '@engine/world';
import { CharacterController, HealthComponent, ShieldComponent, PowerUpComponent } from '@engine/world';
import { ReplicationClient } from '../ReplicationClient';
import type { PlayerUpdateMessage } from '../types/replication';
import { ReplicationState } from '../types/replication';
import type { Vec3 } from '@engine/core/math';
import { lerpVec3, quatSlerp } from '@engine/core/math';
import { ErrorHandler, type ErrorCallback } from './ErrorHandler';
import { SyncError, StateError, ErrorFactory } from './errors';

/**
 * Remote player data for interpolation.
 */
interface RemotePlayer {
  entity: Entity;
  position: Vec3;
  rotation?: [number, number, number, number] | undefined; // quaternion
  velocity?: Vec3 | undefined;
  lastUpdateTime: number;
  interpolationTime: number;
}

/**
 * Configuration for PlayerSync.
 */
export interface PlayerSyncConfig {
  /** Local player entity (the one controlled by this client). */
  localPlayerEntity: Entity;
  /** Replication client for network communication. */
  replicationClient: ReplicationClient;
  /** Local user ID (optional, if not provided will try to get from ReplicationClient). */
  localUserId?: string | null;
  /** How often to send position updates (in milliseconds). */
  sendInterval?: number; // Default: 100ms (10 updates per second)
  /** Interpolation time for remote players (in milliseconds). */
  interpolationTime?: number; // Default: 100ms
  /** Enable client-side prediction for local player. */
  enablePrediction?: boolean; // Default: true
  /** Error handler for error reporting (optional, creates default if not provided). */
  errorHandler?: ErrorHandler;
}

/**
 * Synchronizes player positions and state across network.
 * Handles:
 * - Sending local player position updates
 * - Receiving and interpolating remote player positions
 * - Client-side prediction for local player
 * - Lag compensation
 */
export class PlayerSync {
  private readonly config: Required<Omit<PlayerSyncConfig, 'errorHandler'>> & { errorHandler: ErrorHandler };
  private readonly remotePlayers = new Map<string, RemotePlayer>();
  private sendTimer = 0;
  private lastSentPosition: Vec3 | null = null;
  private readonly tempVec3: Vec3 = [0, 0, 0];
  private localUserId: string | null = null;
  private unsubscribeStateChange: (() => void) | null = null;
  private errorCallbacks: ErrorCallback[] = [];

  constructor(config: PlayerSyncConfig) {
    // Create or use provided error handler
    const errorHandler = config.errorHandler ?? new ErrorHandler();
    
    // Validate required config
    if (!config.localPlayerEntity) {
      throw ErrorFactory.missingField('localPlayerEntity');
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
    if (config.localUserId !== undefined && config.localUserId !== null && typeof config.localUserId !== 'string') {
      throw ErrorFactory.invalidInput('localUserId', config.localUserId, 'must be a string or null');
    }

    this.config = {
      sendInterval: config.sendInterval ?? 100,
      interpolationTime: config.interpolationTime ?? 100,
      enablePrediction: config.enablePrediction ?? true,
      localUserId: config.localUserId ?? null,
      errorHandler,
      localPlayerEntity: config.localPlayerEntity,
      replicationClient: config.replicationClient,
    };

    // Initialize localUserId - fetch from replicationClient if not provided
    this.localUserId = this.config.localUserId ?? this.config.replicationClient.getLocalUserId() ?? null;

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

    // Subscribe to player updates from network
    this.config.replicationClient.onPlayerUpdate((message) => {
      this.handleRemotePlayerUpdate(message);
    });
  }

  /**
   * Update player synchronization (call every frame).
   * Sends local player position if needed and interpolates remote players.
   */
  update(deltaTime: number): void {
    // Validate deltaTime
    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      this.config.errorHandler.handleError(
        ErrorFactory.invalidInput('deltaTime', deltaTime, 'must be a non-negative finite number'),
        { skipThrottle: false }
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

    // Send local player position update at interval
    this.sendTimer += deltaTime * 1000; // Convert to milliseconds
    if (this.sendTimer >= this.config.sendInterval) {
      this.sendLocalPlayerUpdate();
      this.sendTimer = 0;
    }

    // Interpolate remote players
    this.updateRemotePlayers(deltaTime);
  }

  /**
   * Send local player position update to server.
   */
  private sendLocalPlayerUpdate(): void {
    const entity = this.config.localPlayerEntity;
    if (!entity) return;

    const controller = entity.getComponent(CharacterController);
    if (!controller) return;

    const position = entity.transform.position; // Getter returns copy
    
    // Validate position
    if (!this.isValidPosition(position)) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid position, skipping update', {
          code: 'SYNC_INVALID_POSITION',
          context: { entityId: entity.id, position },
        })
      );
      return;
    }
    
    // Only send if position changed significantly (optimization)
    if (this.lastSentPosition) {
      const dx = position[0] - this.lastSentPosition[0];
      const dy = position[1] - this.lastSentPosition[1];
      const dz = position[2] - this.lastSentPosition[2];
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      // Skip update if movement is very small
      if (distance < 0.01) {
        return;
      }
    }

    // Get rotation if available (from transform - getter returns copy)
    const rotation = entity.transform.rotation;
    
    // Validate rotation
    if (rotation && !this.isValidRotation(rotation)) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid rotation, skipping rotation in update', {
          code: 'SYNC_INVALID_ROTATION',
          context: { entityId: entity.id },
        })
      );
      // Continue without rotation
    }

    // Get velocity if available from controller
    const velocity = controller.velocity ? [controller.velocity[0], controller.velocity[1], controller.velocity[2]] as [number, number, number] : undefined;
    
    // Validate velocity
    if (velocity && !this.isValidVelocity(velocity)) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid velocity, skipping velocity in update', {
          code: 'SYNC_INVALID_VELOCITY',
          context: { entityId: entity.id },
        })
      );
      // Continue without velocity
    }

    // Use localUserId instead of entity.id
    const localUserId = this.getLocalUserId();
    if (!localUserId) {
      this.config.errorHandler.handleError(
        new StateError('Cannot send update - localUserId not available', {
          code: 'STATE_MISSING_USER_ID',
          context: { entityId: entity.id },
          retryable: true,
        })
      );
      return;
    }

    // Gather additional state
    const health = entity.getComponent(HealthComponent);
    const shield = entity.getComponent(ShieldComponent);
    const powerUp = entity.getComponent(PowerUpComponent);

    this.config.replicationClient.sendPlayerUpdate({
      playerId: localUserId, // Use userId instead of entity.id
      position: [...position] as [number, number, number],
      ...(rotation && this.isValidRotation(rotation) && { rotation: [rotation[0], rotation[1], rotation[2], rotation[3]] as [number, number, number, number] }),
      ...(velocity !== undefined && this.isValidVelocity(velocity) && { velocity }),
      state: {
        isGrounded: controller.isGrounded,
        health: health ? health.currentHealth : undefined,
        maxHealth: health ? health.maxHealth : undefined,
        shield: shield ? shield.currentShield : undefined,
        maxShield: shield ? shield.maxShield : undefined,
        buffs: powerUp ? Array.from(powerUp.buffs.entries()) : undefined,
      },
    });

    this.lastSentPosition = [...position] as Vec3;
  }

  /**
   * Validate position vector.
   */
  private isValidPosition(position: Vec3): boolean {
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
   * Get local user ID from ReplicationClient.
   */
  private getLocalUserId(): string | null {
    if (this.localUserId) {
      return this.localUserId;
    }
    return this.config.replicationClient.getLocalUserId();
  }

  /**
   * Handle remote player update from network.
   */
  private handleRemotePlayerUpdate(message: PlayerUpdateMessage): void {
    // Validate message
    if (!message) {
      this.config.errorHandler.handleError(
        new SyncError('Received null or undefined message', {
          code: 'SYNC_INVALID_MESSAGE',
        })
      );
      return;
    }
    if (!message.position || !Array.isArray(message.position) || message.position.length !== 3) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid message position', {
          code: 'SYNC_INVALID_MESSAGE_POSITION',
          context: { message },
        })
      );
      return;
    }
    if (!this.isValidPosition(message.position as Vec3)) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid position values in message', {
          code: 'SYNC_INVALID_POSITION_VALUES',
          context: { position: message.position },
        })
      );
      return;
    }
    if (message.rotation && !this.isValidRotation(message.rotation)) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid rotation in message', {
          code: 'SYNC_INVALID_ROTATION',
          context: { rotation: message.rotation },
        })
      );
      return;
    }
    if (message.velocity && !this.isValidVelocity(message.velocity)) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid velocity in message', {
          code: 'SYNC_INVALID_VELOCITY',
          context: { velocity: message.velocity },
        })
      );
      return;
    }
    if (!Number.isFinite(message.timestamp) || message.timestamp < 0) {
      this.config.errorHandler.handleError(
        new SyncError('Invalid timestamp in message', {
          code: 'SYNC_INVALID_TIMESTAMP',
          context: { timestamp: message.timestamp },
        })
      );
      return;
    }
    
    // Sanity check: timestamp should not be in the future (allow small drift)
    const now = Date.now();
    if (message.timestamp > now + 1000) {
      this.config.errorHandler.handleError(
        new SyncError('Timestamp is too far in the future', {
          code: 'SYNC_INVALID_TIMESTAMP_FUTURE',
          context: { timestamp: message.timestamp, now },
        })
      );
      return;
    }
    
    // Sanity check: timestamp should not be too old (more than 10 seconds for player updates)
    if (message.timestamp < now - 10000) {
      this.config.errorHandler.handleError(
        new SyncError('Timestamp is too old', {
          code: 'SYNC_INVALID_TIMESTAMP_OLD',
          context: { timestamp: message.timestamp, now },
        })
      );
      return;
    }

    // Ignore updates from self (local player updates come from our own sends)
    const localUserId = this.getLocalUserId();
    if (message.userId === localUserId) {
      return;
    }

    // Use playerId from message (which is now userId)
    const playerId = message.playerId || message.userId;
    if (!playerId || typeof playerId !== 'string' || playerId === 'unknown') {
      this.config.errorHandler.handleError(
        new SyncError('Invalid playerId in message', {
          code: 'SYNC_INVALID_PLAYER_ID',
          context: { playerId, message },
        })
      );
      return;
    }
    
    // Find or create remote player entity
    let remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer) {
      // Find existing entity or create new one (entity creation should be handled elsewhere)
      const entity = this.findOrCreateRemotePlayerEntity(playerId);
      if (!entity) {
        this.config.errorHandler.handleError(
          new SyncError(`Could not find or create entity for remote player ${playerId}`, {
            code: 'SYNC_ENTITY_NOT_FOUND',
            context: { playerId },
            retryable: true,
          })
        );
        return;
      }

      remotePlayer = {
        entity,
        position: [...message.position] as Vec3,
        rotation: message.rotation,
        velocity: message.velocity ? [...message.velocity] as Vec3 : undefined,
        lastUpdateTime: message.timestamp,
        interpolationTime: 0,
      };
      this.remotePlayers.set(playerId, remotePlayer);
    }

    // Update remote player data (remotePlayer is guaranteed to exist here)
    const player = remotePlayer;
    player.position = [...message.position] as Vec3;
    if (message.rotation && this.isValidRotation(message.rotation)) {
      player.rotation = message.rotation;
    }
    if (message.velocity && this.isValidVelocity(message.velocity)) {
      player.velocity = [...message.velocity] as Vec3;
    }
    player.lastUpdateTime = message.timestamp;
    player.interpolationTime = 0; // Reset interpolation

    // Apply state updates
    if (message.state) {
      const entity = player.entity;
      
      // Health
      if (typeof message.state.health === 'number') {
        let health = entity.getComponent(HealthComponent);
        if (!health) {
          health = new HealthComponent();
          entity.addComponent(health);
        }
        if (typeof message.state.maxHealth === 'number') {
          health.maxHealth = message.state.maxHealth;
        }
        health.currentHealth = message.state.health;
      }

      // Shield
      if (typeof message.state.shield === 'number') {
        let shield = entity.getComponent(ShieldComponent);
        if (!shield) {
          shield = new ShieldComponent();
          entity.addComponent(shield);
        }
        if (typeof message.state.maxShield === 'number') {
          shield.maxShield = message.state.maxShield;
        }
        shield.currentShield = message.state.shield;
      }

      // Buffs
      if (Array.isArray(message.state.buffs)) {
        let powerUp = entity.getComponent(PowerUpComponent);
        if (!powerUp) {
          powerUp = new PowerUpComponent();
          entity.addComponent(powerUp);
        }
        // Clear existing buffs and apply new ones
        // Note: This might be too aggressive if we want to interpolate, but for buffs it's usually fine
        powerUp.buffs.clear();
        for (const [type, buff] of message.state.buffs as any[]) {
          powerUp.buffs.set(type, buff);
        }
      }
    }
  }

  /**
   * Update remote players with interpolation.
   */
  private updateRemotePlayers(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;
    const SMOOTHING_SPEED = 10.0; // Interpolation speed factor

    for (const remotePlayer of this.remotePlayers.values()) {
      remotePlayer.interpolationTime += deltaMs;

      // Calculate target position
      let targetPosition: Vec3;
      
      // Apply prediction if enabled
      if (this.config.enablePrediction && remotePlayer.velocity) {
        // Cap prediction time to avoid overshooting on lag
        const predictionTime = Math.min(remotePlayer.interpolationTime / 1000, 0.1); 
        this.tempVec3[0] = remotePlayer.position[0] + remotePlayer.velocity[0] * predictionTime;
        this.tempVec3[1] = remotePlayer.position[1] + remotePlayer.velocity[1] * predictionTime;
        this.tempVec3[2] = remotePlayer.position[2] + remotePlayer.velocity[2] * predictionTime;
        targetPosition = [this.tempVec3[0], this.tempVec3[1], this.tempVec3[2]];
      } else {
        targetPosition = remotePlayer.position;
      }

      // Interpolate position
      const currentPosition = remotePlayer.entity.transform.position;
      // Use exponential smoothing (lerp towards target)
      const t = Math.min(deltaTime * SMOOTHING_SPEED, 1.0);
      const newPosition = lerpVec3(currentPosition, targetPosition, t);
      remotePlayer.entity.transform.position = newPosition;

      // Interpolate rotation if available
      if (remotePlayer.rotation) {
        const currentRotation = remotePlayer.entity.transform.rotation;
        const newRotation = quatSlerp(currentRotation, remotePlayer.rotation, t);
        remotePlayer.entity.transform.rotation = newRotation;
      }
    }
  }

  /**
   * Find or create remote player entity.
   * Queries the scene for an existing entity with the given playerId.
   * Entity creation should be handled by a higher-level system (like MultiplayerGameplayManager).
   */
  private findOrCreateRemotePlayerEntity(playerId: string): Entity | null {
    // Get scene from local player entity
    const scene = this.config.localPlayerEntity.scene;
    if (!scene) {
      this.config.errorHandler.handleError(
        new StateError('Local player entity is not attached to a scene', {
          code: 'STATE_ENTITY_NOT_IN_SCENE',
          context: { entityId: this.config.localPlayerEntity.id, playerId },
        })
      );
      return null;
    }

    // Try to find existing entity by ID (using playerId as entity ID)
    // Note: In a full implementation, you might want to track entities differently
    // (e.g., using a component to store userId)
    const existingEntity = scene.findEntityById(playerId);
    if (existingEntity) {
      return existingEntity;
    }

    // Entity doesn't exist - return null
    // Entity creation should be handled by MultiplayerGameplayManager via registerRemotePlayer()
    return null;
  }

  /**
   * Set local user ID.
   */
  setLocalUserId(userId: string): void {
    if (!userId || typeof userId !== 'string') {
      throw ErrorFactory.invalidInput('userId', userId, 'must be a non-empty string');
    }
    this.localUserId = userId;
  }

  /**
   * Register a remote player entity.
   * Called when a remote player joins or entity is created.
   */
  registerRemotePlayer(playerId: string, entity: Entity): void {
    if (!playerId || typeof playerId !== 'string') {
      throw ErrorFactory.invalidInput('playerId', playerId, 'must be a non-empty string');
    }
    if (!entity) {
      throw ErrorFactory.missingField('entity');
    }

    const existing = this.remotePlayers.get(playerId);
    if (existing) {
      existing.entity = entity;
    } else {
      const position = entity.transform.position;
      const rotation = entity.transform.rotation;
      
      if (!this.isValidPosition(position)) {
        throw ErrorFactory.invalidInput('entity.position', position, 'invalid position');
      }
      if (!this.isValidRotation(rotation)) {
        throw ErrorFactory.invalidInput('entity.rotation', rotation, 'invalid rotation');
      }

      this.remotePlayers.set(playerId, {
        entity,
        position: [...position] as Vec3,
        rotation: [...rotation] as [number, number, number, number],
        lastUpdateTime: Date.now(),
        interpolationTime: 0,
      });
    }
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
   * Unregister a remote player (when they leave).
   */
  unregisterRemotePlayer(playerId: string): void {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (remotePlayer) {
      // Entity removal should be handled by higher-level system
      this.remotePlayers.delete(playerId);
    }
  }

  /**
   * Get all registered remote players.
   */
  getRemotePlayers(): Map<string, RemotePlayer> {
    return new Map(this.remotePlayers);
  }

  /**
   * Reset state for reconnection.
   * Clears last sent position to force sending update on next frame.
   */
  resetForReconnection(): void {
    this.lastSentPosition = null;
    // Keep remote players - they'll be updated from network
  }

  /**
   * Cleanup - call when player sync is no longer needed.
   */
  dispose(): void {
    if (this.unsubscribeStateChange) {
      this.unsubscribeStateChange();
      this.unsubscribeStateChange = null;
    }
    this.remotePlayers.clear();
    this.lastSentPosition = null;
    this.localUserId = null;
  }
}

