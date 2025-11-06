/**
 * WeaponSystem - Manages weapon firing, hit-scan, and projectile spawning
 */

import type { Scene } from '../core/Scene.js';
import type { Entity } from '../core/Entity.js';
import { WeaponComponent } from '../components/WeaponComponent.js';
import { ProjectileComponent } from '../components/ProjectileComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { PhysicsComponent, RigidbodyType } from '../components/PhysicsComponent.js';
import { InventoryComponent } from '../components/InventoryComponent.js';
import { AttachmentComponent } from '../components/AttachmentComponent.js';
import { Raycaster, type Ray } from './Raycaster.js';
import type { WeaponFireEvent, WeaponReloadEvent } from '../types/weapon.js';
import type { Vec3 } from '@engine/core/math';
import { getAmmoType } from '../data/ammo.js';
import { normalizeVec3Out, crossVec3Out, transformVec3ByQuatOut } from '@engine/core/math';
import { quatFromAxisAngleOut } from '@engine/core/math';

/**
 * Configuration for WeaponSystem
 */
export interface WeaponSystemConfig {
  /** Enable automatic fire input handling */
  enableInputHandling?: boolean;
  /** Default projectile mesh/material prefab (for projectile weapons) */
  defaultProjectilePrefab?: {
    mesh?: string;
    material?: string;
    scale?: Vec3;
  };
}

/**
 * WeaponSystem manages weapon firing logic
 */
export class WeaponSystem {
  private readonly scene: Scene;
  private readonly raycaster: Raycaster;
  private currentTime: number = 0;

  /** Scratch vectors reused to avoid allocations */
  private readonly scratchVec1: Vec3 = [0, 0, 0];
  private readonly scratchVec2: Vec3 = [0, 0, 0];
  private readonly scratchQuat: [number, number, number, number] = [0, 0, 0, 1];

  constructor(scene: Scene, _config?: WeaponSystemConfig) {
    this.scene = scene;
    this.raycaster = new Raycaster();
    // Config reserved for future use (input handling, projectile prefabs, etc.)
  }

  /**
   * Update weapon system (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!(deltaTime > 0)) return;

    this.currentTime += deltaTime;

    // Update entities with direct WeaponComponent
    const entities = this.scene.queryEntities(WeaponComponent);
    for (const entity of entities) {
      const weapon = entity.getComponent(WeaponComponent);
      if (!weapon) continue;

      // Get attachment modifiers if available
      const attachmentModifiers = this.getAttachmentModifiers(entity);
      weapon.updateReload(this.currentTime, attachmentModifiers);
    }

    // Update entities with InventoryComponent
    const inventoryEntities = this.scene.queryEntities(InventoryComponent);
    for (const entity of inventoryEntities) {
      const inventory = entity.getComponent(InventoryComponent);
      if (!inventory) continue;

      const activeWeapon = inventory.getActiveWeapon();
      if (!activeWeapon) continue;

      // Get attachment modifiers if available
      const attachmentModifiers = this.getAttachmentModifiers(entity);
      activeWeapon.updateReload(this.currentTime, attachmentModifiers);
    }
  }

  /**
   * Fire a weapon from an entity
   * Supports both direct WeaponComponent and InventoryComponent
   * @param entity - Entity with WeaponComponent or InventoryComponent
   * @param direction - Fire direction (will be normalized, can be null to use camera/transform forward)
   * @param origin - Fire origin (optional, defaults to entity transform position)
   * @returns true if fire was successful
   */
  fire(entity: Entity, direction: Vec3 | null = null, origin: Vec3 | null = null): boolean {
    // Check for inventory first (preferred for PvP)
    const inventory = entity.getComponent(InventoryComponent);
    if (inventory) {
      if (inventory.isSwitching) return false; // Can't fire while switching
      const weapon = inventory.getActiveWeapon();
      if (!weapon) return false;
      return this.fireWeapon(entity, weapon, direction, origin);
    }

    // Fallback to direct WeaponComponent
    const weapon = entity.getComponent(WeaponComponent);
    if (!weapon) return false;

    return this.fireWeapon(entity, weapon, direction, origin);
  }

