import type { Entity } from '@engine/world';
import { CharacterController } from '@engine/world';
import { ReplicationClient } from '../ReplicationClient';
import type { PlayerUpdateMessage } from '../types/replication';
import type { Vec3 } from '@engine/core/math';

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
  private readonly config: Required<PlayerSyncConfig>;
  private readonly remotePlayers = new Map<string, RemotePlayer>();
  private sendTimer = 0;
  private lastSentPosition: Vec3 | null = null;
  private readonly tempVec3: Vec3 = [0, 0, 0];
  private localUserId: string | null = null;

  constructor(config: PlayerSyncConfig) {
    this.config = {
      sendInterval: config.sendInterval ?? 100,
      interpolationTime: config.interpolationTime ?? 100,
      enablePrediction: config.enablePrediction ?? true,
      localUserId: config.localUserId ?? null,
      ...config,
    };

    // Initialize localUserId - fetch from replicationClient if not provided
    this.localUserId = this.config.localUserId ?? this.config.replicationClient.getLocalUserId() ?? null;

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

    // Get velocity if available from controller
    const velocity = controller.velocity ? [controller.velocity[0], controller.velocity[1], controller.velocity[2]] as [number, number, number] : undefined;

    // Use localUserId instead of entity.id
    const localUserId = this.getLocalUserId();
    if (!localUserId) {
      console.warn('PlayerSync: Cannot send update - localUserId not available');
      return;
    }

    this.config.replicationClient.sendPlayerUpdate({
      playerId: localUserId, // Use userId instead of entity.id
      position: [...position] as [number, number, number],
      ...(rotation && { rotation: [rotation[0], rotation[1], rotation[2], rotation[3]] as [number, number, number, number] }),
      ...(velocity !== undefined && { velocity }),
      state: {
        isGrounded: controller.isGrounded,
        // Add other relevant state
      },
    });

    this.lastSentPosition = [...position] as Vec3;
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
    // Ignore updates from self (local player updates come from our own sends)
    const localUserId = this.getLocalUserId();
    if (message.userId === localUserId) {
      return;
    }

    // Use playerId from message (which is now userId)
    const playerId = message.playerId || message.userId || 'unknown';
    
    // Find or create remote player entity
    let remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer) {
      // Find existing entity or create new one (entity creation should be handled elsewhere)
      const entity = this.findOrCreateRemotePlayerEntity(playerId);
      if (!entity) {
        console.warn(`Could not find or create entity for remote player ${playerId}`);
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
    if (message.rotation) {
      player.rotation = message.rotation;
    }
    if (message.velocity) {
      player.velocity = [...message.velocity] as Vec3;
    }
    player.lastUpdateTime = message.timestamp;
    player.interpolationTime = 0; // Reset interpolation
  }

  /**
   * Update remote players with interpolation.
   */
  private updateRemotePlayers(deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    for (const remotePlayer of this.remotePlayers.values()) {
      remotePlayer.interpolationTime += deltaMs;

      // Apply position with optional velocity-based prediction
      if (this.config.enablePrediction && remotePlayer.velocity) {
        const predictionTime = Math.min(remotePlayer.interpolationTime / 1000, 0.1); // Max 100ms prediction
        this.tempVec3[0] = remotePlayer.position[0] + remotePlayer.velocity[0] * predictionTime;
        this.tempVec3[1] = remotePlayer.position[1] + remotePlayer.velocity[1] * predictionTime;
        this.tempVec3[2] = remotePlayer.position[2] + remotePlayer.velocity[2] * predictionTime;
        remotePlayer.entity.transform.position = this.tempVec3;
      } else {
        // Apply position directly (use setter)
        remotePlayer.entity.transform.position = remotePlayer.position;
      }

      // Apply rotation if available
      if (remotePlayer.rotation) {
        remotePlayer.entity.transform.rotation = remotePlayer.rotation;
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
      console.warn(`PlayerSync: Local player entity is not attached to a scene`);
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
    this.localUserId = userId;
  }

  /**
   * Register a remote player entity.
   * Called when a remote player joins or entity is created.
   */
  registerRemotePlayer(playerId: string, entity: Entity): void {
    const existing = this.remotePlayers.get(playerId);
    if (existing) {
      existing.entity = entity;
    } else {
      this.remotePlayers.set(playerId, {
        entity,
        position: [...entity.transform.position] as Vec3,
        rotation: [...entity.transform.rotation] as [number, number, number, number],
        lastUpdateTime: Date.now(),
        interpolationTime: 0,
      });
    }
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
   * Cleanup - call when player sync is no longer needed.
   */
  dispose(): void {
    this.remotePlayers.clear();
    this.lastSentPosition = null;
  }
}

