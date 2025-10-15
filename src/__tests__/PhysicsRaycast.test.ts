import { describe, it, expect, beforeEach } from 'vitest';
import { PhysicsRaycast, type PhysicsRay } from '../physics/PhysicsRaycast';
import { Entity } from '../scene/Entity';
import { PhysicsComponent, RigidbodyType } from '../scene/components/PhysicsComponent';
import { Scene } from '../scene/Scene';
import { PhysicsWorld } from '../physics/PhysicsWorld';

describe('PhysicsRaycast', () => {
  let scene: Scene;
  let physics: PhysicsWorld;

  beforeEach(() => {
    scene = new Scene();
    physics = new PhysicsWorld(scene);
  });

  describe('Box Collider Raycasting', () => {
    it('should hit a box collider from the front', () => {
      const entity = new Entity('Box');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [1, 1, 1];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      expect(hit!.entity).toBe(entity);
      expect(hit!.distance).toBeCloseTo(4, 1); // 5 - 1 (half size)
    });

    it('should miss a box collider when ray points away', () => {
      const entity = new Entity('Box');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [-1, 0, 0], // Pointing away
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).toBeNull();
    });

    it('should hit a rotated box collider', () => {
      const entity = new Entity('Box');
      entity.transform.position = [0, 0, 0];
      entity.transform.rotation = [0, 0, 0.3826834, 0.9238795]; // 45 degrees around Z
      entity.transform.scale = [1, 1, 1];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
    });

    it('should respect maxDistance', () => {
      const entity = new Entity('Box');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
        maxDistance: 2, // Too short to reach the box
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).toBeNull();
    });

    it('should calculate correct hit point and normal', () => {
      const entity = new Entity('Box');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      expect(hit!.point[0]).toBeCloseTo(-1, 1); // Left face of box
      expect(hit!.normal[0]).toBeCloseTo(-1, 1); // Normal pointing left
      expect(hit!.normal[1]).toBeCloseTo(0, 1);
      expect(hit!.normal[2]).toBeCloseTo(0, 1);
    });
  });

  describe('Sphere Collider Raycasting', () => {
    it('should hit a sphere collider', () => {
      const entity = new Entity('Sphere');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addSphereCollider(1.0);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      expect(hit!.distance).toBeCloseTo(4, 1); // 5 - 1 (radius)
    });

    it('should hit a scaled sphere', () => {
      const entity = new Entity('Sphere');
      entity.transform.position = [0, 0, 0];
      entity.transform.scale = [2, 2, 2]; // Double size

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addSphereCollider(1.0);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      expect(hit!.distance).toBeCloseTo(3, 1); // 5 - 2 (scaled radius)
    });

    it('should calculate correct normal for sphere', () => {
      const entity = new Entity('Sphere');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addSphereCollider(1.0);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      // Normal should point away from sphere center
      expect(hit!.normal[0]).toBeCloseTo(-1, 1);
      expect(hit!.normal[1]).toBeCloseTo(0, 1);
      expect(hit!.normal[2]).toBeCloseTo(0, 1);
    });
  });

  describe('Capsule Collider Raycasting', () => {
    it('should hit a capsule collider', () => {
      const entity = new Entity('Capsule');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addCapsuleCollider(0.5, 2.0);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      expect(hit!.distance).toBeGreaterThan(0);
    });

    it('should hit capsule end cap', () => {
      const entity = new Entity('Capsule');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addCapsuleCollider(0.5, 2.0);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [0, 5, 0],
        direction: [0, -1, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
    });
  });

  describe('PhysicsWorld Integration', () => {
    it('should raycast and find closest entity', () => {
      // Create two boxes
      const box1 = new Entity('Box1');
      box1.transform.position = [0, 0, 0];
      const physics1 = new PhysicsComponent();
      physics1.rigidbodyType = RigidbodyType.Static;
      physics1.addBoxCollider([2, 2, 2]);
      box1.addComponent(physics1);
      scene.addEntity(box1);

      const box2 = new Entity('Box2');
      box2.transform.position = [10, 0, 0];
      const physics2 = new PhysicsComponent();
      physics2.rigidbodyType = RigidbodyType.Static;
      physics2.addBoxCollider([2, 2, 2]);
      box2.addComponent(physics2);
      scene.addEntity(box2);

      // Cast ray from left
      const hit = physics.raycast([-5, 0, 0], [1, 0, 0]);

      expect(hit).not.toBeNull();
      expect(hit!.entity).toBe(box1); // Should hit box1 first
    });

    it('should raycastAll and return multiple hits', () => {
      // Create two boxes in line
      const box1 = new Entity('Box1');
      box1.transform.position = [0, 0, 0];
      const physics1 = new PhysicsComponent();
      physics1.rigidbodyType = RigidbodyType.Static;
      physics1.addBoxCollider([1, 1, 1]);
      box1.addComponent(physics1);
      scene.addEntity(box1);

      const box2 = new Entity('Box2');
      box2.transform.position = [5, 0, 0];
      const physics2 = new PhysicsComponent();
      physics2.rigidbodyType = RigidbodyType.Static;
      physics2.addBoxCollider([1, 1, 1]);
      box2.addComponent(physics2);
      scene.addEntity(box2);

      // Cast ray through both boxes
      const hits = physics.raycastAll([-5, 0, 0], [1, 0, 0]);

      expect(hits.length).toBe(2);
      expect(hits[0]!.entity).toBe(box1); // First hit
      expect(hits[1]!.entity).toBe(box2); // Second hit
      expect(hits[0]!.distance).toBeLessThan(hits[1]!.distance);
    });

    it('should respect ignoreEntities option', () => {
      const box1 = new Entity('Box1');
      box1.transform.position = [0, 0, 0];
      const physics1 = new PhysicsComponent();
      physics1.rigidbodyType = RigidbodyType.Static;
      physics1.addBoxCollider([2, 2, 2]);
      box1.addComponent(physics1);
      scene.addEntity(box1);

      const box2 = new Entity('Box2');
      box2.transform.position = [10, 0, 0];
      const physics2 = new PhysicsComponent();
      physics2.rigidbodyType = RigidbodyType.Static;
      physics2.addBoxCollider([2, 2, 2]);
      box2.addComponent(physics2);
      scene.addEntity(box2);

      // Ignore box1
      const hit = physics.raycast([-5, 0, 0], [1, 0, 0], {
        ignoreEntities: [box1],
      });

      expect(hit).not.toBeNull();
      expect(hit!.entity).toBe(box2); // Should hit box2 since box1 is ignored
    });

    it('should respect maxDistance option', () => {
      const box = new Entity('Box');
      box.transform.position = [10, 0, 0];
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      box.addComponent(physicsComp);
      scene.addEntity(box);

      // Ray too short to reach box
      const hit = physics.raycast([0, 0, 0], [1, 0, 0], {
        maxDistance: 5,
      });

      expect(hit).toBeNull();
    });

    it('should handle trigger colliders based on hitTriggers option', () => {
      const triggerBox = new Entity('TriggerBox');
      triggerBox.transform.position = [0, 0, 0];
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      const collider = physicsComp.addBoxCollider([2, 2, 2]);
      collider.isTrigger = true;
      triggerBox.addComponent(physicsComp);
      scene.addEntity(triggerBox);

      // Should not hit triggers by default
      const hit1 = physics.raycast([-5, 0, 0], [1, 0, 0]);
      expect(hit1).toBeNull();

      // Should hit triggers when requested
      const hit2 = physics.raycast([-5, 0, 0], [1, 0, 0], {
        hitTriggers: true,
      });
      expect(hit2).not.toBeNull();
      expect(hit2!.entity).toBe(triggerBox);
    });
  });

  describe('Edge Cases', () => {
    it('should handle ray starting inside collider', () => {
      const entity = new Entity('Box');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [0, 0, 0], // Inside the box
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      // Should still return a hit (exit point)
      expect(hit).not.toBeNull();
    });

    it('should handle zero-length direction by normalizing', () => {
      const box = new Entity('Box');
      box.transform.position = [0, 0, 0];
      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([2, 2, 2]);
      box.addComponent(physicsComp);
      scene.addEntity(box);

      // This should not crash
      const hit = physics.raycast([5, 0, 0], [0, 0, 0]);
      
      // Should use default direction
      expect(() => physics.raycast([5, 0, 0], [0, 0, 0])).not.toThrow();
    });

    it('should handle entity with no physics component', () => {
      const entity = new Entity('NoPhysics');
      entity.transform.position = [0, 0, 0];
      // No physics component added

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).toBeNull();
    });

    it('should handle entity with empty colliders array', () => {
      const entity = new Entity('NoColliders');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      // No colliders added
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).toBeNull();
    });

    it('should return closest collider when entity has multiple', () => {
      const entity = new Entity('MultiCollider');
      entity.transform.position = [0, 0, 0];

      const physicsComp = new PhysicsComponent();
      physicsComp.rigidbodyType = RigidbodyType.Static;
      physicsComp.addBoxCollider([1, 1, 1]); // Smaller box (index 0)
      physicsComp.addBoxCollider([3, 3, 3]); // Larger box (index 1) - extends farther
      entity.addComponent(physicsComp);

      const ray: PhysicsRay = {
        origin: [-5, 0, 0],
        direction: [1, 0, 0],
      };

      const hit = PhysicsRaycast.raycastEntity(ray, entity);

      expect(hit).not.toBeNull();
      // The larger collider (index 1) extends farther, so it gets hit first
      expect(hit!.colliderIndex).toBe(1);
    });
  });

  describe('Performance', () => {
    it('should handle many entities efficiently', () => {
      // Create 100 boxes
      for (let i = 0; i < 100; i++) {
        const box = new Entity(`Box${i}`);
        box.transform.position = [i * 2, 0, 0];
        const physicsComp = new PhysicsComponent();
        physicsComp.rigidbodyType = RigidbodyType.Static;
        physicsComp.addBoxCollider([1, 1, 1]);
        box.addComponent(physicsComp);
        scene.addEntity(box);
      }

      const startTime = performance.now();
      const hit = physics.raycast([-5, 0, 0], [1, 0, 0]);
      const endTime = performance.now();

      expect(hit).not.toBeNull();
      expect(endTime - startTime).toBeLessThan(100); // Should complete quickly
    });
  });
});

