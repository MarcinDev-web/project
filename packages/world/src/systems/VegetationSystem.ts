/**
 * VegetationSystem - Manages vegetation gameplay interactions
 * 
 * Handles:
 * - Harvesting/interaction with vegetation
 * - Collision detection with player/entities
 * - Growth state management
 * - Event emission for gameplay logic
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { VegetationComponent } from '../components/VegetationComponent.js';
import { PhysicsComponent, RigidbodyType } from '../components/PhysicsComponent.js';
import type { PhysicsSystem, CollisionEvent } from '../physics/PhysicsSystem.js';
import type { Vec3 } from '@engine/core/math';
import { distanceVec3 } from '@engine/core/math';

/**
 * Harvest event data
 */
export interface HarvestEvent {
  /** Entity that was harvested */
  vegetationEntity: Entity;
  /** Entity that harvested (player, NPC, etc.) */
  harvesterEntity: Entity | null;
  /** Vegetation component */
  vegetation: VegetationComponent;
}

/**
 * Vegetation collision event data
 */
export interface VegetationCollisionEvent {
  /** Vegetation entity */
  vegetationEntity: Entity;
  /** Other entity in collision */
  otherEntity: Entity;
  /** Vegetation component */
  vegetation: VegetationComponent;
  /** Collision point */
  contactPoint: Vec3;
}

/**
 * Vegetation interaction configuration
 */
export interface VegetationSystemConfig {
  /** Maximum distance for interaction (harvesting) */
  interactionRange: number;
  /** Enable collision detection for vegetation */
  enableCollisions: boolean;
  /** Auto-harvest on collision (if canBeHarvested is true) */
  autoHarvestOnCollision: boolean;
  /** Enable automatic growth/regrowth updates */
  enableGrowth: boolean;
}

const DEFAULT_CONFIG: VegetationSystemConfig = {
  interactionRange: 2.0,
  enableCollisions: true,
  autoHarvestOnCollision: false,
  enableGrowth: true,
};

/**
 * VegetationSystem manages vegetation gameplay interactions
 */
export class VegetationSystem {
  private readonly scene: Scene;
  private readonly physicsSystem: PhysicsSystem | null;
  private readonly config: VegetationSystemConfig;
  
  /** Track vegetation entities being harvested */
  private readonly harvestingEntities = new Map<Entity, {
    startTime: number;
    harvester: Entity | null;
  }>();
  
  /** Current time tracking */
  private currentTime = 0;
  
  /** Unsubscribe from physics collisions */
  private collisionUnsubscribe: (() => void) | null = null;

  constructor(
    scene: Scene,
    physicsSystem: PhysicsSystem | null = null,
    config?: Partial<VegetationSystemConfig>
  ) {
    this.scene = scene;
    this.physicsSystem = physicsSystem;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Subscribe to collision events if physics system available
    if (this.physicsSystem && this.config.enableCollisions) {
      this.subscribeToCollisions();
    }
  }

  /**
   * Update vegetation system (called each frame)
   */
  update(deltaTime: number): void {
    this.currentTime += deltaTime;
    
    // Process active harvesting
    this.updateHarvesting(deltaTime);
    
    // Update growth/regrowth for all vegetation
    if (this.config.enableGrowth) {
      this.updateGrowth(deltaTime);
    }
    
    // Clean up harvested entities that no longer exist
    for (const entity of this.harvestingEntities.keys()) {
      if (!this.scene.findEntityById(entity.id)) {
        this.harvestingEntities.delete(entity);
      }
    }
  }

  /**
   * Attempt to harvest vegetation entity
   * @param vegetationEntity - Vegetation to harvest
   * @param harvesterEntity - Entity performing harvest (null for environment)
   * @returns true if harvest started/completed, false if cannot harvest
   */
  harvest(vegetationEntity: Entity, harvesterEntity: Entity | null = null): boolean {
    const vegetation = vegetationEntity.getComponent(VegetationComponent);
    if (!vegetation) {
      return false;
    }
    
    if (!vegetation.config.canBeHarvested) {
      return false;
    }
    
    if (vegetation.isHarvested) {
      return false; // Already harvested
    }
    
    const harvestTime = vegetation.config.harvestTime ?? 0;
    
    // Instant harvest (harvestTime = 0 or undefined)
    if (harvestTime <= 0) {
      this.completeHarvest(vegetationEntity, harvesterEntity);
      return true;
    }
    
    // Start timed harvest
    this.harvestingEntities.set(vegetationEntity, {
      startTime: this.currentTime,
      harvester: harvesterEntity,
    });
    
    return true;
  }

  /**
   * Check if entity can interact with vegetation at given position
   */
  canInteractWith(_entity: Entity, position: Vec3): Entity | null {
    const allVegetation = this.scene.queryEntities(VegetationComponent);
    
    let closest: Entity | null = null;
    let closestDistance = this.config.interactionRange;
    
    for (const vegetationEntity of allVegetation) {
      const vegetation = vegetationEntity.getComponent(VegetationComponent);
      if (!vegetation || vegetation.isHarvested) {
        continue;
      }
      
      const vegPos = vegetationEntity.transform.getWorldPosition();
      const distance = distanceVec3(position, vegPos);
      
      // Check if within interaction range and closest
      if (distance <= this.config.interactionRange && distance < closestDistance) {
        closestDistance = distance;
        closest = vegetationEntity;
      }
    }
    
    return closest;
  }

