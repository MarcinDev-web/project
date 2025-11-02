import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '../core/Scene';
import { InventorySystem } from './InventorySystem';
import { InventoryComponent } from '../components/InventoryComponent';
import { WeaponComponent } from '../components/WeaponComponent';

describe('InventorySystem', () => {
  let scene: Scene;
  let inventorySystem: InventorySystem;
  let entity: ReturnType<Scene['createEntity']>;

  beforeEach(() => {
    scene = new Scene();
    inventorySystem = new InventorySystem(scene);
    entity = scene.createEntity('test-entity');
    entity.transform.position = [0, 0, 0];
    scene.addEntity(entity);
  });

  it('should create inventory system', () => {
    expect(inventorySystem).toBeDefined();
  });

  it('should add weapon to inventory', () => {
    const inventory = new InventoryComponent();
    entity.addComponent(inventory);
    
    const weapon = new WeaponComponent({ damage: 30 });
    const added = inventorySystem.addWeapon(entity, weapon);
    expect(added).toBe(true);
    expect(inventory.getWeaponCount()).toBe(1);
  });

  it('should switch weapon', () => {
    const inventory = new InventoryComponent();
    entity.addComponent(inventory);
    
    const weapon1 = new WeaponComponent({ damage: 30 });
    const weapon2 = new WeaponComponent({ damage: 50 });
    inventorySystem.addWeapon(entity, weapon1);
    inventorySystem.addWeapon(entity, weapon2);
    
    const switched = inventorySystem.switchWeapon(entity, 1);
    expect(switched).toBe(true);
    expect(inventory.getActiveWeaponIndex()).toBe(1);
  });

  it('should get active weapon', () => {
    const inventory = new InventoryComponent();
    entity.addComponent(inventory);
    
    const weapon = new WeaponComponent({ damage: 30 });
    inventorySystem.addWeapon(entity, weapon);
    
    const active = inventorySystem.getActiveWeapon(entity);
    expect(active).toBeDefined();
    expect(active?.damage).toBe(30);
  });

  it('should check if can fire', () => {
    const inventory = new InventoryComponent();
    entity.addComponent(inventory);
    
    const weapon = new WeaponComponent({ damage: 30, ammo: 10 });
    inventorySystem.addWeapon(entity, weapon);
    
    const canFire = inventorySystem.canFire(entity, 0);
    expect(canFire).toBe(true);
  });

  it('should not allow fire while switching', () => {
    const inventory = new InventoryComponent();
    entity.addComponent(inventory);
    
    const weapon1 = new WeaponComponent({ damage: 30 });
    const weapon2 = new WeaponComponent({ damage: 50 });
    inventorySystem.addWeapon(entity, weapon1);
    inventorySystem.addWeapon(entity, weapon2);
    inventorySystem.switchWeapon(entity, 1);
    
    const canFire = inventorySystem.canFire(entity, 0);
    expect(canFire).toBe(false);
  });

  it('should update weapon switching', () => {
    const inventory = new InventoryComponent();
    entity.addComponent(inventory);
    
    const weapon1 = new WeaponComponent({ damage: 30 });
    const weapon2 = new WeaponComponent({ damage: 50 });
    inventorySystem.addWeapon(entity, weapon1);
    inventorySystem.addWeapon(entity, weapon2);
    inventorySystem.switchWeapon(entity, 1);
    
    inventorySystem.update(inventory.switchDuration);
    // Switch should complete after duration
    const canFire = inventorySystem.canFire(entity, inventory.switchDuration + 0.1);
    expect(canFire).toBe(true);
  });
});
