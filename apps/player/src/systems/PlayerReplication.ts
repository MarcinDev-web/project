import type { Scene, Entity } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { Logger } from '../utils/logger';
import type { MultiplayerSystem, RemotePlayer } from './MultiplayerSystem.js';

/**
 * PlayerReplication manages replication of remote players in the scene
 */
export class PlayerReplication {
  private scene: Scene | null = null;
  private multiplayerSystem: MultiplayerSystem | null = null;
  private remotePlayerEntities = new Map<string, Entity>();
  private localPlayerId: string | null = null;

  /**
   * Initialize replication system
   */
  initialize(scene: Scene, multiplayerSystem: MultiplayerSystem, localPlayerId: string): void {
    this.scene = scene;
    this.multiplayerSystem = multiplayerSystem;
    this.localPlayerId = localPlayerId;
    Logger.debug('[PlayerReplication] Initialized');
  }

  /**
   * Update - call each frame to sync remote players
   */
  update(): void {
    if (!this.multiplayerSystem || !this.scene) {
      return;
    }

    const remotePlayers = this.multiplayerSystem.getRemotePlayers();
    
    // Update existing remote player entities
    for (const [playerId, playerData] of remotePlayers) {
      if (playerId === this.localPlayerId) {
        continue; // Skip local player
      }

      let entity = this.remotePlayerEntities.get(playerId);
      
      if (!entity) {
        // Create new entity for remote player
        entity = this.createRemotePlayerEntity(playerId, playerData);
        this.scene.addEntity(entity);
        this.remotePlayerEntities.set(playerId, entity);
      } else {
        // Update existing entity position/rotation
        this.updateRemotePlayerEntity(entity, playerData);
      }
    }

    // Remove entities for players that left
    for (const [playerId, entity] of this.remotePlayerEntities) {
      if (!remotePlayers.has(playerId) || playerId === this.localPlayerId) {
        try {
          this.scene.removeEntity(entity);
        } catch (error) {
          Logger.warn(`[PlayerReplication] Failed to remove entity for player ${playerId}:`, error as unknown as Error);
        }
        this.remotePlayerEntities.delete(playerId);
      }
    }
  }

  /**
   * Create entity for remote player
   */
  private createRemotePlayerEntity(playerId: string, playerData: RemotePlayer): Entity {
    const entity = new Entity(`remote_player_${playerId}`);
    entity.transform.position = [...playerData.position] as Vec3;
    entity.transform.setEulerAngles(0, playerData.rotation, 0);
    entity.userData.isRemotePlayer = true;
    entity.userData.playerId = playerId;
    entity.userData.displayName = playerData.displayName;
    
    // TODO: Add visual representation (avatar, nameplate, etc.)
    
    Logger.debug(`[PlayerReplication] Created entity for remote player: ${playerId}`);
    return entity;
  }

  /**
   * Update remote player entity position/rotation
   */
  private updateRemotePlayerEntity(entity: Entity, playerData: RemotePlayer): void {
    // Smooth interpolation could be added here
    entity.transform.position = [...playerData.position] as Vec3;
    entity.transform.setEulerAngles(0, playerData.rotation, 0);
  }

  /**
   * Get remote player entity by ID
   */
  getRemotePlayerEntity(playerId: string): Entity | null {
    return this.remotePlayerEntities.get(playerId) ?? null;
  }

  /**
   * Get all remote player entities
   */
  getAllRemotePlayerEntities(): ReadonlyMap<string, Entity> {
    return this.remotePlayerEntities;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.scene) {
      for (const entity of this.remotePlayerEntities.values()) {
        try {
          this.scene.removeEntity(entity);
        } catch (error) {
          Logger.warn('[PlayerReplication] Failed to remove entity during dispose:', error as unknown as Error);
        }
      }
    }
    
    this.remotePlayerEntities.clear();
    this.scene = null;
    this.multiplayerSystem = null;
    this.localPlayerId = null;
  }
}

