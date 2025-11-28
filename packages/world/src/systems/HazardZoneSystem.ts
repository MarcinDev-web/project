/**
 * HazardZoneSystem - Handles hazard zone damage and kills (kill bricks, lava, etc.)
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { HazardZoneComponent } from '../components/HazardZoneComponent.js';
import { CharacterController } from '../components/CharacterController.js';
import { HealthComponent } from '../components/HealthComponent.js';
import type { Vec3 } from '@engine/core/math';
import { lengthVec3 } from '@engine/core/math';

/**
 * Event data for hazard zone events
 */
export interface HazardDamageEvent {
  /** The player entity that was damaged */
  entity: Entity;
  /** The hazard zone entity */
  hazardEntity: Entity;
  /** Amount of damage dealt */
  damage: number;
}

export interface HazardKillEvent {
  /** The player entity that was killed */
  entity: Entity;
  /** The hazard zone entity */
  hazardEntity: Entity;
}

/**
 * Options for HazardZoneSystem
 */
export interface HazardZoneSystemOptions {
  /** Callback when a player is damaged by a hazard */
  onDamage?: (event: HazardDamageEvent) => void;
  /** Callback when a player is killed by a hazard */
  onKill?: (event: HazardKillEvent) => void;
  /** Default activation radius for zones without explicit radius (default: 2.0) */
  defaultRadius?: number;
}

/**
 * Tracks which entities are inside which hazard zones
 */
interface HazardZoneState {
  /** Set of entity IDs currently inside this zone */
  entitiesInside: Set<string>;
  /** Time spent inside for damage-over-time calculation */
  timeInside: Map<string, number>;
}

/**
 * System that handles hazard zone damage and kills.
 * 
 * Features:
 * - Detects players entering hazard zones (radius-based)
 * - Applies instant damage on entry (damageOnEnter)
 * - Applies damage over time (damagePerSecond)
 * - Instant kill zones (killZone)
 * - Emits events for damage and kill
 */
export class HazardZoneSystem {
  private readonly scene: Scene;
  private readonly options: HazardZoneSystemOptions;
  private readonly zoneStates = new Map<Entity, HazardZoneState>();
  // Reusable scratch vector for distance calculations
  private readonly scratchVec: Vec3 = [0, 0, 0];

  constructor(scene: Scene, options: HazardZoneSystemOptions = {}) {
    this.scene = scene;
    this.options = {
      defaultRadius: 2.0,
      ...options,
    };
  }

  /**
   * Update hazard zone detection and damage (call each frame)
   */
  update(deltaTime: number): void {
    // Get all hazard zones
    const hazardZones = this.scene.queryEntities(HazardZoneComponent);
    
    // Get all player entities (entities with CharacterController)
    const players = this.scene.queryEntities(CharacterController);
    
    if (hazardZones.length === 0 || players.length === 0) {
      return;
    }

    // Process each hazard zone
    for (const hazardEntity of hazardZones) {
      const hazard = hazardEntity.getComponent(HazardZoneComponent);
      if (!hazard) continue;

      // Ensure zone state exists
      if (!this.zoneStates.has(hazardEntity)) {
        this.zoneStates.set(hazardEntity, {
          entitiesInside: new Set(),
          timeInside: new Map(),
        });
      }
      const state = this.zoneStates.get(hazardEntity)!;

      const hazardPos = hazardEntity.transform.position;
      const radius = this.options.defaultRadius!;

      // Track which entities are currently inside
      const currentlyInside = new Set<string>();

      for (const playerEntity of players) {
        const playerPos = playerEntity.transform.position;
        const entityId = playerEntity.id.toString();

        // Calculate distance
        this.scratchVec[0] = playerPos[0] - hazardPos[0];
        this.scratchVec[1] = playerPos[1] - hazardPos[1];
        this.scratchVec[2] = playerPos[2] - hazardPos[2];
        const distance = lengthVec3(this.scratchVec);

        const isInside = distance <= radius;

        if (isInside) {
          currentlyInside.add(entityId);

          // Check if just entered
          const justEntered = !state.entitiesInside.has(entityId);

          if (justEntered) {
            state.entitiesInside.add(entityId);
            state.timeInside.set(entityId, 0);

            // Handle entry effects
            this.handleZoneEntry(playerEntity, hazardEntity, hazard);
          } else {
            // Accumulate time for damage-over-time
            const time = state.timeInside.get(entityId) ?? 0;
            state.timeInside.set(entityId, time + deltaTime);

            // Apply damage over time
            if (hazard.damagePerSecond > 0) {
              this.applyDamage(playerEntity, hazardEntity, hazard.damagePerSecond * deltaTime);
            }
          }
        }
      }

      // Clean up entities that left the zone
      for (const entityId of state.entitiesInside) {
        if (!currentlyInside.has(entityId)) {
          state.entitiesInside.delete(entityId);
          state.timeInside.delete(entityId);
        }
      }
    }

    // Clean up states for removed hazard zones
    for (const [entity] of this.zoneStates) {
      if (!hazardZones.includes(entity)) {
        this.zoneStates.delete(entity);
      }
    }
  }