  /**
   * Internal method to fire a specific weapon
   * @param entity - Entity firing the weapon
   * @param weapon - Weapon component to fire
   * @param direction - Fire direction
   * @param origin - Fire origin
   * @returns true if fire was successful
   */
  private fireWeapon(
    entity: Entity,
    weapon: WeaponComponent,
    direction: Vec3 | null,
    origin: Vec3 | null
  ): boolean {
    // Get attachment modifiers
    const attachmentModifiers = this.getAttachmentModifiers(entity);

    // Check if can fire
    if (!weapon.canFire(this.currentTime, attachmentModifiers)) {
      return false;
    }

    // Get fire origin (entity position or provided)
    if (origin) {
      this.scratchVec1[0] = origin[0]!;
      this.scratchVec1[1] = origin[1]!;
      this.scratchVec1[2] = origin[2]!;
    } else {
      const pos = entity.transform.getWorldPosition();
      this.scratchVec1[0] = pos[0]!;
      this.scratchVec1[1] = pos[1]!;
      this.scratchVec1[2] = pos[2]!;
    }

    // Get fire direction (camera forward or entity transform forward or provided)
    if (direction) {
      this.scratchVec2[0] = direction[0]!;
      this.scratchVec2[1] = direction[1]!;
      this.scratchVec2[2] = direction[2]!;
      normalizeVec3Out(this.scratchVec2, this.scratchVec2);
    } else {
      // Try to use primary camera direction
      const camera = this.scene.primaryCamera;
      if (camera) {
        const cameraTransform = camera.transform;
        cameraTransform.getForward(this.scratchVec2);
      } else {
        // Fallback to entity transform forward
        entity.transform.getForward(this.scratchVec2);
      }
    }

    // Get effective spread
    const effectiveSpread = weapon.getEffectiveSpread(attachmentModifiers);

    // Apply spread (only for hitscan, projectiles get spread during spawn)
    if (weapon.type === 'hitscan') {
      this.applySpread(this.scratchVec2, effectiveSpread);
    }

    // Get ammo type effects
    const ammoTypeDef = getAmmoType(weapon.currentAmmoType);
    const ammoDamageMultiplier = ammoTypeDef.effects.damageMultiplier;
    const effectiveDamage = weapon.getEffectiveDamage(attachmentModifiers, ammoDamageMultiplier);

    // Mark weapon as fired
    const fireSuccess = weapon.fire(this.currentTime);
    if (!fireSuccess) return false;

    // Fire weapon based on type
    if (weapon.type === 'hitscan') {
      this.fireHitscan(
        entity,
        weapon,
        this.scratchVec1,
        this.scratchVec2,
        effectiveDamage,
        ammoTypeDef.effects
      );
    } else if (weapon.type === 'projectile') {
      const effectiveSpreadForProjectile = effectiveSpread;
      this.applySpread(this.scratchVec2, effectiveSpreadForProjectile);
      this.fireProjectile(
        entity,
        weapon,
        this.scratchVec1,
        this.scratchVec2,
        effectiveDamage,
        ammoTypeDef.effects,
        attachmentModifiers
      );
    }

    // Emit fire event
    const fireEvent: WeaponFireEvent = {
      entity,
      weaponType: weapon.type,
      direction: [...this.scratchVec2] as Vec3,
      origin: [...this.scratchVec1] as Vec3,
      spread: effectiveSpread,
      damage: effectiveDamage,
    };
    this.scene.events.emit('weapon:fire', fireEvent);

    // Fire component callback
    if (weapon.onFire) {
      weapon.onFire(
        effectiveDamage,
        [...this.scratchVec2] as [number, number, number],
        [...this.scratchVec1] as [number, number, number]
      );
    }

    return true;
  }

  /**
   * Get attachment modifiers from entity (helper method)
   * @param entity - Entity that may have AttachmentComponent
   * @returns Attachment modifiers or undefined
   */
  private getAttachmentModifiers(entity: Entity) {
    const attachment = entity.getComponent(AttachmentComponent);
    if (!attachment) return undefined;
    return attachment.getEffectiveStats();
  }

