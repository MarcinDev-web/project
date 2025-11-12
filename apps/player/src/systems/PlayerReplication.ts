import type { Scene } from '@engine/world';
import { Entity, MeshComponent, MaterialComponent, type RgbaColor } from '@engine/world';
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
    
    // Add visual representation: avatar mesh
    const mesh = new MeshComponent();
    mesh.meshType = 'capsule_y'; // Humanoid shape
    entity.addComponent(mesh);
    
    // Add material with distinct color based on playerId
    const material = new MaterialComponent();
    material.primaryColor = this.getPlayerColor(playerId);
    material.roughness = 0.7;
    material.metallic = 0.1;
    entity.addComponent(material);
    
    // Create nameplate indicator above player head
    this.createNameplate(entity, playerData.displayName);
    
    Logger.debug(`[PlayerReplication] Created entity for remote player: ${playerId} (${playerData.displayName})`);
    return entity;
  }

  /**
   * Generate a distinct color for a player based on their ID hash
   */
  private getPlayerColor(playerId: string): RgbaColor {
    // Simple hash function to generate consistent color from playerId
    let hash = 0;
    for (let i = 0; i < playerId.length; i++) {
      hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate RGB values in [0.3, 1.0] range for visibility
    const r = 0.3 + ((hash & 0xff0000) >> 16) / 255 * 0.7;
    const g = 0.3 + ((hash & 0x00ff00) >> 8) / 255 * 0.7;
    const b = 0.3 + (hash & 0x0000ff) / 255 * 0.7;
    
    return [r, g, b, 1];
  }

  /**
   * Create a nameplate indicator above the player's head
   */
  private createNameplate(parentEntity: Entity, displayName: string): void {
    const nameplate = new Entity(`${parentEntity.name}_nameplate`);
    
    // Position nameplate above player head (capsule_y is ~2 units tall)
    nameplate.transform.position = [0, 1.2, 0]; // Local position relative to parent
    nameplate.transform.scale = [0.8, 0.2, 0.1]; // Wide, thin plate
    
    // Add visual indicator (small cube/sphere)
    const nameplateMesh = new MeshComponent();
    nameplateMesh.meshType = 'cube';
    nameplate.addComponent(nameplateMesh);
    
    const nameplateMaterial = new MaterialComponent();
    nameplateMaterial.primaryColor = [0.2, 0.2, 0.2, 0.8]; // Dark semi-transparent
    nameplateMaterial.opacity = 0.8;
    nameplateMaterial.alphaMode = 'blend';
    nameplate.addComponent(nameplateMaterial);
    
    // Store display name in userData for potential text rendering later
    nameplate.userData.isNameplate = true;
    nameplate.userData.displayName = displayName;
    
    parentEntity.addChild(nameplate);
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

