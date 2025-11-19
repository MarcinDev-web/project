import { describe, it, expect, beforeEach } from 'vitest';
import { RespawnManager } from './RespawnManager.js';
import { Scene } from '../core/Scene.js';
import { Entity } from '../core/Entity.js';
import { HealthComponent } from '../components/HealthComponent.js';
import { PhysicsComponent } from '../components/PhysicsComponent.js';
import { CharacterController } from '../components/CharacterController.js';
import type { Vec3 } from '@engine/core/math';

describe('RespawnManager', () => {
  let scene: Scene;
  let entity: Entity;

  beforeEach(() => {
    scene = new Scene('Test Scene');
    entity = new Entity('Player');
    scene.addEntity(entity);
  });

  it('should respawn at default location', () => {
    const defaultSpawn = { position: [10, 5, 10] as Vec3, rotation: Math.PI };
    const manager = new RespawnManager({ defaultSpawn });

    const result = manager.respawn(entity);

    expect(result.position).toEqual(defaultSpawn.position);
    expect(result.rotation).toBe(defaultSpawn.rotation);
    expect(entity.transform.position).toEqual(defaultSpawn.position);
  });

  it('should reset health', () => {
    const health = new HealthComponent();
    health.maxHealth = 100;
    health.currentHealth = 0;
    entity.addComponent(health);

    const manager = new RespawnManager({ defaultSpawn: { position: [0,0,0] as Vec3, rotation: 0 } });
    manager.respawn(entity);

    expect(health.currentHealth).toBe(100);
  });

  it('should reset physics velocity', () => {
    const physics = new PhysicsComponent();
    physics.velocity = [10, 10, 10];
    physics.angularVelocity = [5, 5, 5];
    entity.addComponent(physics);

    const manager = new RespawnManager({ defaultSpawn: { position: [0,0,0] as Vec3, rotation: 0 } });
    manager.respawn(entity);

    expect(physics.velocity).toEqual([0, 0, 0]);
    expect(physics.angularVelocity).toEqual([0, 0, 0]);
  });

  it('should use character controller teleport if present', () => {
    const controller = new CharacterController({});
    let teleportCalled = false;
    let teleportPos: Vec3 | null = null;
    
    // Mock teleport
    controller.teleport = (pos: Vec3) => {
      teleportCalled = true;
      teleportPos = pos;
    };
    
    entity.addComponent(controller);

    const defaultSpawn = { position: [5, 0, 5] as Vec3, rotation: 0 };
    const manager = new RespawnManager({ defaultSpawn });
    
    manager.respawn(entity);

    expect(teleportCalled).toBe(true);
    expect(teleportPos).toEqual(defaultSpawn.position);
  });
});