  /**
   * Start reloading a weapon
   * Supports both direct WeaponComponent and InventoryComponent
   * @param entity - Entity with WeaponComponent or InventoryComponent
   */
  reload(entity: Entity): void {
    // Check for inventory first
    const inventory = entity.getComponent(InventoryComponent);
    if (inventory) {
      const weapon = inventory.getActiveWeapon();
      if (!weapon) return;
      const attachmentModifiers = this.getAttachmentModifiers(entity);
      const oldAmmo = weapon.ammo;
      weapon.startReload(this.currentTime);

      const effectiveReloadDuration = weapon.getEffectiveReloadDuration(attachmentModifiers);
      const reloadEvent: WeaponReloadEvent = {
        entity,
        oldAmmo,
        newAmmo: weapon.ammo,
        reloadDuration: effectiveReloadDuration,
      };
      this.scene.events.emit('weapon:reload', reloadEvent);
      return;
    }

    // Fallback to direct WeaponComponent
    const weapon = entity.getComponent(WeaponComponent);
    if (!weapon) return;

    const attachmentModifiers = this.getAttachmentModifiers(entity);
    const oldAmmo = weapon.ammo;
    weapon.startReload(this.currentTime);

    // Emit reload event
    const effectiveReloadDuration = weapon.getEffectiveReloadDuration(attachmentModifiers);
    const reloadEvent: WeaponReloadEvent = {
      entity,
      oldAmmo,
      newAmmo: weapon.ammo,
      reloadDuration: effectiveReloadDuration,
    };
    this.scene.events.emit('weapon:reload', reloadEvent);
  }

  /**
   * Fire hitscan weapon (instant raycast)
   * @param entity - Entity firing the weapon
   * @param weapon - Weapon component
   * @param origin - Fire origin
   * @param direction - Fire direction
   * @param damage - Effective damage (with attachments and ammo modifiers)
   * @param ammoEffects - Ammo type effects
   */
  private fireHitscan(
    entity: Entity,
    _weapon: WeaponComponent,
    origin: Vec3,
    direction: Vec3,
    damage: number,
    ammoEffects: { armorPenetration?: number; damageOverTime?: number; dotDuration?: number }
  ): void {
    // Create ray
    const ray: Ray = {
      origin: [...origin] as [number, number, number],
      direction: [...direction] as [number, number, number],
    };

    // Get all entities to test (excluding self)
    const allEntities = this.scene.queryEntities();
    const testEntities = allEntities.filter((e) => e !== entity);

    // Perform raycast
    const hit = this.raycaster.raycastClosest(ray, testEntities);

    if (hit) {
      // Apply damage to hit entity (with armor penetration if applicable)
      const health = hit.entity.getComponent(HealthComponent);
      if (health) {
        // For now, apply full damage. Armor system can be added later
        // If armor exists, apply penetration: finalDamage = damage * (1 - armor * (1 - penetration))
        const finalDamage = damage;
        if (ammoEffects.armorPenetration !== undefined && ammoEffects.armorPenetration > 0) {
          // Armor penetration reduces armor effectiveness
          // This is a placeholder - full armor system needed
          // For now, we just apply the damage
        }

        const damageDealt = health.takeDamage(finalDamage);

        // Apply damage over time if incendiary
        if (ammoEffects.damageOverTime && ammoEffects.dotDuration) {
          // TODO: Apply DoT effect (requires status effect system)
          // For now, just log - can be extended later
        }

        // Emit hit event
        this.scene.events.emit('weapon:hitscan:hit', {
          weapon: entity,
          hit: hit.entity,
          hitPoint: hit.point,
          damage: damageDealt,
        });
      }
    }

    // Recycle ray
    this.raycaster.recycleRay(ray);
  }

