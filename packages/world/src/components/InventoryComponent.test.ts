import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryComponent } from './InventoryComponent.js';
import { WeaponComponent } from './WeaponComponent.js';

describe('InventoryComponent', () => {
  let inventory: InventoryComponent;
  let weapon1: WeaponComponent;
  let weapon2: WeaponComponent;

  beforeEach(() => {
    inventory = new InventoryComponent();
    weapon1 = new WeaponComponent({ damage: 30, maxAmmo: 30 });
    weapon2 = new WeaponComponent({ damage: 50, maxAmmo: 10 });
  });

  it('should create empty inventory', () => {
    expect(inventory.getWeaponCount()).toBe(0);
    expect(inventory.getActiveWeapon()).toBeUndefined();
    expect(inventory.isFull()).toBe(false);
  });

  it('should add weapon', () => {
    const added = inventory.addWeapon(weapon1);
    expect(added).toBe(true);
    expect(inventory.getWeaponCount()).toBe(1);
    expect(inventory.getActiveWeapon()).toBeDefined();
  });

  it('should switch weapon', () => {
    inventory.addWeapon(weapon1);
    inventory.addWeapon(weapon2);
    expect(inventory.getActiveWeaponIndex()).toBe(0);
    
    const switched = inventory.switchWeapon(1, 0);
    expect(switched).toBe(true);
    expect(inventory.getActiveWeaponIndex()).toBe(1);
    expect(inventory.getActiveWeapon()?.damage).toBe(50);
  });

  it('should not switch to same weapon', () => {
    inventory.addWeapon(weapon1);
    const switched = inventory.switchWeapon(0, 0);
    expect(switched).toBe(false);
  });

  it('should remove weapon', () => {
    inventory.addWeapon(weapon1);
    inventory.addWeapon(weapon2);
    const removed = inventory.removeWeapon(0);
    expect(removed).toBeDefined();
    expect(inventory.getWeaponCount()).toBe(1);
    expect(inventory.getActiveWeaponIndex()).toBe(0); // Should adjust to weapon at index 0
  });

  it('should respect max weapons limit', () => {
    inventory.maxWeapons = 2;
    inventory.addWeapon(weapon1);
    inventory.addWeapon(weapon2);
    const added = inventory.addWeapon(new WeaponComponent());
    expect(added).toBe(false);
    expect(inventory.getWeaponCount()).toBe(2);
  });

  it('should update switch state', () => {
    inventory.addWeapon(weapon1);
    inventory.addWeapon(weapon2);
    inventory.switchWeapon(1, 0);
    expect(inventory.isSwitching).toBe(true);
    
    const completed = inventory.updateSwitch(inventory.switchDuration);
    expect(completed).toBe(true);
    expect(inventory.isSwitching).toBe(false);
  });
});