  /**
   * Get all vegetation entities in range
   */
  getVegetationInRange(position: Vec3, range: number): Entity[] {
    const result: Entity[] = [];
    const allVegetation = this.scene.queryEntities(VegetationComponent);
    
    for (const vegetationEntity of allVegetation) {
      const vegetation = vegetationEntity.getComponent(VegetationComponent);
      if (!vegetation || vegetation.isHarvested) {
        continue;
      }
      
      const vegPos = vegetationEntity.transform.getWorldPosition();
      const distance = distanceVec3(position, vegPos);
      
      if (distance <= range) {
        result.push(vegetationEntity);
      }
    }
    
    return result;
  }

  /**
   * Remove entity from tracking (called when entity is destroyed)
   */
  removeEntity(entity: Entity): void {
    this.harvestingEntities.delete(entity);
  }

  /**
   * Dispose system resources
   */
  dispose(): void {
    if (this.collisionUnsubscribe) {
      this.collisionUnsubscribe();
      this.collisionUnsubscribe = null;
    }
    this.harvestingEntities.clear();
  }

  /**
   * Subscribe to physics collision events
   */
  private subscribeToCollisions(): void {
    if (!this.physicsSystem) return;
    
    this.collisionUnsubscribe = () => {
      // Collision listeners are stored in physicsSystem, we can't easily unsubscribe
      // This is a placeholder - in practice, physics system would need unsubscribe support
    };
    
    // Subscribe to collision events
    this.physicsSystem.onCollision((event) => this.handleCollision(event));
  }

  /**
   * Handle collision event from physics system
   */
  private handleCollision(event: CollisionEvent): void {
    if (!this.config.enableCollisions) return;
    
    // Check if either entity is vegetation
    const vegA = event.entityA.getComponent(VegetationComponent);
    const vegB = event.entityB.getComponent(VegetationComponent);
    
    let vegetationEntity: Entity | null = null;
    let otherEntity: Entity | null = null;
    let vegetation: VegetationComponent | null = null;
    
    if (vegA) {
      vegetationEntity = event.entityA;
      otherEntity = event.entityB;
      vegetation = vegA;
    } else if (vegB) {
      vegetationEntity = event.entityB;
      otherEntity = event.entityA;
      vegetation = vegB;
    }
    
    if (!vegetationEntity || !vegetation || !otherEntity) {
      return;
    }
    
    // Check if other entity is dynamic (player, NPC, etc.)
    const otherPhysics = otherEntity.getComponent(PhysicsComponent);
    if (otherPhysics && otherPhysics.rigidbodyType === RigidbodyType.Dynamic) {
      // Emit collision event
      this.scene.events.emit('vegetation:collision', {
        vegetationEntity,
        otherEntity,
        vegetation,
        contactPoint: event.contactPoint,
      } as VegetationCollisionEvent);
      
      // Auto-harvest if enabled
      if (this.config.autoHarvestOnCollision && vegetation.config.canBeHarvested) {
        this.harvest(vegetationEntity, otherEntity);
      }
    }
  }

  /**
   * Update harvesting progress
   */
  private updateHarvesting(_deltaTime: number): void {
    const completed: Entity[] = [];
    
    for (const [entity, harvest] of this.harvestingEntities.entries()) {
      const vegetation = entity.getComponent(VegetationComponent);
      if (!vegetation) {
        completed.push(entity);
        continue;
      }
      
      const harvestTime = vegetation.config.harvestTime ?? 0;
      const elapsed = this.currentTime - harvest.startTime;
      
      if (elapsed >= harvestTime) {
        completed.push(entity);
      }
    }
    
    // Complete harvesting for finished entities
    for (const entity of completed) {
      const harvest = this.harvestingEntities.get(entity);
      this.harvestingEntities.delete(entity);
      if (harvest) {
        this.completeHarvest(entity, harvest.harvester);
      }
    }
  }

  /**
   * Complete harvest and emit event
   */
  private completeHarvest(vegetationEntity: Entity, harvesterEntity: Entity | null): void {
    const vegetation = vegetationEntity.getComponent(VegetationComponent);
    if (!vegetation) {
      return;
    }
    
    // Mark as harvested
    vegetation.harvest();
    
    // Emit harvest event
    this.scene.events.emit('vegetation:harvest', {
      vegetationEntity,
      harvesterEntity,
      vegetation,
    } as HarvestEvent);
    
    // Emit growth event if regrowth is enabled
    if (vegetation.config.canRegrow && vegetation.config.regrowthTime && vegetation.config.regrowthTime > 0) {
      this.scene.events.emit('vegetation:growth-start', {
        vegetationEntity,
        vegetation,
      });
    }
  }

  /**
   * Updates growth/regrowth for all vegetation entities
   */
  private updateGrowth(deltaTime: number): void {
    const allVegetation = this.scene.queryEntities(VegetationComponent);
    
    for (const entity of allVegetation) {
      const vegetation = entity.getComponent(VegetationComponent);
      if (!vegetation) {
        continue;
      }
      
      // Skip if no regrowth configured
      if (!vegetation.config.canRegrow || !vegetation.config.regrowthTime || vegetation.config.regrowthTime <= 0) {
        continue;
      }
      
      // Only update if harvested or not fully grown
      if (vegetation.isHarvested || vegetation.growthStage < 1.0) {
        const oldStage = vegetation.growthStage;
        const changed = vegetation.updateGrowth(deltaTime);
        
        if (changed) {
          // Emit growth progress event
          this.scene.events.emit('vegetation:growth-progress', {
            vegetationEntity: entity,
            vegetation,
            growthStage: vegetation.growthStage,
            previousStage: oldStage,
          });
          
          // Emit fully grown event when reaching full growth
          if (vegetation.growthStage >= 1.0 && oldStage < 1.0) {
            this.scene.events.emit('vegetation:growth-complete', {
              vegetationEntity: entity,
              vegetation,
            });
          }
        }
      }
    }
  }
}