  /**
   * Fire projectile weapon (spawn projectile entity)
   * @param entity - Entity firing the weapon
   * @param weapon - Weapon component
   * @param origin - Fire origin
   * @param direction - Fire direction (already has spread applied)
   * @param damage - Effective damage
   * @param ammoEffects - Ammo type effects
   * @param attachmentModifiers - Attachment modifiers for projectile speed
   */
  private fireProjectile(
    entity: Entity,
    weapon: WeaponComponent,
    origin: Vec3,
    direction: Vec3,
    damage: number,
    _ammoEffects: { explosionRadius?: number; explosionFalloff?: number },
    attachmentModifiers?: { projectileSpeedMultiplier?: number }
  ): void {
    // Create projectile entity
    const projectile = this.scene.createEntity('projectile');

    // Set position
    projectile.transform.position = [...origin];

    // Set rotation to face direction
    // Calculate rotation from forward vector
    const forward: Vec3 = [0, 0, -1]; // Default forward
    const axis: Vec3 = [0, 0, 0];

    // Cross product to get rotation axis
    crossVec3Out(axis, forward, direction);

    const axisLength = Math.hypot(axis[0], axis[1], axis[2]);
    if (axisLength > 1e-6) {
      normalizeVec3Out(axis, axis);
      const dot = forward[0] * direction[0] + forward[1] * direction[1] + forward[2] * direction[2];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

      if (angle > 1e-6) {
        quatFromAxisAngleOut(this.scratchQuat, axis, angle);
        projectile.transform.rotation = [...this.scratchQuat];
      }
    }

    // Get effective projectile speed
    const effectiveSpeed = weapon.getEffectiveProjectileSpeed(attachmentModifiers);

    // Add ProjectileComponent with effective damage
    const projectileComp = new ProjectileComponent({
      damage: damage,
      speed: effectiveSpeed,
      lifetime:
        weapon.projectileLifetime ?? weapon.getEffectiveRange(attachmentModifiers) / effectiveSpeed,
      ownerId: entity.id,
    });
    projectileComp.spawnTime = this.currentTime;

    // Store ammo effects in projectile for later use (explosive, etc.)
    // This would require extending ProjectileComponent or using a separate component
    // For now, damage is already applied
    projectile.addComponent(projectileComp);

    // Add PhysicsComponent for movement and collision
    const physics = new PhysicsComponent();
    physics.rigidbodyType = RigidbodyType.Dynamic;
    physics.mass = 0.1; // Light projectile
    physics.velocity = [
      direction[0] * effectiveSpeed,
      direction[1] * effectiveSpeed,
      direction[2] * effectiveSpeed,
    ];
    projectile.addComponent(physics);

    // Add to scene
    this.scene.addEntity(projectile);

    // Emit projectile spawn event
    this.scene.events.emit('weapon:projectile:spawn', {
      projectile,
      owner: entity,
      direction: [...direction] as Vec3,
      speed: weapon.projectileSpeed,
    });
  }

  /**
   * Apply spread (random angle deviation) to direction vector
   */
  private applySpread(direction: Vec3, spread: number): void {
    if (spread <= 0) return;

    // Generate random angles
    const theta = (Math.random() * 2 - 1) * spread; // Angle around up axis
    const phi = Math.random() * Math.PI * 2; // Random rotation around forward

    // Calculate up and right vectors
    const up: Vec3 = [0, 1, 0];
    const right: Vec3 = [0, 0, 0];

    // Cross product: right = direction × up
    crossVec3Out(right, direction, up);

    const rightLength = Math.hypot(right[0], right[1], right[2]);
    if (rightLength < 1e-6) {
      // Direction is parallel to up, use different right vector
      right[0] = 1;
      right[1] = 0;
      right[2] = 0;
    } else {
      normalizeVec3Out(right, right);
    }

    // Rotate direction around right by theta
    quatFromAxisAngleOut(this.scratchQuat, right, theta);
    transformVec3ByQuatOut(direction, direction, this.scratchQuat);

    // Rotate around forward by phi
    quatFromAxisAngleOut(this.scratchQuat, direction, phi);
    transformVec3ByQuatOut(direction, direction, this.scratchQuat);

    normalizeVec3Out(direction, direction);
  }

  /**
   * Get current time (for external use)
   */
  getCurrentTime(): number {
    return this.currentTime;
  }
}
