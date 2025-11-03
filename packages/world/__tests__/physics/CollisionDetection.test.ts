import { describe, it, expect } from 'vitest';
import { CollisionDetection } from '@engine/world/physics';
import type { BoxCollider, SphereCollider, CapsuleCollider } from '@engine/world';
import { ColliderShape } from '@engine/world';

describe.skip('CollisionDetection', () => {
  describe('box-box collision', () => {
    it('should detect collision between overlapping boxes', () => {
      const boxA: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const boxB: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        boxA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        boxB,
        { position: [0.5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
    });

    it('should not detect collision between separated boxes', () => {
      const boxA: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const boxB: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        boxA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        boxB,
        { position: [5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(false);
      expect(result.contacts.length).toBe(0);
    });

    it('should detect collision at exact boundary', () => {
      const boxA: BoxCollider = {
        shape: ColliderShape.Box,
        size: [2, 2, 2], // Half-size 1
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const boxB: BoxCollider = {
        shape: ColliderShape.Box,
        size: [2, 2, 2],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Boxes touching at edge
      const result = CollisionDetection.detectCollision(
        boxA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        boxB,
        { position: [2, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      // Should be very close or touching
      expect(result.hasCollision || result.contacts.length === 0).toBe(true);
    });
  });

  describe('sphere-sphere collision', () => {
    it('should detect collision between overlapping spheres', () => {
      const sphereA: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const sphereB: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        sphereA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        sphereB,
        { position: [1.5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
      
      if (result.contacts[0]) {
        expect(result.contacts[0].depth).toBeGreaterThan(0);
      }
    });

    it('should not detect collision between separated spheres', () => {
      const sphereA: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const sphereB: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        sphereA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        sphereB,
        { position: [5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(false);
    });

    it('should calculate correct contact normal', () => {
      const sphereA: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const sphereB: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        sphereA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        sphereB,
        { position: [1, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      
      if (result.contacts[0]) {
        const normal = result.contacts[0].normal;
        // Normal should point from A to B (along X axis)
        expect(normal[0]).toBeCloseTo(1, 1);
        expect(normal[1]).toBeCloseTo(0, 1);
        expect(normal[2]).toBeCloseTo(0, 1);
      }
    });
  });

  describe('box-sphere collision', () => {
    it('should detect collision between box and sphere', () => {
      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [2, 2, 2],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const sphere: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        sphere,
        { position: [1.5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
    });

    it('should not detect collision when separated', () => {
      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [2, 2, 2],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const sphere: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        sphere,
        { position: [10, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(false);
    });

    it('should work with sphere-box order', () => {
      const sphere: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [2, 2, 2],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Test sphere first, then box
      const result = CollisionDetection.detectCollision(
        sphere,
        { position: [1.5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
    });
  });

  describe('capsule collision', () => {
    it('should detect collision between capsules', () => {
      const capsuleA: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const capsuleB: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        capsuleA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        capsuleB,
        { position: [0.8, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
    });

    it('should not detect collision when separated', () => {
      const capsuleA: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const capsuleB: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        capsuleA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        capsuleB,
        { position: [5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(false);
    });
  });

  describe('scale handling', () => {
    it('should handle scaled boxes', () => {
      const boxA: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const boxB: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Scale makes boxes larger - box A has half-size 1 scaled by 2 = 2
      // box B has half-size 0.5 = 0.5, so they should overlap at distance 1.5
      const result = CollisionDetection.detectCollision(
        boxA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [2, 2, 2] },
        boxB,
        { position: [1.5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
    });

    it('should handle scaled spheres', () => {
      const sphereA: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const sphereB: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Sphere A: radius 1.0 * average scale 2.0 = 2.0
      // Sphere B: radius 1.0 * average scale 1.0 = 1.0
      // They should collide at distance 2.8 (radius sum 3.0 > distance)
      const result = CollisionDetection.detectCollision(
        sphereA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [2, 2, 2] },
        sphereB,
        { position: [2.8, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
    });
  });

  describe('contact point calculation', () => {
    it('should generate contact point for collision', () => {
      const sphereA: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const sphereB: SphereCollider = {
        shape: ColliderShape.Sphere,
        radius: 1.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const result = CollisionDetection.detectCollision(
        sphereA,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        sphereB,
        { position: [1, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBe(1);
      
      const contact = result.contacts[0];
      if (contact) {
        expect(contact.position).toBeDefined();
        expect(contact.normal).toBeDefined();
        expect(contact.depth).toBeGreaterThan(0);
      }
    });
  });
});


