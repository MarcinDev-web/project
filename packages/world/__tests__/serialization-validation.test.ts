import { describe, it, expect } from 'vitest';
import { Transform } from '@engine/world';
import { Entity } from '@engine/world';
import { Scene } from '@engine/world';

describe.skip('Transform.fromJSON validation', () => {
  it('throws on null data', () => {
    expect(() => Transform.fromJSON(null as any)).toThrow(
      'Invalid transform data: must be an object'
    );
  });

  it('throws on undefined data', () => {
    expect(() => Transform.fromJSON(undefined as any)).toThrow(
      'Invalid transform data: must be an object'
    );
  });

  it('throws on missing position', () => {
    expect(() => Transform.fromJSON({ rotation: [0, 0, 0, 1], scale: [1, 1, 1] } as any)).toThrow(
      'Invalid transform data: position must be [x, y, z]'
    );
  });

  it('throws on invalid position length', () => {
    expect(() =>
      Transform.fromJSON({ position: [0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } as any)
    ).toThrow('Invalid transform data: position must be [x, y, z]');
  });

  it('throws on non-finite position values', () => {
    expect(() =>
      Transform.fromJSON({ position: [0, NaN, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] } as any)
    ).toThrow('Invalid transform data: position values must be finite numbers');

    expect(() =>
      Transform.fromJSON({
        position: [0, Infinity, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      } as any)
    ).toThrow('Invalid transform data: position values must be finite numbers');
  });

  it('throws on invalid rotation length', () => {
    expect(() =>
      Transform.fromJSON({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } as any)
    ).toThrow('Invalid transform data: rotation must be [x, y, z, w] quaternion');
  });

  it('throws on non-finite rotation values', () => {
    expect(() =>
      Transform.fromJSON({ position: [0, 0, 0], rotation: [0, 0, NaN, 1], scale: [1, 1, 1] } as any)
    ).toThrow('Invalid transform data: rotation values must be finite numbers');
  });

  it('throws on invalid scale length', () => {
    expect(() =>
      Transform.fromJSON({ position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1] } as any)
    ).toThrow('Invalid transform data: scale must be [x, y, z]');
  });

  it('throws on non-finite scale values', () => {
    expect(() =>
      Transform.fromJSON({
        position: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, Infinity, 1],
      } as any)
    ).toThrow('Invalid transform data: scale values must be finite numbers');
  });

  it('accepts valid transform data', () => {
    const transform = Transform.fromJSON({
      position: [1, 2, 3],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    });

    expect(transform.position).toEqual([1, 2, 3]);
    expect(transform.rotation).toEqual([0, 0, 0, 1]);
    expect(transform.scale).toEqual([1, 1, 1]);
  });
});

describe.skip('Entity.fromJSON validation', () => {
  const validEntityData = {
    id: 'entity_123',
    name: 'TestEntity',
    active: true,
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    children: [],
  };

  it('throws on null data', () => {
    expect(() => Entity.fromJSON(null as any)).toThrow('Invalid entity data: must be an object');
  });

  it('throws on missing id', () => {
    const data = { ...validEntityData, id: undefined };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: id is required and must be a string'
    );
  });

  it('throws on invalid id type', () => {
    const data = { ...validEntityData, id: 123 };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: id is required and must be a string'
    );
  });

  it('throws on missing name', () => {
    const data = { ...validEntityData, name: undefined };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: name is required and must be a string'
    );
  });

  it('throws on invalid name type', () => {
    const data = { ...validEntityData, name: 123 };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: name is required and must be a string'
    );
  });

  it('throws on missing active', () => {
    const data = { ...validEntityData, active: undefined };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: active must be a boolean'
    );
  });

  it('throws on invalid active type', () => {
    const data = { ...validEntityData, active: 'true' };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: active must be a boolean'
    );
  });

  it('throws on missing transform', () => {
    const data = { ...validEntityData, transform: undefined };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: transform is required'
    );
  });

  it('throws on invalid color length', () => {
    const data = { ...validEntityData, color: [1, 0, 0] };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: color must be [r, g, b, a] with 4 values'
    );
  });

  it('throws on color values out of range', () => {
    const data = { ...validEntityData, color: [1, 2, 0, 1] };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: color values must be numbers between 0 and 1'
    );

    const data2 = { ...validEntityData, color: [1, -1, 0, 1] };
    expect(() => Entity.fromJSON(data2 as any)).toThrow(
      'Invalid entity data: color values must be numbers between 0 and 1'
    );
  });

  it('throws on non-finite color values', () => {
    const data = { ...validEntityData, color: [1, NaN, 0, 1] };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: color values must be numbers between 0 and 1'
    );
  });

  it('throws on invalid meshType type', () => {
    const data = { ...validEntityData, meshType: 123 };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: meshType must be a string'
    );
  });

  it('throws on invalid userData type', () => {
    const data = { ...validEntityData, userData: 'invalid' };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: userData must be an object'
    );
  });

  it('throws on userData being an array', () => {
    const data = { ...validEntityData, userData: [] };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: userData must be an object'
    );
  });

  it('throws on children not being an array', () => {
    const data = { ...validEntityData, children: 'invalid' };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: children must be an array'
    );
  });

  it('throws on components not being an array', () => {
    const data = { ...validEntityData, components: 'invalid' };
    expect(() => Entity.fromJSON(data as any)).toThrow(
      'Invalid entity data: components must be an array'
    );
  });

  it('restores original ID correctly', () => {
    const entity = Entity.fromJSON(validEntityData);
    expect(entity.id).toBe('entity_123');
  });

  it('preserves ID through serialization round-trip', () => {
    // Create entity with specific ID through deserialization
    const originalData = {
      ...validEntityData,
      id: 'entity_999',
      name: 'TestEntity',
    };

    const entity1 = Entity.fromJSON(originalData);
    expect(entity1.id).toBe('entity_999');

    // Serialize and deserialize again
    const serialized = entity1.toJSON();
    const entity2 = Entity.fromJSON(serialized);

    // ID should be preserved through the round-trip
    expect(entity2.id).toBe('entity_999');
    expect(entity2.id).toBe(entity1.id);
  });

  it('updates global ID counter to prevent conflicts', () => {
    // Deserialize entity with high ID number
    const highIdData = {
      ...validEntityData,
      id: 'entity_5000',
    };

    Entity.fromJSON(highIdData);

    // Next created entity should have ID >= 5001
    const newEntity = new Entity('New');
    const newIdNum = parseInt(newEntity.id.replace('entity_', ''), 10);

    expect(newIdNum).toBeGreaterThan(5000);
  });

  it('accepts valid entity data', () => {
    const entity = Entity.fromJSON({
      ...validEntityData,
      color: [1, 0, 0, 1],
      meshType: 'cube',
      userData: { test: 'value' },
    });

    expect(entity.id).toBe('entity_123');
    expect(entity.name).toBe('TestEntity');
    expect(entity.active).toBe(true);
    expect(entity.color).toEqual([1, 0, 0, 1]);
    expect(entity.meshType).toBe('cube');
    expect(entity.userData).toEqual({ test: 'value' });
  });

  it('propagates validation errors from child entities', () => {
    const data = {
      ...validEntityData,
      children: [
        {
          ...validEntityData,
          id: 'child_1',
          name: 'Child',
          transform: { position: [0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, // Invalid position
        },
      ],
    };

    expect(() => Entity.fromJSON(data as any)).toThrow('Invalid transform data');
  });
});