  /**
   * Handle when a player enters a hazard zone
   */
  private handleZoneEntry(
    playerEntity: Entity,
    hazardEntity: Entity,
    hazard: HazardZoneComponent
  ): void {
    // Kill zone - instant death
    if (hazard.killZone) {
      this.killPlayer(playerEntity, hazardEntity);
      return;
    }

    // Instant damage on entry
    if (hazard.damageOnEnter > 0) {
      this.applyDamage(playerEntity, hazardEntity, hazard.damageOnEnter);
    }
  }

  /**
   * Apply damage to a player
   */
  private applyDamage(
    playerEntity: Entity,
    hazardEntity: Entity,
    damage: number
  ): void {
    const health = playerEntity.getComponent(HealthComponent);
    
    if (health) {
      const actualDamage = health.takeDamage(damage);
      
      // Emit damage event
      if (this.options.onDamage && actualDamage > 0) {
        this.options.onDamage({
          entity: playerEntity,
          hazardEntity,
          damage: actualDamage,
        });
      }

      // Check for death
      if (!health.isAlive()) {
        this.emitKillEvent(playerEntity, hazardEntity);
      }
    } else {
      // No health component - treat any damage as kill for simplicity
      // (common in simple platformers where touching lava = instant reset)
      this.emitKillEvent(playerEntity, hazardEntity);
    }
  }

  /**
   * Instantly kill a player
   */
  private killPlayer(playerEntity: Entity, hazardEntity: Entity): void {
    const health = playerEntity.getComponent(HealthComponent);
    
    if (health) {
      // Set health to 0 to trigger death
      health.currentHealth = 0;
    }

    this.emitKillEvent(playerEntity, hazardEntity);
  }

  /**
   * Emit kill event
   */
  private emitKillEvent(playerEntity: Entity, hazardEntity: Entity): void {
    if (this.options.onKill) {
      this.options.onKill({
        entity: playerEntity,
        hazardEntity,
      });
    }

    // Also publish to scene event bus
    this.scene.events.publish({
      type: 'hazard:kill',
      payload: {
        entityId: playerEntity.id,
        hazardEntityId: hazardEntity.id,
      },
      sender: hazardEntity,
    });
  }

  /**
   * Check if an entity is currently inside any hazard zone
   */
  isInHazardZone(entity: Entity): boolean {
    const entityId = entity.id.toString();
    for (const [, state] of this.zoneStates) {
      if (state.entitiesInside.has(entityId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get all hazard zones an entity is currently inside
   */
  getHazardZonesContaining(entity: Entity): Entity[] {
    const entityId = entity.id.toString();
    const result: Entity[] = [];
    
    for (const [hazardEntity, state] of this.zoneStates) {
      if (state.entitiesInside.has(entityId)) {
        result.push(hazardEntity);
      }
    }
    
    return result;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.zoneStates.clear();
  }
}

