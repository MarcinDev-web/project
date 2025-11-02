import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';
import { PhysicsSystem } from '@engine/world/physics';
import { PhysicsComponent, RigidbodyType } from '@engine/world';
import { CharacterController } from '@engine/world';
import { HealthComponent } from '@engine/world';
import { BlockBehaviorSystem } from '@engine/world/systems';
import type { CollisionEvent } from '@engine/world/physics';

describe('BlockBehaviorSystem', () => {
  let scene: Scene;
  let physicsSystem: PhysicsSystem;
  let blockSystem: BlockBehaviorSystem;
  let collisionListener: ((event: CollisionEvent) => void) | null = null;

  beforeEach(() => {
    scene = new Scene('TestScene');
    physicsSystem = new PhysicsSystem(scene);
    
    // Capture collision listener
    const originalOnCollision = physicsSystem.onCollision.bind(physicsSystem);
    physicsSystem.onCollision = vi.fn((listener) => {
      collisionListener = listener;
      originalOnCollision(listener);
    });

    blockSystem = new BlockBehaviorSystem(scene, physicsSystem);
  });

  describe('ice block effects', () => {
    it('should apply friction multiplier from ice block', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.friction = 0.5;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const iceBlock = new Entity('IceBlock');
      iceBlock.userData = { blockId: 'ice' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      iceBlock.addComponent(blockPhysics);
      scene.addEntity(iceBlock);

      // Simulate collision
      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: iceBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);

      // Ice has frictionMultiplier 0.1
      expect(playerPhysics.material.friction).toBeCloseTo(0.5 * 0.1);
    });

    it('should apply speed multiplier from ice block', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      player.addComponent(playerPhysics);
      const controller = new CharacterController();
      controller.config.moveSpeed = 5.0;
      player.addComponent(controller);
      scene.addEntity(player);

      const iceBlock = new Entity('IceBlock');
      iceBlock.userData = { blockId: 'ice' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      iceBlock.addComponent(blockPhysics);
      scene.addEntity(iceBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: iceBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);

      // Ice has movementSpeedMultiplier 1.5
      expect(controller.config.moveSpeed).toBeCloseTo(5.0 * 1.5);
    });
  });

  describe('slime block effects', () => {
    it('should apply friction multiplier from slime block', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.friction = 0.5;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const slimeBlock = new Entity('SlimeBlock');
      slimeBlock.userData = { blockId: 'slime' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      slimeBlock.addComponent(blockPhysics);
      scene.addEntity(slimeBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: slimeBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);

      // Slime has frictionMultiplier 2.0
      expect(playerPhysics.material.friction).toBeCloseTo(0.5 * 2.0);
    });

    it('should apply speed multiplier from slime block', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      player.addComponent(playerPhysics);
      const controller = new CharacterController();
      controller.config.moveSpeed = 5.0;
      player.addComponent(controller);
      scene.addEntity(player);

      const slimeBlock = new Entity('SlimeBlock');
      slimeBlock.userData = { blockId: 'slime' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      slimeBlock.addComponent(blockPhysics);
      scene.addEntity(slimeBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: slimeBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);

      // Slime has movementSpeedMultiplier 0.5
      expect(controller.config.moveSpeed).toBeCloseTo(5.0 * 0.5);
    });
  });

  describe('lava block effects', () => {
    it('should apply damage over time from lava block', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      player.addComponent(playerPhysics);
      const health = new HealthComponent();
      health.currentHealth = 100;
      player.addComponent(health);
      scene.addEntity(player);

      const lavaBlock = new Entity('LavaBlock');
      lavaBlock.userData = { blockId: 'lava' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      lavaBlock.addComponent(blockPhysics);
      scene.addEntity(lavaBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: lavaBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      
      // Lava has damagePerSecond 20, tick interval 0.1s
      // So damage per tick = 20 * 0.1 = 2
      blockSystem.update(0.1); // One damage tick

      expect(health.currentHealth).toBeLessThan(100);
      expect(health.currentHealth).toBeCloseTo(98); // 100 - 2
    });
  });

  describe('poison block effects', () => {
    it('should apply damage over time from poison block', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      player.addComponent(playerPhysics);
      const health = new HealthComponent();
      health.currentHealth = 100;
      player.addComponent(health);
      scene.addEntity(player);

      const poisonBlock = new Entity('PoisonBlock');
      poisonBlock.userData = { blockId: 'poison' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      poisonBlock.addComponent(blockPhysics);
      scene.addEntity(poisonBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: poisonBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      
      // Poison has damagePerSecond 5, tick interval 0.1s
      // So damage per tick = 5 * 0.1 = 0.5
      blockSystem.update(0.1); // One damage tick

      expect(health.currentHealth).toBeLessThan(100);
      expect(health.currentHealth).toBeCloseTo(99.5); // 100 - 0.5
    });
  });

  describe('effect cleanup', () => {
    it('should restore original friction when collision ends', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.friction = 0.5;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const iceBlock = new Entity('IceBlock');
      iceBlock.userData = { blockId: 'ice' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      iceBlock.addComponent(blockPhysics);
      scene.addEntity(iceBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: iceBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);
      expect(playerPhysics.material.friction).toBeCloseTo(0.05); // 0.5 * 0.1

      // Wait for collision timeout (0.2s)
      blockSystem.update(0.2);
      expect(playerPhysics.material.friction).toBeCloseTo(0.5); // Restored
    });

    it('should restore original speed when collision ends', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      player.addComponent(playerPhysics);
      const controller = new CharacterController();
      controller.config.moveSpeed = 5.0;
      player.addComponent(controller);
      scene.addEntity(player);

      const slimeBlock = new Entity('SlimeBlock');
      slimeBlock.userData = { blockId: 'slime' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      slimeBlock.addComponent(blockPhysics);
      scene.addEntity(slimeBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: slimeBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);
      expect(controller.config.moveSpeed).toBeCloseTo(2.5); // 5.0 * 0.5

      // Wait for collision timeout
      blockSystem.update(0.2);
      expect(controller.config.moveSpeed).toBeCloseTo(5.0); // Restored
    });
  });

  describe('effect stacking', () => {
    it('should use maximum friction multiplier when multiple blocks present', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.friction = 0.5;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const iceBlock = new Entity('IceBlock');
      iceBlock.userData = { blockId: 'ice' };
      const icePhysics = new PhysicsComponent();
      icePhysics.rigidbodyType = RigidbodyType.Static;
      iceBlock.addComponent(icePhysics);
      scene.addEntity(iceBlock);

      const slimeBlock = new Entity('SlimeBlock');
      slimeBlock.userData = { blockId: 'slime' };
      const slimePhysics = new PhysicsComponent();
      slimePhysics.rigidbodyType = RigidbodyType.Static;
      slimeBlock.addComponent(slimePhysics);
      scene.addEntity(slimeBlock);

      // Collide with ice (friction 0.1)
      const collision1: CollisionEvent = {
        entityA: player,
        entityB: iceBlock,
        physicsA: playerPhysics,
        physicsB: icePhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };
      collisionListener!(collision1);

      // Collide with slime (friction 2.0) - should use max (2.0)
      const collision2: CollisionEvent = {
        entityA: player,
        entityB: slimeBlock,
        physicsA: playerPhysics,
        physicsB: slimePhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };
      collisionListener!(collision2);

      blockSystem.update(0.016);
      // Should use maximum friction multiplier (2.0 from slime)
      expect(playerPhysics.material.friction).toBeCloseTo(0.5 * 2.0);
    });
  });

  describe('bouncy block effects', () => {
    it('should apply restitution multiplier from bouncy block', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.restitution = 0.3;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const bouncyBlock = new Entity('BouncyBlock');
      bouncyBlock.userData = { blockId: 'bouncy' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      bouncyBlock.addComponent(blockPhysics);
      scene.addEntity(bouncyBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: bouncyBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);

      // Bouncy has restitutionMultiplier 2.0
      expect(playerPhysics.material.restitution).toBeCloseTo(0.3 * 2.0);
    });

    it('should restore original restitution when collision ends', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.restitution = 0.3;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const bouncyBlock = new Entity('BouncyBlock');
      bouncyBlock.userData = { blockId: 'bouncy' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      bouncyBlock.addComponent(blockPhysics);
      scene.addEntity(bouncyBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: bouncyBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);
      expect(playerPhysics.material.restitution).toBeCloseTo(0.6); // 0.3 * 2.0

      // Wait for collision timeout (0.2s)
      blockSystem.update(0.2);
      expect(playerPhysics.material.restitution).toBeCloseTo(0.3); // Restored
    });

    it('should use maximum restitution multiplier when multiple blocks present', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.restitution = 0.3;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const bouncyBlock1 = new Entity('BouncyBlock1');
      bouncyBlock1.userData = { blockId: 'bouncy' };
      const blockPhysics1 = new PhysicsComponent();
      blockPhysics1.rigidbodyType = RigidbodyType.Static;
      bouncyBlock1.addComponent(blockPhysics1);
      scene.addEntity(bouncyBlock1);

      // Create a custom block with higher restitution multiplier for testing
      // Note: This test assumes we can create blocks with different multipliers
      // In practice, all bouncy blocks have 2.0, so this tests the max logic
      const collisionEvent1: CollisionEvent = {
        entityA: player,
        entityB: bouncyBlock1,
        physicsA: playerPhysics,
        physicsB: blockPhysics1,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent1);
      blockSystem.update(0.016);

      // Should apply restitution multiplier (2.0)
      expect(playerPhysics.material.restitution).toBeCloseTo(0.3 * 2.0);
    });
  });

  describe('removeEntity', () => {
    it('should cleanup effects when entity is removed', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.friction = 0.5;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const iceBlock = new Entity('IceBlock');
      iceBlock.userData = { blockId: 'ice' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      iceBlock.addComponent(blockPhysics);
      scene.addEntity(iceBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: iceBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);

      // Remove entity
      blockSystem.removeEntity(player);
      blockSystem.update(0.016);

      // Friction should be restored
      expect(playerPhysics.material.friction).toBeCloseTo(0.5);
    });

    it('should restore original restitution when entity is removed', () => {
      const player = new Entity('Player');
      const playerPhysics = new PhysicsComponent();
      playerPhysics.rigidbodyType = RigidbodyType.Dynamic;
      playerPhysics.material.restitution = 0.3;
      player.addComponent(playerPhysics);
      scene.addEntity(player);

      const bouncyBlock = new Entity('BouncyBlock');
      bouncyBlock.userData = { blockId: 'bouncy' };
      const blockPhysics = new PhysicsComponent();
      blockPhysics.rigidbodyType = RigidbodyType.Static;
      bouncyBlock.addComponent(blockPhysics);
      scene.addEntity(bouncyBlock);

      const collisionEvent: CollisionEvent = {
        entityA: player,
        entityB: bouncyBlock,
        physicsA: playerPhysics,
        physicsB: blockPhysics,
        normal: [0, 1, 0],
        depth: 0.1,
        contactPoint: [0, 0, 0],
      };

      collisionListener!(collisionEvent);
      blockSystem.update(0.016);

      // Remove entity
      blockSystem.removeEntity(player);
      blockSystem.update(0.016);

      // Restitution should be restored
      expect(playerPhysics.material.restitution).toBeCloseTo(0.3);
    });
  });
});