describe.skip('Scene.fromJSON validation', () => {
  const validEntityData = {
    id: 'entity_1',
    name: 'Entity',
    active: true,
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    children: [],
  };

  it('throws on null data', () => {
    expect(() => Scene.fromJSON(null as any)).toThrow('Invalid scene data: must be an object');
  });

  it('throws on undefined data', () => {
    expect(() => Scene.fromJSON(undefined as any)).toThrow('Invalid scene data: must be an object');
  });

  it('throws on missing name', () => {
    expect(() => Scene.fromJSON({ entities: [] } as any)).toThrow(
      'Invalid scene data: name is required and must be a string'
    );
  });

  it('throws on invalid name type', () => {
    expect(() => Scene.fromJSON({ name: 123, entities: [] } as any)).toThrow(
      'Invalid scene data: name is required and must be a string'
    );
  });

  it('throws on missing entities', () => {
    expect(() => Scene.fromJSON({ name: 'Scene' } as any)).toThrow(
      'Invalid scene data: entities must be an array'
    );
  });

  it('throws on entities not being an array', () => {
    expect(() => Scene.fromJSON({ name: 'Scene', entities: 'invalid' } as any)).toThrow(
      'Invalid scene data: entities must be an array'
    );
  });

  it('propagates validation errors from entities', () => {
    const data = {
      name: 'Scene',
      entities: [{ ...validEntityData, name: 123 }], // Invalid name
    };

    expect(() => Scene.fromJSON(data as any)).toThrow('Failed to deserialize entity');
  });

  it('accepts valid scene data', () => {
    const scene = Scene.fromJSON({
      name: 'TestScene',
      entities: [validEntityData],
    });

    expect(scene.name).toBe('TestScene');
    expect(scene.entityCount).toBe(1);
    expect(scene.rootEntities[0]?.name).toBe('Entity');
  });
});

describe.skip('Scene.import validation', () => {
  it('throws on empty string', () => {
    expect(() => Scene.import('')).toThrow('Invalid JSON string: must be a non-empty string');
  });

  it('throws on non-string input', () => {
    expect(() => Scene.import(123 as any)).toThrow(
      'Invalid JSON string: must be a non-empty string'
    );
  });

  it('throws on invalid JSON syntax', () => {
    expect(() => Scene.import('{ invalid json }')).toThrow('Failed to parse scene JSON');
  });

  it('throws on valid JSON but invalid scene data', () => {
    expect(() => Scene.import('{"name": 123, "entities": []}')).toThrow('Invalid scene data');
  });

  it('accepts valid JSON scene data', () => {
    const json = JSON.stringify({
      name: 'TestScene',
      entities: [
        {
          id: 'entity_1',
          name: 'Entity',
          active: true,
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          children: [],
        },
      ],
    });

    const scene = Scene.import(json);
    expect(scene.name).toBe('TestScene');
    expect(scene.entityCount).toBe(1);
  });
});
