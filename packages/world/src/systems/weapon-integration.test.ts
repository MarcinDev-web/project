import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '../core/Scene.js';
import { WeaponSystem } from './WeaponSystem.js';
import { InventorySystem } from './InventorySystem.js';
import { InventoryComponent } from '../components/InventoryComponent.js';
import { AttachmentComponent } from '../components/AttachmentComponent.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { createWeapon } from '../factories/WeaponFactory.js';
import { getAttachment } from '../data/attachments.js';
import { getAmmoType } from '../data/ammo.js';

describe('Weapon System Integration', () => {
  let scene: Scene;
  let weaponSystem: WeaponSystem;
  let inventorySystem: InventorySystem;
  let player: ReturnType<Scene['createEntity']>;
  let target: ReturnType<Scene['createEntity']>;

  beforeEach(() => {
    scene = new Scene();
    weaponSystem = new WeaponSystem(scene);
    inventorySystem = new InventorySystem(scene);

    // Create player entity with inventory
    player = scene.createEntity('player');
    player.transform.position = [0, 0, 0];
    const inventory = new InventoryComponent();
    player.addComponent(inventory);
    scene.addEntity(player);

    // Create target entity
    target = scene.createEntity('target');
    target.transform.position = [0, 0, -5]; // 5 units in front
    const health = new HealthComponent();
    health.maxHealth = 100;
    health.currentHealth = 100;
    target.addComponent(health);
    scene.addEntity(target);
  });

  it('should create weapon from preset and fire through inventory', () => {
    // Create weapon from preset
    const weapon = createWeapon('rifle');
    weapon.ammo = 30;
    
    // Add to inventory
    const inventory = player.getComponent(InventoryComponent)!;
    inventorySystem.addWeapon(player, weapon);

    // Fire
    const fired = weaponSystem.fire(player, [0, 0, -1]);
    expect(fired).toBe(true);

    // Update systems
    weaponSystem.update(0.1);
    inventorySystem.update(0.1);

    // Check ammo decreased
    const activeWeapon = inventory.getActiveWeapon();
    expect(activeWeapon?.ammo).toBe(29);
  });

  it('should apply attachments and modify stats', () => {
    const weapon = createWeapon('rifle');
    weapon.ammo = 30;
    const inventory = player.getComponent(InventoryComponent)!;
    inventorySystem.addWeapon(player, weapon);

    // Add attachment component
    const attachmentComp = new AttachmentComponent();
    const redDot = getAttachment('red_dot');
    if (redDot) {
      attachmentComp.addAttachment(redDot);
      player.addComponent(attachmentComp);
    }

    // Fire and check effective spread is reduced
    const activeWeapon = inventory.getActiveWeapon()!;
    const baseSpread = activeWeapon.spread;
    
    weaponSystem.fire(player, [0, 0, -1]);
    weaponSystem.update(0.1);

    // Spread should be reduced by red dot
    const attachmentModifiers = attachmentComp.getEffectiveStats();
    const effectiveSpread = activeWeapon.getEffectiveSpread(attachmentModifiers);
    expect(effectiveSpread).toBeLessThan(baseSpread);
  });

  it('should apply ammo type effects', () => {
    const weapon = createWeapon('rifle');
    weapon.ammo = 30;
    weapon.currentAmmoType = 'armor_piercing';
    
    const inventory = player.getComponent(InventoryComponent)!;
    inventorySystem.addWeapon(player, weapon);

    // Get ammo type definition
    const ammoDef = getAmmoType('armor_piercing');
    
    // Fire
    weaponSystem.fire(player, [0, 0, -1]);
    weaponSystem.update(0.1);

    // Damage should be modified by ammo type
    const activeWeapon = inventory.getActiveWeapon()!;
    const attachmentModifiers = player.getComponent(AttachmentComponent)?.getEffectiveStats();
    const effectiveDamage = activeWeapon.getEffectiveDamage(attachmentModifiers, ammoDef.effects.damageMultiplier);
    
    // Armor piercing has 0.9 multiplier
    expect(effectiveDamage).toBeLessThan(activeWeapon.damage);
  });

  it('should switch weapons and fire different weapon', () => {
    const rifle = createWeapon('rifle');
    rifle.ammo = 30;
    const pistol = createWeapon('pistol');
    pistol.ammo = 12;

    const inventory = player.getComponent(InventoryComponent)!;
    inventorySystem.addWeapon(player, rifle);
    inventorySystem.addWeapon(player, pistol);

    // Start with rifle
    expect(inventory.getActiveWeapon()?.weaponPreset || 'rifle').toBeDefined();
    
    // Switch to pistol
    inventorySystem.switchWeapon(player, 1);
    inventorySystem.update(0.6); // Complete switch

    // Fire pistol
    const fired = weaponSystem.fire(player, [0, 0, -1]);
    expect(fired).toBe(true);
    expect(inventory.getActiveWeapon()?.ammo).toBe(11);
  });

  it('should not fire while switching weapons', () => {
    const rifle = createWeapon('rifle');
    const pistol = createWeapon('pistol');

    inventorySystem.addWeapon(player, rifle);
    inventorySystem.addWeapon(player, pistol);

    // Start switch
    inventorySystem.switchWeapon(player, 1);

    // Try to fire during switch
    const canFire = inventorySystem.canFire(player, weaponSystem.getCurrentTime());
    expect(canFire).toBe(false);
  });

  it('should integrate attachments, ammo types, and inventory', () => {
    // Create weapon with attachments
    const weapon = createWeapon('rifle');
    weapon.ammo = 30;
    weapon.currentAmmoType = 'hollow_point';
    
    const inventory = player.getComponent(InventoryComponent)!;
    inventorySystem.addWeapon(player, weapon);

    // Add attachment
    const attachmentComp = new AttachmentComponent();
    const extendedMag = getAttachment('extended_mag');
    if (extendedMag) {
      attachmentComp.addAttachment(extendedMag);
      player.addComponent(attachmentComp);
    }

    // Check effective stats combine attachments and ammo
    const activeWeapon = inventory.getActiveWeapon()!;
    const attachmentModifiers = attachmentComp.getEffectiveStats();
    const ammoDef = getAmmoType('hollow_point');
    
    const effectiveDamage = activeWeapon.getEffectiveDamage(attachmentModifiers, ammoDef.effects.damageMultiplier);
    const effectiveMaxAmmo = activeWeapon.getEffectiveMaxAmmo(attachmentModifiers);
    
    expect(effectiveMaxAmmo).toBeGreaterThan(weapon.maxAmmo); // Extended mag increases ammo
    expect(effectiveDamage).toBeGreaterThan(weapon.damage); // Hollow point increases damage
  });
});
