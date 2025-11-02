import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Entity, MaterialComponent } from '@engine/world';
import { AvatarMaterialManager } from './avatar-material-manager';
import type { AvatarMaterialResolver } from '../avatar-instance';
import type { RgbaColor } from '@engine/world';
import type { AvatarPartDefinition } from '../slots';

describe('AvatarMaterialManager', () => {
  let manager: AvatarMaterialManager;
  let entity: Entity;

  beforeEach(() => {
    manager = new AvatarMaterialManager();
    entity = new Entity('TestEntity');
  });

  describe('applyMaterial', () => {
    it('should apply default material color', () => {
      const selection = {
        id: 'test',
        definition: {
          id: 'test',
          displayName: 'Test',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [0.8, 0.8, 0.8, 1] as RgbaColor,
        } as AvatarPartDefinition,
      };

      const appliedColors = { primary: [0.8, 0.8, 0.8, 1] as RgbaColor };

      manager.applyMaterial(entity, selection, appliedColors);

      const material = entity.getComponent(MaterialComponent);
      expect(material).toBeDefined();
      expect(material?.primaryColor).toEqual([0.8, 0.8, 0.8, 1]);
    });

    it('should use material resolver when provided', () => {
      const resolver: AvatarMaterialResolver = vi.fn(() => ({
        materialId: 5, // Valid material ID (within MAX_MATERIAL_ID limit)
        color: [1, 0, 0, 1] as RgbaColor,
      }));

      const managerWithResolver = new AvatarMaterialManager(resolver);
      const selection = {
        id: 'test',
        definition: {
          id: 'test',
          displayName: 'Test',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1] as RgbaColor,
        } as AvatarPartDefinition,
        materialId: 'test_material',
      };

      managerWithResolver.applyMaterial(entity, selection, {});

      const material = entity.getComponent(MaterialComponent);
      expect(material?.materialId).toBe(5);
      expect(resolver).toHaveBeenCalledWith('test_material');
    });

    it('should parse numeric material ID', () => {
      const selection = {
        id: 'test',
        definition: {
          id: 'test',
          displayName: 'Test',
          slot: 'HeadSlot',
          joint: 'Head',
          mesh: 'sphere',
          localPosition: [0, 0, 0],
          localRotation: [0, 0, 0, 1],
          localScale: [1, 1, 1],
          defaultColor: [1, 1, 1, 1] as RgbaColor,
        } as AvatarPartDefinition,
        materialId: '7', // Valid material ID (within MAX_MATERIAL_ID limit)
      };

      manager.applyMaterial(entity, selection, {});

      const material = entity.getComponent(MaterialComponent);
      expect(material?.materialId).toBe(7);
    });
  });

  describe('resolveBinding', () => {
    it('should return null for empty string', () => {
      expect(manager.resolveBinding('')).toBeNull();
    });

    it('should parse numeric string', () => {
      const binding = manager.resolveBinding('456');
      expect(binding?.materialId).toBe(456);
    });

    it('should use resolver when available', () => {
      const resolver: AvatarMaterialResolver = vi.fn(() => ({
        materialId: 789,
      }));
      const managerWithResolver = new AvatarMaterialManager(resolver);

      const binding = managerWithResolver.resolveBinding('test');
      expect(binding?.materialId).toBe(789);
      expect(resolver).toHaveBeenCalledWith('test');
    });
  });
});

