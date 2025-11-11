import type { Scene, Entity, PhysicsWorld } from '@engine/world';
import { SpawnPointComponent } from '@engine/world';
import type { Vec3 } from '@engine/core/math';
import { Logger } from '../../utils/logger';

/**
 * Result of spawn point detection
 */
export interface SpawnPointResult {
  /** Spawn position */
  position: Vec3;
  /** Spawn rotation (yaw in radians) */
  rotation: number;
  /** Source of spawn point ('user-defined' or 'raycast-fallback') */
  source: 'user-defined' | 'raycast-fallback' | 'default-origin';
}

/**
 * SpawnPointSystem finds appropriate spawn locations for the player.
 * 
 * Priority:
 * 1. User-defined spawn point (entity with SpawnPointComponent, isDefault=true)
 * 2. Raycast fallback (cast ray downward from camera/reference position)
 * 3. Default origin (0, 0, 0) if nothing else works
 * 
 * Note: This is a headless system used internally by play mode logic.
 * It does not expose any UI and is not intended for direct editor UI integration.
 */
export class SpawnPointSystem {
  /**
   * Find spawn point in scene
   * 
   * @param scene - Scene to search
   * @param physicsWorld - Physics world for raycasting (optional)
   * @param fallbackPosition - Position to raycast from if no spawn point found (optional)
   * @returns Spawn point result
   */
  static findSpawnPoint(
    scene: Scene,
    physicsWorld?: PhysicsWorld | null,
    fallbackPosition?: Vec3
  ): SpawnPointResult {
    // 1. Try to find user-defined spawn point
    const spawnEntity = this.findDefaultSpawnPoint(scene);
    
    if (spawnEntity) {
      const spawnComponent = spawnEntity.getComponent(SpawnPointComponent);
      const position = spawnEntity.transform.getWorldPosition();
      const rotation = spawnComponent?.rotation ?? 0;
      
      Logger.debug('[SpawnPointSystem] Using user-defined spawn point:', position);
      
      return {
        position,
        rotation,
        source: 'user-defined',
      };
    }

    // 2. Try raycast fallback
    if (physicsWorld && fallbackPosition) {
      const raycastResult = this.findSpawnViaRaycast(
        physicsWorld,
        fallbackPosition
      );
      
      if (raycastResult) {
        Logger.debug('[SpawnPointSystem] Using raycast fallback spawn:', raycastResult.position);
        return raycastResult;
      }
    }

    // 3. Default origin as last resort
    Logger.warn('[SpawnPointSystem] No spawn point found, using default origin');
    return {
      position: [0, 1, 0], // Slightly above ground
      rotation: 0,
      source: 'default-origin',
    };
  }

  /**
   * Find the default spawn point entity in the scene
   * 
   * @param scene - Scene to search
   * @returns Spawn point entity or null
   */
  static findDefaultSpawnPoint(scene: Scene): Entity | null {
    // Search for entities with SpawnPointComponent
    const entities = scene.getAllEntities();
    
    for (const entity of entities) {
      const spawnComponent = entity.getComponent(SpawnPointComponent);
      
      if (spawnComponent && spawnComponent.isDefault) {
        return entity;
      }
    }

    // If no default spawn point, return first spawn point found
    for (const entity of entities) {
      const spawnComponent = entity.getComponent(SpawnPointComponent);
      
      if (spawnComponent) {
        return entity;
      }
    }

    return null;
  }

  /**
   * Find spawn point via raycast downward from reference position
   * 
   * @param physicsWorld - Physics world for raycasting
   * @param referencePosition - Position to cast from (typically camera position)
   * @param maxDistance - Maximum raycast distance (default: 100)
   * @returns Spawn point result or null if no hit
   */
  static findSpawnViaRaycast(
    physicsWorld: PhysicsWorld,
    referencePosition: Vec3,
    maxDistance = 100
  ): SpawnPointResult | null {
    // Cast ray downward from reference position
    const origin: Vec3 = [
      referencePosition[0],
      referencePosition[1],
      referencePosition[2],
    ];
    
    const direction: Vec3 = [0, -1, 0]; // Downward
    
    const hit = physicsWorld.raycast(origin, direction, {
      maxDistance,
      ignoreEntities: [],
      hitTriggers: false,
    });

    if (!hit) {
      return null;
    }

    // Spawn slightly above the hit surface
    const spawnHeight = 0.1; // Small offset above ground
    const position: Vec3 = [
      hit.point[0],
      hit.point[1] + spawnHeight,
      hit.point[2],
    ];

    return {
      position,
      rotation: 0, // Default rotation
      source: 'raycast-fallback',
    };
  }

  /**
   * Check if spawn position is valid (not in air, not inside blocks)
   * 
   * @param physicsWorld - Physics world for checking
   * @param position - Position to check
   * @returns True if position is valid
   */
  static isValidSpawnPosition(
    physicsWorld: PhysicsWorld,
    position: Vec3
  ): boolean {
    // Cast ray downward to check if there's ground beneath
    const origin: Vec3 = [position[0], position[1], position[2]];
    const direction: Vec3 = [0, -1, 0];
    
    const hit = physicsWorld.raycast(origin, direction, {
      maxDistance: 2.0, // Check 2 units below
      ignoreEntities: [],
      hitTriggers: false,
    });

    return hit !== null;
  }
}

