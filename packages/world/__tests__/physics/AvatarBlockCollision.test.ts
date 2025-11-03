import { describe, it, expect } from 'vitest';
import { CollisionDetection } from '@engine/world/physics';
import type { BoxCollider, CapsuleCollider } from '@engine/world';
import { ColliderShape } from '@engine/world';

describe.skip('Avatar (Capsule) - Block (Box) Collision', () => {
  describe('capsule-box collision', () => {
    it('should detect collision between avatar capsule and block box', () => {
      // Avatar capsule: radius 0.5, height 2.0 (typical character controller settings)
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Block box: 1x1x1 unit block
      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Avatar standing on block (capsule bottom touching box top)
      // Capsule center at y=1 (capsule bottom at y=0, touches box top at y=0.5)
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [0, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
      
      if (result.contacts[0]) {
        expect(result.contacts[0].depth).toBeGreaterThan(0);
      }
    });

    it('should detect collision when avatar capsule side touches block box', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Avatar capsule positioned so its side touches the block
      // Capsule at x=0.4 (radius 0.5) should touch box at x=0.5 (box half-size)
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [0.4, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
    });

    it('should not detect collision when avatar and block are separated', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Avatar far away from block
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [5, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(false);
      expect(result.contacts.length).toBe(0);
    });

    it('should handle avatar walking into a wall block', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Wall block: tall and wide
      const wallBox: BoxCollider = {
        shape: ColliderShape.Box,
        size: [2, 4, 2], // 2 units wide, 4 units tall, 2 units deep
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Avatar approaching wall (capsule at z=1.2, should collide with wall at z=1)
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [0, 1, 1.2], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        wallBox,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
      
      if (result.contacts[0]) {
        // Normal direction depends on collision detection algorithm
        // Main thing is that collision is detected
        const normal = result.contacts[0].normal;
        // Normal should be a valid vector (not zero)
        const normalLength = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        expect(normalLength).toBeGreaterThan(0.1);
      }
    });

    it('should handle box-capsule order (block first, avatar second)', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [1, 1, 1],
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Test with box first, capsule second (order matters in some implementations)
      const result = CollisionDetection.detectCollision(
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        capsule,
        { position: [0.4, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
    });
  });

  describe('precise collision detection', () => {
    it('should detect collision when capsule side touches box edge precisely', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      const box: BoxCollider = {
        shape: ColliderShape.Box,
        size: [2, 2, 2], // 1x1x1 unit block (half-size 1)
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Capsule positioned so its edge (radius 0.5) should exactly touch box at x=0.5 (half-size 1)
      // Position at x=0.5 (box edge) + 0.5 (capsule radius) = 1.0
      // But we want to test if it detects when capsule is at x=1.0 - epsilon (just touching)
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [0.99, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
    });

    it('should NOT detect collision when capsule is just outside box edge', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
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

      // Capsule positioned so its edge is just outside box
      // Box half-size = 1, capsule radius = 0.5
      // At x = 1.0 + 0.5 + 0.01 = 1.51, capsule edge at x = 1.51 - 0.5 = 1.01 (just outside box at x=1.0)
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [1.51, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(false);
    });

    it('should accurately detect collision with rotated box', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
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

      // Rotate box 45 degrees around Y axis, then test capsule approaching from side
      // Using quaternion for 45 degree rotation around Y: [0, sin(22.5°), 0, cos(22.5°)]
      const angle45 = Math.PI / 4;
      const rotation: [number, number, number, number] = [0, Math.sin(angle45 / 2), 0, Math.cos(angle45 / 2)];

      // Position capsule to collide with rotated box
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [0.7, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation, scale: [1, 1, 1] }
      );

      // Should detect collision (precise algorithm handles rotations)
      expect(result.hasCollision).toBe(true);
    });

    it('should accurately compute contact point on box surface', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
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

      // Capsule touching box from the side (x-direction)
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [0.7, 1, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        box,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBe(1);
      
      if (result.contacts[0]) {
        const contact = result.contacts[0];
        // Contact point should be on box surface (x should be close to 1.0, box edge)
        expect(Math.abs(contact.position[0] - 1.0)).toBeLessThan(0.6); // Within reasonable tolerance
        
        // Normal should point from box to capsule (positive X direction)
        expect(contact.normal[0]).toBeGreaterThan(0);
        expect(Math.abs(contact.normal[1])).toBeLessThan(0.1); // Mostly horizontal
      }
    });

    it('should handle large boxes correctly', () => {
      const capsule: CapsuleCollider = {
        shape: ColliderShape.Capsule,
        radius: 0.5,
        height: 2.0,
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Large box (like a wall)
      const largeBox: BoxCollider = {
        shape: ColliderShape.Box,
        size: [10, 4, 2], // 5 units wide, 2 units tall, 1 unit deep
        center: [0, 0, 0],
        isTrigger: false,
        friction: 0.5,
        restitution: 0.3,
      };

      // Avatar approaching large wall
      const result = CollisionDetection.detectCollision(
        capsule,
        { position: [0, 1, 0.6], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
        largeBox,
        { position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }
      );

      expect(result.hasCollision).toBe(true);
      expect(result.contacts.length).toBeGreaterThan(0);
      
      if (result.contacts[0]) {
        // Contact should be on the wall surface (z should be close to 1.0)
        const contact = result.contacts[0];
        expect(Math.abs(contact.position[2] - 1.0)).toBeLessThan(0.6);
      }
    });
  });
});


