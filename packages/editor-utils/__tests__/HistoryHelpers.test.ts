import { describe, it, expect, beforeEach } from 'vitest';
import { Scene, Entity } from '@engine/world';
import {
  computeEntityPath,
  resolveEntityByPath,
  serializeScene,
  hydrateScene,
} from '../src/HistoryHelpers';

describe('HistoryHelpers', () => {
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene();
  });

  describe('computeEntityPath', () => {
    it('should return null for null entity', () => {
      const path = computeEntityPath(scene, null);
      expect(path).toBeNull();
    });

    it('should compute path for root entity', () => {
      const entity = new Entity('Root Entity');
      scene.addEntity(entity);

      const path = computeEntityPath(scene, entity);
      expect(path).toEqual([0]);
    });

    it('should compute path for nested entity', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      const grandchild = new Entity('Grandchild');

      scene.addEntity(parent);
      parent.addChild(child);
      child.addChild(grandchild);

      const path = computeEntityPath(scene, grandchild);
      expect(path).toEqual([0, 0, 0]);
    });

    it('should compute path for second root entity', () => {
      const entity1 = new Entity('Entity 1');
      const entity2 = new Entity('Entity 2');

      scene.addEntity(entity1);
      scene.addEntity(entity2);

      const path = computeEntityPath(scene, entity2);
      expect(path).toEqual([1]);
    });

    it('should compute path for sibling entities', () => {
      const parent = new Entity('Parent');
      const child1 = new Entity('Child 1');
      const child2 = new Entity('Child 2');
      const child3 = new Entity('Child 3');

      scene.addEntity(parent);
      parent.addChild(child1);
      parent.addChild(child2);
      parent.addChild(child3);

      const path = computeEntityPath(scene, child2);
      expect(path).toEqual([0, 1]);
    });

    it('should return null for entity not in scene', () => {
      const orphan = new Entity('Orphan');

      const path = computeEntityPath(scene, orphan);
      expect(path).toBeNull();
    });

    it('should handle complex hierarchy', () => {
      const root = new Entity('Root');
      const branch1 = new Entity('Branch 1');
      const branch2 = new Entity('Branch 2');
      const leaf1 = new Entity('Leaf 1');
      const leaf2 = new Entity('Leaf 2');
      const deepLeaf = new Entity('Deep Leaf');

      scene.addEntity(root);
      root.addChild(branch1);
      root.addChild(branch2);
      branch1.addChild(leaf1);
      branch2.addChild(leaf2);
      leaf2.addChild(deepLeaf);

      const path = computeEntityPath(scene, deepLeaf);
      expect(path).toEqual([0, 1, 0, 0]);
    });

    it('should handle multiple root entities with complex hierarchies', () => {
      const root1 = new Entity('Root 1');
      const root2 = new Entity('Root 2');
      const child1 = new Entity('Child 1');
      const child2 = new Entity('Child 2');

      scene.addEntity(root1);
      scene.addEntity(root2);
      root2.addChild(child1);
      child1.addChild(child2);

      const path = computeEntityPath(scene, child2);
      expect(path).toEqual([1, 0, 0]);
    });
  });

  describe('resolveEntityByPath', () => {
    let root: Entity;
    let child: Entity;
    let grandchild: Entity;

    beforeEach(() => {
      root = new Entity('Root');
      child = new Entity('Child');
      grandchild = new Entity('Grandchild');

      scene.addEntity(root);
      root.addChild(child);
      child.addChild(grandchild);
    });

    it('should return null for null path', () => {
      const entity = resolveEntityByPath(scene, null);
      expect(entity).toBeNull();
    });

    it('should return null for empty path', () => {
      const entity = resolveEntityByPath(scene, []);
      expect(entity).toBeNull();
    });

    it('should resolve root entity', () => {
      const entity = resolveEntityByPath(scene, [0]);
      expect(entity).toBe(root);
      expect(entity?.name).toBe('Root');
    });

    it('should resolve nested entity', () => {
      const entity = resolveEntityByPath(scene, [0, 0]);
      expect(entity).toBe(child);
      expect(entity?.name).toBe('Child');
    });

    it('should resolve deeply nested entity', () => {
      const entity = resolveEntityByPath(scene, [0, 0, 0]);
      expect(entity).toBe(grandchild);
      expect(entity?.name).toBe('Grandchild');
    });

    it('should return null for invalid path', () => {
      const entity = resolveEntityByPath(scene, [999]);
      expect(entity).toBeNull();
    });

    it('should return null for partially invalid path', () => {
      const entity = resolveEntityByPath(scene, [0, 999]);
      expect(entity).toBeNull();
    });

    it('should handle multiple root entities', () => {
      const root2 = new Entity('Root 2');
      scene.addEntity(root2);

      const entity = resolveEntityByPath(scene, [1]);
      expect(entity).toBe(root2);
      expect(entity?.name).toBe('Root 2');
    });

    it('should handle path to sibling', () => {
      const sibling = new Entity('Sibling');
      root.addChild(sibling);

      const entity = resolveEntityByPath(scene, [0, 1]);
      expect(entity).toBe(sibling);
      expect(entity?.name).toBe('Sibling');
    });
  });

  describe('computeEntityPath + resolveEntityByPath roundtrip', () => {
    it('should roundtrip for root entity', () => {
      const entity = new Entity('Test Entity');
      scene.addEntity(entity);

      const path = computeEntityPath(scene, entity);
      const resolved = resolveEntityByPath(scene, path);

      expect(resolved).toBe(entity);
    });

    it('should roundtrip for nested entity', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      const grandchild = new Entity('Grandchild');

      scene.addEntity(parent);
      parent.addChild(child);
      child.addChild(grandchild);

      const path = computeEntityPath(scene, grandchild);
      const resolved = resolveEntityByPath(scene, path);

      expect(resolved).toBe(grandchild);
    });

    it('should roundtrip for complex hierarchy', () => {
      const entities: Entity[] = [];

      for (let i = 0; i < 3; i++) {
        const root = new Entity(`Root ${i}`);
        scene.addEntity(root);
        entities.push(root);

        for (let j = 0; j < 2; j++) {
          const child = new Entity(`Root ${i} - Child ${j}`);
          root.addChild(child);
          entities.push(child);
        }
      }

      // Test all entities
      for (const entity of entities) {
        const path = computeEntityPath(scene, entity);
        const resolved = resolveEntityByPath(scene, path);
        expect(resolved).toBe(entity);
      }
    });
  });

  describe('serializeScene', () => {
    it('should serialize empty scene', () => {
      const json = serializeScene(scene);

      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should serialize scene with entities', () => {
      const entity = new Entity('Test Entity');
      scene.addEntity(entity);

      const json = serializeScene(scene);

      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('entities');
    });

    it('should serialize nested entities', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');

      scene.addEntity(parent);
      parent.addChild(child);

      const json = serializeScene(scene);

      expect(json).toBeDefined();
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should produce valid JSON', () => {
      const entity1 = new Entity('Entity 1');
      const entity2 = new Entity('Entity 2');

      scene.addEntity(entity1);
      scene.addEntity(entity2);

      const json = serializeScene(scene);
      const parsed = JSON.parse(json);

      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');
    });
  });

  describe('hydrateScene', () => {
    it('should hydrate empty scene', () => {
      const json = serializeScene(scene);
      const newScene = new Scene();

      hydrateScene(newScene, json);

      expect(newScene.rootEntities.length).toBe(0);
    });

    it('should hydrate scene with entities', () => {
      const entity = new Entity('Test Entity');
      scene.addEntity(entity);

      const json = serializeScene(scene);
      const newScene = new Scene();

      hydrateScene(newScene, json);

      expect(newScene.rootEntities.length).toBe(1);
      expect(newScene.rootEntities[0].name).toBe('Test Entity');
    });

    it('should clear existing scene before hydrating', () => {
      const existingEntity = new Entity('Existing');
      const newEntity = new Entity('New');

      const newScene = new Scene();
      newScene.addEntity(existingEntity);

      scene.addEntity(newEntity);
      const json = serializeScene(scene);

      hydrateScene(newScene, json);

      expect(newScene.rootEntities.length).toBe(1);
      expect(newScene.rootEntities[0].name).toBe('New');
    });

    it('should preserve entity hierarchy', () => {
      const parent = new Entity('Parent');
      const child = new Entity('Child');
      const grandchild = new Entity('Grandchild');

      scene.addEntity(parent);
      parent.addChild(child);
      child.addChild(grandchild);

      const json = serializeScene(scene);
      const newScene = new Scene();

      hydrateScene(newScene, json);

      expect(newScene.rootEntities.length).toBe(1);
      expect(newScene.rootEntities[0].name).toBe('Parent');
      expect(newScene.rootEntities[0].children.length).toBe(1);
      expect(newScene.rootEntities[0].children[0].name).toBe('Child');
      expect(newScene.rootEntities[0].children[0].children.length).toBe(1);
      expect(newScene.rootEntities[0].children[0].children[0].name).toBe('Grandchild');
    });

    it('should handle multiple root entities', () => {
      const entity1 = new Entity('Entity 1');
      const entity2 = new Entity('Entity 2');
      const entity3 = new Entity('Entity 3');

      scene.addEntity(entity1);
      scene.addEntity(entity2);
      scene.addEntity(entity3);

      const json = serializeScene(scene);
      const newScene = new Scene();

      hydrateScene(newScene, json);

      expect(newScene.rootEntities.length).toBe(3);
      expect(newScene.rootEntities[0].name).toBe('Entity 1');
      expect(newScene.rootEntities[1].name).toBe('Entity 2');
      expect(newScene.rootEntities[2].name).toBe('Entity 3');
    });
  });

  describe('serialize + hydrate roundtrip', () => {
    it('should roundtrip empty scene', () => {
      const json = serializeScene(scene);
      const newScene = new Scene();
      hydrateScene(newScene, json);

      const json2 = serializeScene(newScene);
      expect(json).toBe(json2);
    });

    it('should roundtrip scene with entities', () => {
      const entity = new Entity('Test Entity');
      scene.addEntity(entity);

      const json = serializeScene(scene);
      const newScene = new Scene();
      hydrateScene(newScene, json);

      expect(newScene.rootEntities.length).toBe(1);
      expect(newScene.rootEntities[0].name).toBe('Test Entity');
    });

    it('should omit editor preview player from serialization', () => {
      const preview = new Entity('EditorPreviewPlayer', undefined, '__editor_preview_player');
      preview.userData.isEditorPreviewPlayer = true;
      scene.addEntity(preview);
      const regular = new Entity('RegularEntity');
      scene.addEntity(regular);

      const json = serializeScene(scene);
      expect(json).not.toContain('__editor_preview_player');

      const newScene = new Scene();
      hydrateScene(newScene, json);

      expect(newScene.findEntityById('__editor_preview_player')).toBeNull();
      expect(newScene.rootEntities.some((e) => e.name === 'RegularEntity')).toBe(true);
    });

    it('should roundtrip complex scene', () => {
      // Create complex scene structure
      for (let i = 0; i < 3; i++) {
        const root = new Entity(`Root ${i}`);
        scene.addEntity(root);

        for (let j = 0; j < 2; j++) {
          const child = new Entity(`Child ${i}-${j}`);
          root.addChild(child);

          for (let k = 0; k < 2; k++) {
            const grandchild = new Entity(`Grandchild ${i}-${j}-${k}`);
            child.addChild(grandchild);
          }
        }
      }

      const json = serializeScene(scene);
      const newScene = new Scene();
      hydrateScene(newScene, json);

      // Verify structure
      expect(newScene.rootEntities.length).toBe(3);

      for (let i = 0; i < 3; i++) {
        const root = newScene.rootEntities[i];
        expect(root.name).toBe(`Root ${i}`);
        expect(root.children.length).toBe(2);

        for (let j = 0; j < 2; j++) {
          const child = root.children[j];
          expect(child.name).toBe(`Child ${i}-${j}`);
          expect(child.children.length).toBe(2);

          for (let k = 0; k < 2; k++) {
            const grandchild = child.children[k];
            expect(grandchild.name).toBe(`Grandchild ${i}-${j}-${k}`);
          }
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle entity with special characters in name', () => {
      const entity = new Entity('Test "Entity" with <special> & chars');
      scene.addEntity(entity);

      const json = serializeScene(scene);
      const newScene = new Scene();
      hydrateScene(newScene, json);

      expect(newScene.rootEntities[0].name).toBe('Test "Entity" with <special> & chars');
    });

    it('should handle very deep hierarchy', () => {
      let current = new Entity('Root');
      scene.addEntity(current);

      // Create 10 levels deep
      for (let i = 0; i < 10; i++) {
        const child = new Entity(`Level ${i}`);
        current.addChild(child);
        current = child;
      }

      const path = computeEntityPath(scene, current);
      expect(path).toHaveLength(11); // Root + 10 children

      const resolved = resolveEntityByPath(scene, path);
      expect(resolved).toBe(current);
    });

    it('should handle many sibling entities', () => {
      const parent = new Entity('Parent');
      scene.addEntity(parent);

      for (let i = 0; i < 100; i++) {
        const child = new Entity(`Child ${i}`);
        parent.addChild(child);
      }

      const lastChild = parent.children[99];
      const path = computeEntityPath(scene, lastChild);
      expect(path).toEqual([0, 99]);

      const resolved = resolveEntityByPath(scene, path);
      expect(resolved).toBe(lastChild);
    });

    it('should handle empty entity names', () => {
      const entity = new Entity('');
      scene.addEntity(entity);

      const json = serializeScene(scene);
      const newScene = new Scene();
      hydrateScene(newScene, json);

      expect(newScene.rootEntities[0].name).toBe('');
    });
  });
});

