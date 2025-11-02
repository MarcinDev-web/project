/**
 * InventorySystem - Manages weapon inventory and switching
 */

import type { Scene } from '../core/Scene';
import type { Entity } from '../core/Entity';
import { InventoryComponent } from '../components/InventoryComponent';
import { WeaponComponent } from '../components/WeaponComponent';
import type { WeaponSwitchedEvent, InventoryUpdatedEvent } from '../types/weapon';

/**
 * Configuration for InventorySystem
 */
export interface InventorySystemConfig {
  /** Enable automatic weapon switching input handling */
  enableInputHandling?: boolean;
}

/**
 * InventorySystem manages weapon inventory and switching
 */
export class InventorySystem {
  private readonly scene: Scene;
  private currentTime: number = 0;

  constructor(scene: Scene, _config?: InventorySystemConfig) {
    this.scene = scene;
    // Config reserved for future use (input handling, etc.)
  }

  /**
   * Update inventory system (called each frame)
   * @param deltaTime - Time since last frame in seconds
   */
  update(deltaTime: number): void {
    if (!(deltaTime > 0)) return;

    this.currentTime += deltaTime;
    const entities = this.scene.queryEntities(InventoryComponent);

    for (const entity of entities) {
      const inventory = entity.getComponent(InventoryComponent);
      if (!inventory) continue;

      // Update weapon switching
      if (inventory.updateSwitch(this.currentTime)) {
        // Switch just completed, emit event
        this.emitWeaponSwitched(entity, inventory);
      }
    }
  }

  /**
   * Switch weapon for an entity
   * @param entity - Entity with InventoryComponent
   * @param weaponIndex - Index of weapon to switch to
   * @returns true if switch initiated successfully
   */
  switchWeapon(entity: Entity, weaponIndex: number): boolean {
    const inventory = entity.getComponent(InventoryComponent);
    if (!inventory) return false;

    const oldIndex = inventory.getActiveWeaponIndex();
    const success = inventory.switchWeapon(weaponIndex, this.currentTime);

    if (success) {
      // Emit switch event
      const switchEvent: WeaponSwitchedEvent = {
        entity,
        oldWeaponIndex: oldIndex,
        newWeaponIndex: weaponIndex,
        switchDuration: inventory.switchDuration,
      };
      this.scene.events.emit('weapon:switched', switchEvent);

      // Emit inventory updated event
      this.emitInventoryUpdated(entity, 'weapon_switched', weaponIndex);
    }

    return success;
  }

  /**
   * Add weapon to inventory
   * @param entity - Entity with InventoryComponent
   * @param weapon - Weapon to add
   * @returns true if added successfully
   */
  addWeapon(entity: Entity, weapon: WeaponComponent): boolean {
    const inventory = entity.getComponent(InventoryComponent);
    if (!inventory) return false;

    const success = inventory.addWeapon(weapon);
    if (success) {
      const weaponIndex = inventory.getWeaponCount() - 1;
      this.emitInventoryUpdated(entity, 'weapon_added', weaponIndex);
    }

    return success;
  }

  /**
   * Remove weapon from inventory
   * @param entity - Entity with InventoryComponent
   * @param weaponIndex - Index of weapon to remove
   * @returns Removed weapon, or undefined if index invalid
   */
  removeWeapon(entity: Entity, weaponIndex: number): WeaponComponent | undefined {
    const inventory = entity.getComponent(InventoryComponent);
    if (!inventory) return undefined;

    const removed = inventory.removeWeapon(weaponIndex);
    if (removed) {
      this.emitInventoryUpdated(entity, 'weapon_removed', weaponIndex);
    }

    return removed;
  }

  /**
   * Get active weapon for entity (through inventory)
   * @param entity - Entity with InventoryComponent
   * @returns Active weapon, or undefined if none or inventory not found
   */
  getActiveWeapon(entity: Entity): WeaponComponent | undefined {
    const inventory = entity.getComponent(InventoryComponent);
    if (!inventory) return undefined;

    return inventory.getActiveWeapon();
  }

  /**
   * Check if entity can fire (has active weapon that can fire)
   * @param entity - Entity with InventoryComponent
   * @param currentTime - Current time in seconds
   * @returns true if can fire
   */
  canFire(entity: Entity, currentTime: number): boolean {
    const inventory = entity.getComponent(InventoryComponent);
    if (!inventory) return false;

    if (inventory.isSwitching) return false;

    const weapon = inventory.getActiveWeapon();
    if (!weapon) return false;

    // Get attachment modifiers if entity has AttachmentComponent
    const attachmentModifiers = this.getAttachmentModifiers(entity);

    return weapon.canFire(currentTime, attachmentModifiers);
  }

  /**
   * Get attachment modifiers from entity (helper method)
   * @param entity - Entity that may have AttachmentComponent
   * @returns Attachment modifiers or undefined
   */
  private getAttachmentModifiers(_entity: Entity) {
    // This will be used when WeaponSystem needs modifiers
    // For now, return undefined - integration will be done in WeaponSystem
    return undefined;
  }

  /**
   * Emit weapon switched event
   */
  private emitWeaponSwitched(entity: Entity, inventory: InventoryComponent): void {
    const switchEvent: WeaponSwitchedEvent = {
      entity,
      oldWeaponIndex: inventory.getActiveWeaponIndex(),
      newWeaponIndex: inventory.getActiveWeaponIndex(),
      switchDuration: inventory.switchDuration,
    };
    this.scene.events.emit('weapon:switched', switchEvent);
  }

  /**
   * Emit inventory updated event
   */
  private emitInventoryUpdated(
    entity: Entity,
    action: 'weapon_added' | 'weapon_removed' | 'weapon_switched',
    weaponIndex?: number
  ): void {
    const updateEvent: InventoryUpdatedEvent = {
      entity,
      action,
    };
    if (weaponIndex !== undefined) {
      updateEvent.weaponIndex = weaponIndex;
    }
    this.scene.events.emit('inventory:updated', updateEvent);
  }

  /**
   * Get current time (for external use)
   */
  getCurrentTime(): number {
    return this.currentTime;
  }
}
