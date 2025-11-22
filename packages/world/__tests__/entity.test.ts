import { describe, it, expect } from 'vitest';
import { Entity } from '@engine/world';
import { Transform } from '@engine/world';

describe('Entity', () => {
  describe('construction', () => {
    it('creates entity with default name', () => {
      const entity = new Entity();
      expect(entity.name).toBe('Entity');
      expect(entity.id).toBeTruthy();
    });

    it('creates entity with custom name', () => {
      const entity = new Entity('MyEntity');
      expect(entity.name).toBe('MyEntity');
    });

    it('has unique IDs', () => {
      const e1 = new Entity();
      const e2 = new Entity();
      expect(e1.id).not.toBe(e2.id);
    });

    it('has transform by default', () => {
      const entity = new Entity();
      expect(entity.transform).toBeInstanceOf(Transform);
    });

    it('accepts custom transform', () => {
      const transform = new Transform([1, 2, 3]);
      const entity = new Entity('Test', transform);
      expect(entity.transform.position).toEqual([1, 2, 3]);
    });
  });

  describe('properties', () => {
    it('starts active', () => {
      const entity = new Entity();
      expect(entity.active).toBe(true);
    });

    it('can be deactivated', () => {
      const entity = new Entity();
      entity.active = false;
      expect(entity.active).toBe(false);
    });

    it('has default color', () => {
      const entity = new Entity();
      expect(entity.color).toEqual([1, 1, 1, 1]);
    });

    it('has mesh type', () => {
      const entity = new Entity();
      expect(entity.meshType).toBe('none');
    });

    it('has empty userData', () => {
      const entity = new Entity();
      expect(entity.userData).toEqual({});
    });
  });

  describe('hierarchy', () => {
    it('starts with no parent', () => {
      const entity = new Entity();
      expect(entity.parent).toBeNull();
    });

    it('starts with no children', () => {
      const entity = new Entity();
      expect(entity.children).toHaveLength(0);
    });

    it('adds child correctly', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');

      parent.addChild(child);

      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]!).toBe(child);
      expect(child.parent).toBe(parent);
    });

    it('removes child from previous parent when adding', () => {
      const parent1 = new Entity('Parent1');
      const parent2 = new Entity('Parent2');
      const child = new Entity('Child');

      parent1.addChild(child);
      parent2.addChild(child);

      expect(parent1.children).toHaveLength(0);
      expect(parent2.children).toHaveLength(1);
      expect(child.parent).toBe(parent2);
    });

    it('removes child correctly', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');

      parent.addChild(child);
      const removed = parent.removeChild(child);

      expect(removed).toBe(true);
      expect(parent.children).toHaveLength(0);
      expect(child.parent).toBeNull();
    });

    it('returns false when removing non-child', () => {
      const parent = new Entity('Parent');
      const notChild = new Entity('NotChild');

      const removed = parent.removeChild(notChild);

      expect(removed).toBe(false);
    });

    it('removes from parent', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');

      parent.addChild(child);
      const removed = child.removeFromParent();

      expect(removed).toBe(true);
      expect(child.parent).toBeNull();
      expect(parent.children).toHaveLength(0);
    });

    it('links transform hierarchy', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');

      parent.addChild(child);

      expect(child.transform.parent).toBe(parent.transform);
    });
  });

  describe('search', () => {
    it('finds child by ID', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      parent.addChild(child);

      const found = parent.findChildById(child.id);
      expect(found).toBe(child);
    });

    it('finds child by name', () => {
      const parent = new Entity('Parent');
      const child = new Entity('SpecialChild');
      parent.addChild(child);

      const found = parent.findChildByName('SpecialChild');
      expect(found).toBe(child);
    });

    it('finds nested children', () => {
      const grandparent = new Entity('Grandparent');
      const parent = new Entity('Parent');
      const child = new Entity('Child');

      grandparent.addChild(parent);
      parent.addChild(child);

      const found = grandparent.findChildById(child.id);
      expect(found).toBe(child);
    });

    it('returns null when not found', () => {
      const entity = new Entity();
      const found = entity.findChildById('nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('traversal', () => {
    it('gets all descendants', () => {
      const root = new Entity('Root');
      const child1 = new Entity('Child1');
      const child2 = new Entity('Child2');
      const grandchild = new Entity('Grandchild');

      root.addChild(child1);
      root.addChild(child2);
      child1.addChild(grandchild);

      const descendants = root.getDescendants();
      expect(descendants).toHaveLength(3);
      expect(descendants).toContain(child1);
      expect(descendants).toContain(child2);
      expect(descendants).toContain(grandchild);
    });

    it('traverses tree with callback', () => {
      const root = new Entity('Root');
      const child = new Entity('Child');
      root.addChild(child);

      const visited: string[] = [];
      root.traverse((entity) => {
        visited.push(entity.name);
      });

      expect(visited).toEqual(['Root', 'Child']);
    });

    it('stops traversal when callback returns false', () => {
      const root = new Entity('Root');
      const child = new Entity('Child');
      root.addChild(child);

      const visited: string[] = [];
      root.traverse((entity) => {
        visited.push(entity.name);
        return false; // Stop after root
      });

      expect(visited).toEqual(['Root']);
    });

    it('checks if entity is descendant of another', () => {
      const grandparent = new Entity('Grandparent');
      const parent = new Entity('Parent');
      const child = new Entity('Child');

      grandparent.addChild(parent);
      parent.addChild(child);

      expect(child.isDescendantOf(parent)).toBe(true);
      expect(child.isDescendantOf(grandparent)).toBe(true);
      expect(parent.isDescendantOf(child)).toBe(false);
    });
  });

  describe('cloning', () => {
    it('clones entity (shallow)', () => {
      const original = new Entity('Original');
      original.color = [1, 0, 0, 1];
      original.meshType = 'cube';
      original.userData.customProp = 'test';

      const clone = original.clone();

      expect(clone.name).toBe('Original');
      expect(clone.color).toEqual([1, 0, 0, 1]);
      expect(clone.meshType).toBe('cube');
      expect(clone.userData.customProp).toBe('test');
      expect(clone.id).not.toBe(original.id);
    });

    it('deep clones with children', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      parent.addChild(child);

      const clone = parent.deepClone();

      expect(clone.children).toHaveLength(1);
      expect(clone.children[0]!.name).toBe('Child');
      expect(clone.children[0]!.id).not.toBe(child.id);
    });
  });

  describe('serialization', () => {
    it('serializes to JSON', () => {
      const entity = new Entity('TestEntity');
      entity.color = [1, 0, 0, 1];
      entity.transform.position = [1, 2, 3];

      const json = entity.toJSON();

      expect(json.name).toBe('TestEntity');
      expect(json.color).toEqual([1, 0, 0, 1]);
      expect(json.transform.position).toEqual([1, 2, 3]);
    });

    it('serializes with children', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      parent.addChild(child);

      const json = parent.toJSON();

      expect(json.children).toHaveLength(1);
      expect(json.children[0]!.name).toBe('Child');
    });

    it('deserializes from JSON', () => {
      const data = {
        id: 'test_id',
        name: 'TestEntity',
        active: true,
        meshType: 'cube' as const,
        color: [1, 0, 0, 1] as [number, number, number, number],
        transform: {
          position: [1, 2, 3] as [number, number, number],
          rotation: [0, 0, 0, 1] as [number, number, number, number],
          scale: [1, 1, 1] as [number, number, number],
        },
        userData: { test: 'value' },
        children: [],
      };

      const entity = Entity.fromJSON(data);

      expect(entity.name).toBe('TestEntity');
      expect(entity.color).toEqual([1, 0, 0, 1]);
      expect(entity.transform.position).toEqual([1, 2, 3]);
      expect(entity.userData.test).toBe('value');
    });

    it('deserializes with children', () => {
      const data = {
        id: 'parent_id',
        name: 'Parent',
        active: true,
        meshType: 'cube' as const,
        color: [1, 1, 1, 1] as [number, number, number, number],
        transform: {
          position: [0, 0, 0] as [number, number, number],
          rotation: [0, 0, 0, 1] as [number, number, number, number],
          scale: [1, 1, 1] as [number, number, number],
        },
        userData: {},
        children: [
          {
            id: 'child_id',
            name: 'Child',
            active: true,
            meshType: 'cube' as const,
            color: [1, 1, 1, 1] as [number, number, number, number],
            transform: {
              position: [0, 0, 0] as [number, number, number],
              rotation: [0, 0, 0, 1] as [number, number, number, number],
              scale: [1, 1, 1] as [number, number, number],
            },
            userData: {},
            children: [],
          },
        ],
      };

      const parent = Entity.fromJSON(data);

      expect(parent.children).toHaveLength(1);
      expect(parent.children[0]!.name).toBe('Child');
      expect(parent.children[0]!.parent).toBe(parent);
    });
  });
});
