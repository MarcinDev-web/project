import { describe, it, expect, vi } from 'vitest';
import { Scene } from '../scene/Scene';
import { Entity } from '../scene/Entity';
import { MeshComponent } from '../scene/components/MeshComponent';
import { MaterialComponent } from '../scene/components/MaterialComponent';

describe('Scene', () => {
  describe('construction', () => {
    it('creates scene with default name', () => {
      const scene = new Scene();
      expect(scene.name).toBe('Scene');
    });

    it('creates scene with custom name', () => {
      const scene = new Scene('MyScene');
      expect(scene.name).toBe('MyScene');
    });

    it('starts with no entities', () => {
      const scene = new Scene();
      expect(scene.entityCount).toBe(0);
      expect(scene.rootEntities).toHaveLength(0);
    });
  });

  describe('adding entities', () => {
    it('adds root entity', () => {
      const scene = new Scene();
      const entity = new Entity('TestEntity');

      scene.addEntity(entity);

      expect(scene.entityCount).toBe(1);
      expect(scene.rootEntities).toHaveLength(1);
      expect(scene.rootEntities[0]).toBe(entity);
    });

    it('counts nested entities', () => {
      const scene = new Scene();
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      parent.addChild(child);

      scene.addEntity(parent);

      expect(scene.entityCount).toBe(2);
      expect(scene.rootEntities).toHaveLength(1);
    });

    it('prevents adding duplicate entity', () => {
      const scene = new Scene();
      const entity = new Entity('TestEntity');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      scene.addEntity(entity);
      scene.addEntity(entity);

      expect(scene.entityCount).toBe(1);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('removing entities', () => {
    it('removes root entity', () => {
      const scene = new Scene();
      const entity = new Entity('TestEntity');
      scene.addEntity(entity);

      const removed = scene.removeEntity(entity);

      expect(removed).toBe(true);
      expect(scene.entityCount).toBe(0);
    });

    it('removes entity by ID', () => {
      const scene = new Scene();
      const entity = new Entity('TestEntity');
      scene.addEntity(entity);

      const removed = scene.removeEntityById(entity.id);

      expect(removed).toBe(true);
      expect(scene.entityCount).toBe(0);
    });

    it('returns false when removing non-existent entity', () => {
      const scene = new Scene();
      const entity = new Entity('TestEntity');

      const removed = scene.removeEntity(entity);

      expect(removed).toBe(false);
    });

    it('removes nested entity by ID', () => {
      const scene = new Scene();
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      parent.addChild(child);
      scene.addEntity(parent);

      const removed = scene.removeEntityById(child.id);

      expect(removed).toBe(true);
      expect(scene.entityCount).toBe(1); // Only parent remains
      expect(parent.children).toHaveLength(0);
    });
  });

  describe('finding entities', () => {
    it('finds entity by ID', () => {
      const scene = new Scene();
      const entity = new Entity('TestEntity');
      scene.addEntity(entity);

      const found = scene.findEntityById(entity.id);

      expect(found).toBe(entity);
    });

    it('finds nested entity by ID', () => {
      const scene = new Scene();
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      parent.addChild(child);
      scene.addEntity(parent);

      const found = scene.findEntityById(child.id);

      expect(found).toBe(child);
    });

    it('returns null for non-existent ID', () => {
      const scene = new Scene();
      const found = scene.findEntityById('nonexistent');
      expect(found).toBeNull();
    });

    it('finds entities by name', () => {
      const scene = new Scene();
      const entity1 = new Entity('Cube');
      const entity2 = new Entity('Cube');
      const entity3 = new Entity('Sphere');

      scene.addEntity(entity1);
      scene.addEntity(entity2);
      scene.addEntity(entity3);

      const found = scene.findEntitiesByName('Cube');

      expect(found).toHaveLength(2);
      expect(found).toContain(entity1);
      expect(found).toContain(entity2);
    });
  });

  describe('getting entities', () => {
    it('gets all entities', () => {
      const scene = new Scene();
      const entity1 = new Entity('Entity1');
      const entity2 = new Entity('Entity2');
      const child = new Entity('Child');
      entity1.addChild(child);

      scene.addEntity(entity1);
      scene.addEntity(entity2);

      const all = scene.getAllEntities();

      expect(all).toHaveLength(3);
      expect(all).toContain(entity1);
      expect(all).toContain(entity2);
      expect(all).toContain(child);
    });

    it('gets only active entities', () => {
      const scene = new Scene();
      const active = new Entity('Active');
      const inactive = new Entity('Inactive');
      inactive.active = false;

      scene.addEntity(active);
      scene.addEntity(inactive);

      const activeEntities = scene.getActiveEntities();

      expect(activeEntities).toHaveLength(1);
      expect(activeEntities[0]).toBe(active);
    });

    it('queries entities by components using index', () => {
      const scene = new Scene();
      const e1 = new Entity('E1');
      const e2 = new Entity('E2');
      const e3 = new Entity('E3');

      // e1: Mesh + Material
      e1.meshType = 'cube';
      e1.color = [1, 1, 1, 1];
      // e2: Mesh only
      e2.meshType = 'sphere';
      // e3: Material only
      e3.color = [0.5, 0.5, 0.5, 1];

      scene.addEntity(e1);
      scene.addEntity(e2);
      scene.addEntity(e3);

      const withMesh = scene.queryEntities(MeshComponent);
      expect(withMesh).toHaveLength(2);
      expect(withMesh).toContain(e1);
      expect(withMesh).toContain(e2);

      const withMaterial = scene.queryEntities(MaterialComponent);
      expect(withMaterial).toHaveLength(2);
      expect(withMaterial).toContain(e1);
      expect(withMaterial).toContain(e3);

      const withBoth = scene.queryEntities(MeshComponent, MaterialComponent);
      expect(withBoth).toHaveLength(1);
      expect(withBoth[0]).toBe(e1);

      const none = scene.queryEntities();
      expect(none).toHaveLength(3);
    });
  });

  describe('traversal', () => {
    it('traverses all entities', () => {
      const scene = new Scene();
      const root1 = new Entity('Root1');
      const root2 = new Entity('Root2');
      const child = new Entity('Child');
      root1.addChild(child);

      scene.addEntity(root1);
      scene.addEntity(root2);

      const visited: string[] = [];
      scene.traverse((entity) => {
        visited.push(entity.name);
      });

      expect(visited).toEqual(['Root1', 'Child', 'Root2']);
    });
  });

  describe('clear', () => {
    it('clears all entities', () => {
      const scene = new Scene();
      scene.addEntity(new Entity('Entity1'));
      scene.addEntity(new Entity('Entity2'));

      scene.clear();

      expect(scene.entityCount).toBe(0);
      expect(scene.rootEntities).toHaveLength(0);
    });
  });

  describe('serialization', () => {
    it('serializes to JSON', () => {
      const scene = new Scene('TestScene');
      const entity = new Entity('TestEntity');
      entity.transform.position = [1, 2, 3];
      scene.addEntity(entity);

      const json = scene.toJSON();

      expect(json.name).toBe('TestScene');
      expect(json.entities).toHaveLength(1);
      const e0 = json.entities[0]!;
      expect(e0.name).toBe('TestEntity');
      expect(e0.transform.position).toEqual([1, 2, 3]);
    });

    it('deserializes from JSON', () => {
      const data = {
        name: 'TestScene',
        entities: [
          {
            id: 'entity_0',
            name: 'TestEntity',
            active: true,
            meshType: 'cube' as const,
            color: [1, 1, 1, 1] as [number, number, number, number],
            transform: {
              position: [1, 2, 3] as [number, number, number],
              rotation: [0, 0, 0, 1] as [number, number, number, number],
              scale: [1, 1, 1] as [number, number, number],
            },
            userData: {},
            children: [],
          },
        ],
      };

      const scene = Scene.fromJSON(data);

      expect(scene.name).toBe('TestScene');
      expect(scene.entityCount).toBe(1);
      // Find by name since ID changes on creation
      const entities = scene.findEntitiesByName('TestEntity');
      expect(entities).toHaveLength(1);
      expect(entities[0]?.name).toBe('TestEntity');
    });

    it('exports as JSON string', () => {
      const scene = new Scene('TestScene');
      scene.addEntity(new Entity('TestEntity'));

      const json = scene.export();

      expect(typeof json).toBe('string');
      expect(json).toContain('TestScene');
      expect(json).toContain('TestEntity');
    });

    it('imports from JSON string', () => {
      const json = JSON.stringify({
        name: 'ImportedScene',
        entities: [
          {
            id: 'entity_0',
            name: 'ImportedEntity',
            active: true,
            meshType: 'cube',
            color: [1, 1, 1, 1],
            transform: {
              position: [0, 0, 0],
              rotation: [0, 0, 0, 1],
              scale: [1, 1, 1],
            },
            userData: {},
            children: [],
          },
        ],
      });

      const scene = Scene.import(json);

      expect(scene.name).toBe('ImportedScene');
      expect(scene.entityCount).toBe(1);
    });

    it('throws on invalid import', () => {
      expect(() => Scene.import('invalid json')).toThrow();
    });
  });
});
