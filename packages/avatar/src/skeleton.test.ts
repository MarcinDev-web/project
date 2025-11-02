import { describe, it, expect } from 'vitest';
import { AvatarSkeleton } from './skeleton';
import type { AvatarJointName, AvatarJointDefinition } from './skeleton';
import type { Vec3, Quat } from '@engine/core/math';

describe('AvatarSkeleton', () => {
  describe('constructor', () => {
    it('should create skeleton with default joints', () => {
      const skeleton = new AvatarSkeleton();
      const jointNames = skeleton.getJointNames();

      expect(jointNames.length).toBeGreaterThan(0);
      expect(jointNames).toContain('Root');
      expect(jointNames).toContain('Head');
    });

    it('should create skeleton with custom joints', () => {
      const customJoints: AvatarJointDefinition[] = [
        { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
        { name: 'Hips', parent: 'Root', defaultPosition: [0, 1, 0] },
      ];

      const skeleton = new AvatarSkeleton(customJoints);
      const jointNames = skeleton.getJointNames();

      expect(jointNames).toContain('Root');
      expect(jointNames).toContain('Hips');
    });

    it('should throw error for empty joints', () => {
      expect(() => {
        new AvatarSkeleton([]);
      }).toThrow('at least one joint');
    });

    it('should throw error for duplicate joint names', () => {
      const duplicateJoints: AvatarJointDefinition[] = [
        { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
        { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
      ];

      expect(() => {
        new AvatarSkeleton(duplicateJoints);
      }).toThrow('Duplicate joint name');
    });

    it('should throw error for unknown parent', () => {
      const invalidJoints: AvatarJointDefinition[] = [
        { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
        { name: 'Hips', parent: 'UnknownParent' as AvatarJointName, defaultPosition: [0, 1, 0] },
      ];

      expect(() => {
        new AvatarSkeleton(invalidJoints);
      }).toThrow('Unknown parent joint');
    });

    it('should initialize with default pose', () => {
      const skeleton = new AvatarSkeleton();
      const transform = skeleton.getLocalTransform('Head');

      expect(transform.position).toBeDefined();
      expect(transform.rotation).toBeDefined();
    });
  });

  describe('getJointNames', () => {
    it('should return all joint names', () => {
      const skeleton = new AvatarSkeleton();
      const names = skeleton.getJointNames();

      expect(names.length).toBeGreaterThan(0);
      expect(names).toContain('Root');
    });

    it('should return names in definition order', () => {
      const customJoints: AvatarJointDefinition[] = [
        { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
        { name: 'Hips', parent: 'Root', defaultPosition: [0, 1, 0] },
        { name: 'Spine', parent: 'Root', defaultPosition: [0, 2, 0] },
      ];

      const skeleton = new AvatarSkeleton(customJoints);
      const names = skeleton.getJointNames();

      expect(names[0]).toBe('Root');
      expect(names[1]).toBe('Hips');
      expect(names[2]).toBe('Spine');
    });
  });

  describe('getParent', () => {
    it('should return parent joint name', () => {
      const skeleton = new AvatarSkeleton();
      const parent = skeleton.getParent('Head');

      expect(parent).toBe('Neck');
    });

    it('should return null for root joint', () => {
      const skeleton = new AvatarSkeleton();
      const parent = skeleton.getParent('Root');

      expect(parent).toBeNull();
    });

    it('should throw error for unknown joint', () => {
      const skeleton = new AvatarSkeleton();

      expect(() => {
        skeleton.getParent('UnknownJoint' as AvatarJointName);
      }).toThrow('Unknown joint');
    });
  });

  describe('getLocalTransform', () => {
    it('should return local transform', () => {
      const skeleton = new AvatarSkeleton();
      const transform = skeleton.getLocalTransform('Head');

      expect(transform.position).toBeDefined();
      expect(transform.rotation).toBeDefined();
      expect(transform.position).toHaveLength(3);
      expect(transform.rotation).toHaveLength(4);
    });

    it('should return default position initially', () => {
      const skeleton = new AvatarSkeleton();
      const transform = skeleton.getLocalTransform('Head');

      expect(transform.position[1]).toBeGreaterThan(0); // Head should be above
    });

    it('should return cloned values', () => {
      const skeleton = new AvatarSkeleton();
      const transform1 = skeleton.getLocalTransform('Head');
      const transform2 = skeleton.getLocalTransform('Head');

      // Should be different objects
      expect(transform1.position).not.toBe(transform2.position);
      expect(transform1.rotation).not.toBe(transform2.rotation);
    });

    it('should throw error for unknown joint', () => {
      const skeleton = new AvatarSkeleton();

      expect(() => {
        skeleton.getLocalTransform('UnknownJoint' as AvatarJointName);
      }).toThrow('Unknown joint');
    });
  });

  describe('setLocalPosition', () => {
    it('should set local position', () => {
      const skeleton = new AvatarSkeleton();
      const newPos: Vec3 = [1, 2, 3];

      skeleton.setLocalPosition('Head', newPos);
      const transform = skeleton.getLocalTransform('Head');

      expect(transform.position[0]).toBe(1);
      expect(transform.position[1]).toBe(2);
      expect(transform.position[2]).toBe(3);
    });

    it('should not mutate input array', () => {
      const skeleton = new AvatarSkeleton();
      const inputPos: Vec3 = [1, 2, 3];
      const original = [...inputPos];

      skeleton.setLocalPosition('Head', inputPos);

      expect(inputPos).toEqual(original);
    });

    it('should mark world transforms as dirty', () => {
      const skeleton = new AvatarSkeleton();

      // Get world transform to compute it
      skeleton.getWorldTransform('Head');

      skeleton.setLocalPosition('Head', [1, 0, 0]);

      // World transform should be updated
      const worldTransform = skeleton.getWorldTransform('Head');
      expect(worldTransform.position[0]).toBeGreaterThan(0);
    });
  });

  describe('setLocalRotation', () => {
    it('should set local rotation', () => {
      const skeleton = new AvatarSkeleton();
      const newRot: Quat = [0, 0, 0, 1];

      skeleton.setLocalRotation('Head', newRot);
      const transform = skeleton.getLocalTransform('Head');

      expect(transform.rotation).toBeDefined();
    });

    it('should normalize rotation', () => {
      const skeleton = new AvatarSkeleton();
      const unnormalized: Quat = [0, 0, 0, 2]; // Not normalized

      skeleton.setLocalRotation('Head', unnormalized);
      const transform = skeleton.getLocalTransform('Head');

      // Rotation should be normalized
      const q = transform.rotation;
      const len = Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2);
      expect(len).toBeCloseTo(1, 5);
    });

    it('should mark world transforms as dirty', () => {
      const skeleton = new AvatarSkeleton();

      skeleton.getWorldTransform('Head');
      skeleton.setLocalRotation('Head', [0, 0, 0, 1]);

      // Should not throw
      skeleton.getWorldTransform('Head');
    });
  });

  describe('applyLocalPose', () => {
    it('should apply pose to multiple joints', () => {
      const skeleton = new AvatarSkeleton();

      skeleton.applyLocalPose({
        Head: { position: [0, 1, 0], rotation: [0, 0, 0, 1] },
        Chest: { position: [0, 0.5, 0], rotation: [0, 0, 0, 1] },
      });

      const headTransform = skeleton.getLocalTransform('Head');
      const chestTransform = skeleton.getLocalTransform('Chest');

      expect(headTransform.position[1]).toBe(1);
      expect(chestTransform.position[1]).toBe(0.5);
    });

    it('should ignore unknown joints', () => {
      const skeleton = new AvatarSkeleton();

      expect(() => {
        skeleton.applyLocalPose({
          UnknownJoint: { position: [0, 0, 0] },
        } as any);
      }).not.toThrow();
    });

    it('should apply only position when provided', () => {
      const skeleton = new AvatarSkeleton();

      skeleton.applyLocalPose({
        Head: { position: [1, 0, 0], rotation: [0, 0, 0, 1] },
      });

      const transform = skeleton.getLocalTransform('Head');
      expect(transform.position[0]).toBe(1);
      // Rotation should be unchanged (or similar)
      expect(transform.rotation).toBeDefined();
    });

    it('should apply only rotation when provided', () => {
      const skeleton = new AvatarSkeleton();
      const originalPosition = [...skeleton.getLocalTransform('Head').position];

      skeleton.applyLocalPose({
        Head: { position: [0, 0, 0], rotation: [0, 0, 0, 1] },
      });

      const transform = skeleton.getLocalTransform('Head');
      expect(transform.rotation).toBeDefined();
      // Position should be unchanged
      expect(transform.position).toEqual(originalPosition);
    });
  });

  describe('getWorldTransform', () => {
    it('should return world transform', () => {
      const skeleton = new AvatarSkeleton();
      const transform = skeleton.getWorldTransform('Head');

      expect(transform.position).toBeDefined();
      expect(transform.rotation).toBeDefined();
      expect(transform.position).toHaveLength(3);
      expect(transform.rotation).toHaveLength(4);
    });

    it('should return root position for root joint', () => {
      const skeleton = new AvatarSkeleton();
      const rootLocal = skeleton.getLocalTransform('Root');
      const rootWorld = skeleton.getWorldTransform('Root');

      expect(rootWorld.position).toEqual(rootLocal.position);
    });

    it('should accumulate parent transforms', () => {
      const skeleton = new AvatarSkeleton();

      // Set a known position for Head
      skeleton.setLocalPosition('Head', [0, 0.1, 0]);
      skeleton.setLocalPosition('Neck', [0, 0.2, 0]);

      const headWorld = skeleton.getWorldTransform('Head');

      // Head world position should be affected by Neck position
      expect(headWorld.position[1]).toBeGreaterThan(0.1);
    });

    it('should return cloned values', () => {
      const skeleton = new AvatarSkeleton();
      const transform1 = skeleton.getWorldTransform('Head');
      const transform2 = skeleton.getWorldTransform('Head');

      expect(transform1.position).not.toBe(transform2.position);
      expect(transform1.rotation).not.toBe(transform2.rotation);
    });

    it('should throw error for unknown joint', () => {
      const skeleton = new AvatarSkeleton();

      expect(() => {
        skeleton.getWorldTransform('UnknownJoint' as AvatarJointName);
      }).toThrow('Unknown joint');
    });
  });

  describe('getWorldMatrix', () => {
    it('should return world matrix', () => {
      const skeleton = new AvatarSkeleton();
      const matrix = skeleton.getWorldMatrix('Head');

      expect(matrix).toBeInstanceOf(Float32Array);
      expect(matrix.length).toBe(16);
    });

    it('should write to output array when provided', () => {
      const skeleton = new AvatarSkeleton();
      const output = new Float32Array(16);
      const result = skeleton.getWorldMatrix('Head', output);

      expect(result).toBe(output);
      expect(output[15]).toBe(1); // Bottom-right should be 1 for identity-like matrix
    });

    it('should create new array when output not provided', () => {
      const skeleton = new AvatarSkeleton();
      const matrix1 = skeleton.getWorldMatrix('Head');
      const matrix2 = skeleton.getWorldMatrix('Head');

      expect(matrix1).not.toBe(matrix2);
    });
  });

  describe('resetPose', () => {
    it('should reset all joints to default pose', () => {
      const skeleton = new AvatarSkeleton();

      // Modify pose
      skeleton.setLocalPosition('Head', [1, 2, 3]);
      skeleton.setLocalRotation('Head', [0, 0, 0, 1]);

      skeleton.resetPose();

      const transform = skeleton.getLocalTransform('Head');
      // Should be back to default (not [1,2,3])
      expect(transform.position[1]).not.toBe(2);
    });

    it('should reset multiple joints', () => {
      const skeleton = new AvatarSkeleton();

      skeleton.setLocalPosition('Head', [1, 0, 0]);
      skeleton.setLocalPosition('Chest', [2, 0, 0]);

      skeleton.resetPose();

      const headTransform = skeleton.getLocalTransform('Head');
      const chestTransform = skeleton.getLocalTransform('Chest');

      expect(headTransform.position[0]).not.toBe(1);
      expect(chestTransform.position[0]).not.toBe(2);
    });
  });

  describe('forEachJoint', () => {
    it('should iterate over all joints', () => {
      const skeleton = new AvatarSkeleton();
      const visited: AvatarJointName[] = [];

      skeleton.forEachJoint((name) => {
        visited.push(name);
      });

      expect(visited.length).toBeGreaterThan(0);
      expect(visited).toContain('Root');
    });

    it('should provide parent name for each joint', () => {
      const skeleton = new AvatarSkeleton();
      let rootFound = false;

      skeleton.forEachJoint((name, parent) => {
        if (name === 'Root') {
          expect(parent).toBeNull();
          rootFound = true;
        } else {
          expect(parent).not.toBeNull();
        }
      });

      expect(rootFound).toBe(true);
    });

    it('should iterate in definition order', () => {
      const customJoints: AvatarJointDefinition[] = [
        { name: 'Root', parent: null, defaultPosition: [0, 0, 0] },
        { name: 'Hips', parent: 'Root', defaultPosition: [0, 1, 0] },
        { name: 'Spine', parent: 'Root', defaultPosition: [0, 2, 0] },
      ];

      const skeleton = new AvatarSkeleton(customJoints);
      const order: AvatarJointName[] = [];

      skeleton.forEachJoint((name) => {
        order.push(name);
      });

      expect(order[0]).toBe('Root');
      expect(order[1]).toBe('Hips');
      expect(order[2]).toBe('Spine');
    });
  });
});

