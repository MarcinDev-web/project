import { describe, it, expect } from 'vitest';
import { Transform } from '../scene/Transform';

describe('Transform', () => {
  describe('position', () => {
    it('initializes with default position [0, 0, 0]', () => {
      const transform = new Transform();
      expect(transform.position).toEqual([0, 0, 0]);
    });

    it('sets position correctly', () => {
      const transform = new Transform();
      transform.position = [1, 2, 3];
      expect(transform.position).toEqual([1, 2, 3]);
    });

    it('translates position', () => {
      const transform = new Transform([1, 1, 1]);
      transform.translate([2, 3, 4]);
      expect(transform.position).toEqual([3, 4, 5]);
    });

    it('returns a copy, not reference', () => {
      const transform = new Transform([1, 2, 3]);
      const pos = transform.position;
      pos[0] = 999;
      expect(transform.position[0]).toBe(1);
    });
  });

  describe('rotation', () => {
    it('initializes with identity quaternion [0, 0, 0, 1]', () => {
      const transform = new Transform();
      expect(transform.rotation).toEqual([0, 0, 0, 1]);
    });

    it('normalizes rotation quaternion on set', () => {
      const transform = new Transform();
      transform.rotation = [1, 0, 0, 1]; // Not normalized
      const rot = transform.rotation;
      const len = Math.sqrt(rot[0] ** 2 + rot[1] ** 2 + rot[2] ** 2 + rot[3] ** 2);
      expect(len).toBeCloseTo(1, 5);
    });

    it('rotates by axis-angle', () => {
      const transform = new Transform();
      transform.rotate([0, 1, 0], Math.PI / 2); // 90° around Y
      const rot = transform.rotation;
      expect(rot[1]).toBeGreaterThan(0); // Should have Y component
    });

    it('sets Euler angles', () => {
      const transform = new Transform();
      transform.setEulerAngles(Math.PI / 4, 0, 0);
      expect(transform.rotation[0]).toBeGreaterThan(0);
    });
  });

  describe('scale', () => {
    it('initializes with default scale [1, 1, 1]', () => {
      const transform = new Transform();
      expect(transform.scale).toEqual([1, 1, 1]);
    });

    it('sets scale correctly', () => {
      const transform = new Transform();
      transform.scale = [2, 3, 4];
      expect(transform.scale).toEqual([2, 3, 4]);
    });

    it('scales by multiplier', () => {
      const transform = new Transform([0, 0, 0], [0, 0, 0, 1], [2, 2, 2]);
      transform.scaleBy([2, 3, 4]);
      expect(transform.scale).toEqual([4, 6, 8]);
    });
  });

  describe('matrices', () => {
    it('computes local matrix', () => {
      const transform = new Transform([1, 2, 3]);
      const matrix = transform.getLocalMatrix();
      expect(matrix).toBeInstanceOf(Float32Array);
      expect(matrix.length).toBe(16);
      // Translation should be in last column
      expect(matrix[12]).toBe(1);
      expect(matrix[13]).toBe(2);
      expect(matrix[14]).toBe(3);
    });

    it('world matrix equals local matrix when no parent', () => {
      const transform = new Transform([1, 2, 3]);
      const local = transform.getLocalMatrix();
      const world = transform.getWorldMatrix();
      expect(world).toEqual(local);
    });

    it('world position is extracted correctly', () => {
      const transform = new Transform([5, 10, 15]);
      const worldPos = transform.getWorldPosition();
      expect(worldPos).toEqual([5, 10, 15]);
    });
  });

  describe('hierarchy', () => {
    it('applies parent transformation to world matrix', () => {
      const parent = new Transform([10, 0, 0]);
      const child = new Transform([5, 0, 0]);
      child.parent = parent;

      const worldPos = child.getWorldPosition();
      // Child should be offset by parent position
      expect(worldPos[0]).toBeGreaterThan(5);
    });

    it('world matrix includes parent position', () => {
      const parent = new Transform([10, 0, 0]);
      const child = new Transform([5, 0, 0]);
      child.parent = parent;

      const worldPos = child.getWorldPosition();

      // Child's world position should include parent offset
      expect(worldPos[0]).toBeGreaterThanOrEqual(10);
    });

    it('propagates world-dirty to descendants when ancestor changes', () => {
      const grandparent = new Transform([1, 0, 0]);
      const parent = new Transform([2, 0, 0]);
      const child = new Transform([3, 0, 0]);

      parent.parent = grandparent;
      child.parent = parent;

      // Prime caches
      const initialChildWorld = child.getWorldPosition();
      expect(initialChildWorld).toEqual([6, 0, 0]);

      // Change ancestor
      grandparent.position = [10, 0, 0];

      // Child world should update (10 + 2 + 3 = 15)
      const updatedChildWorld = child.getWorldPosition();
      expect(updatedChildWorld).toEqual([15, 0, 0]);
    });
  });

  describe('serialization', () => {
    it('serializes to JSON', () => {
      const transform = new Transform([1, 2, 3], [0, 0, 0, 1], [2, 2, 2]);
      const json = transform.toJSON();

      expect(json.position).toEqual([1, 2, 3]);
      expect(json.rotation).toEqual([0, 0, 0, 1]);
      expect(json.scale).toEqual([2, 2, 2]);
    });

    it('deserializes from JSON', () => {
      const data = {
        position: [1, 2, 3] as [number, number, number],
        rotation: [0, 0, 0, 1] as [number, number, number, number],
        scale: [2, 2, 2] as [number, number, number],
      };
      const transform = Transform.fromJSON(data);

      expect(transform.position).toEqual([1, 2, 3]);
      expect(transform.scale).toEqual([2, 2, 2]);
    });

    it('clones correctly', () => {
      const original = new Transform([1, 2, 3], [0, 0, 0, 1], [2, 2, 2]);
      const clone = original.clone();

      expect(clone.position).toEqual(original.position);
      expect(clone.rotation).toEqual(original.rotation);
      expect(clone.scale).toEqual(original.scale);

      // Ensure it's a deep copy
      clone.position = [9, 9, 9];
      expect(original.position).not.toEqual([9, 9, 9]);
    });
  });
});
