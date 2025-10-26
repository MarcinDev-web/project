import { describe, it, expect } from 'vitest';
import {
  computeEntityPath,
  resolveEntityByPath,
  serializeScene,
  hydrateScene,
} from './HistoryHelpers';
import { Scene } from '@engine/world';
import { Entity } from '@engine/world';

describe('HistoryHelpers', () => {
  it('computes and resolves entity paths', () => {
    const scene = new Scene('Test');
    const root = new Entity('Root');
    const childA = new Entity('ChildA');
    const childB = new Entity('ChildB');
    const grandChild = new Entity('GrandChild');

    childB.addChild(grandChild);
    root.addChild(childA);
    root.addChild(childB);
    scene.addEntity(root);

    const path = computeEntityPath(scene, grandChild);
    expect(path).toEqual([0, 1, 0]);

    const resolved = resolveEntityByPath(scene, path);
    expect(resolved).toBe(grandChild);
  });

  it('hydrates scene from serialized JSON', () => {
    const scene = new Scene('Original');
    const a = new Entity('A');
    const b = new Entity('B');
    scene.addEntity(a);
    scene.addEntity(b);

    const json = serializeScene(scene);
    const target = new Scene('Target');
    hydrateScene(target, json);

    expect(target.rootEntities).toHaveLength(2);
    expect(target.rootEntities[0]?.name).toBe('A');
    expect(target.rootEntities[1]?.name).toBe('B');
  });
});
